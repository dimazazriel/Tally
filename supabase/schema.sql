-- =====================================================================
--  Tally · skema database (Supabase / PostgreSQL)
--
--  Cara pakai: Supabase → SQL Editor → New query → tempel seluruh file
--  ini → Run. Aman dijalankan ulang: tabel yang sudah ada tidak dihapus
--  dan data proyek yang sudah diedit tidak ditimpa.
--
--  Isi:
--   1. Tabel  : proyek, laporan, riwayat, dukungan, pengaturan
--   2. Keamanan: Row Level Security (publik hanya bisa membaca)
--   3. Fungsi : kirim_laporan, dukung, lacak, cek_pin,
--               perbarui_kasus, hapus_laporan
--   4. Penyimpanan foto: bucket "foto-laporan"
--   5. Data awal: 24 proyek Kota Depok + PIN demo petugas
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------

-- Data resmi proyek (LPSE Kota Depok dan berita). Satu baris = satu paket.
create table if not exists public.proyek (
  id              text primary key,                 -- contoh: PRJ-001
  nama            text not null,
  sektor          text not null,
  tahun           int  not null,
  kecamatan       text,
  dinas           text not null,
  penyedia        text,
  pagu            numeric(18,2) not null,
  hps             numeric(18,2),
  nilai_kontrak   numeric(18,2),
  mulai           date,
  selesai         date,
  jadwal          text,
  status_resmi    text not null,
  sumber_dana     text,
  kode_tender     text,
  kode_rup        text,
  sumber          text not null,
  sumber_url      text,
  lat             double precision not null,
  lng             double precision not null,
  presisi_lokasi  text not null
                  check (presisi_lokasi in ('titik','jalan','kelurahan','kecamatan')),
  catatan_lokasi  text,
  diperbarui_pada timestamptz not null default now()
);

-- Laporan warga. Laporan pertama untuk (proyek + kondisi) yang masih
-- terbuka menjadi "induk kasus"; laporan berikutnya untuk hal yang sama
-- menempel ke induk lewat induk_kode, jadi satu masalah = satu kasus.
create table if not exists public.laporan (
  kode              text primary key,               -- contoh: TLY-7K2Q
  proyek_id         text not null references public.proyek(id) on delete cascade,
  kondisi           text not null check (kondisi in
                      ('Sesuai','Sedang dikerjakan','Belum dikerjakan',
                       'Terbengkalai','Rusak setelah selesai')),
  temuan            text[] not null default '{}',   -- checklist "yang kamu lihat"
  catatan           text check (char_length(catatan) <= 600),
  foto_path         text,                           -- path di bucket foto-laporan
  jarak_meter       int,                            -- jarak pelapor ke titik proyek
  terverifikasi     boolean not null default false, -- lolos cek radius GPS
  status            text not null default 'Diterima' check (status in
                      ('Diterima','Diverifikasi','Diteruskan ke dinas',
                       'Ditindaklanjuti','Selesai','Ditolak')),
  induk_kode        text references public.laporan(kode) on delete set null,
  jumlah_dukungan   int not null default 0,         -- konfirmasi warga lain
  sumber            text not null default 'publik' check (sumber in ('publik','tim')),
  tanggapan         text,                           -- tanggapan petugas/dinas
  foto_sesudah_path text,
  dibuat_pada       timestamptz not null default now(),
  diperbarui_pada   timestamptz not null default now()
);
create index if not exists laporan_proyek_idx on public.laporan (proyek_id);
create index if not exists laporan_induk_idx  on public.laporan (induk_kode);

-- Jejak perubahan status (untuk halaman Lacak dan hitungan waktu respons).
create table if not exists public.riwayat (
  id      bigint generated always as identity primary key,
  kode    text not null references public.laporan(kode) on delete cascade,
  status  text not null,
  catatan text,
  waktu   timestamptz not null default now()
);
create index if not exists riwayat_kode_idx on public.riwayat (kode);

-- "Saya juga lihat ini": satu perangkat hanya bisa mendukung satu kasus sekali.
create table if not exists public.dukungan (
  id           bigint generated always as identity primary key,
  kode         text not null references public.laporan(kode) on delete cascade,
  perangkat_id text not null check (char_length(perangkat_id) between 8 and 64),
  dibuat_pada  timestamptz not null default now(),
  unique (kode, perangkat_id)
);

-- Pengaturan rahasia (hash PIN). Tidak bisa dibaca dari website.
create table if not exists public.pengaturan (
  kunci text primary key,
  nilai text not null
);

-- ---------------------------------------------------------------------
-- 2. KEAMANAN (Row Level Security)
--    Publik boleh MEMBACA proyek, laporan, riwayat.
--    Semua penulisan hanya lewat fungsi di bagian 3 (bisa dicek & dibatasi).
-- ---------------------------------------------------------------------
alter table public.proyek     enable row level security;
alter table public.laporan    enable row level security;
alter table public.riwayat    enable row level security;
alter table public.dukungan   enable row level security;
alter table public.pengaturan enable row level security;

drop policy if exists "baca proyek"  on public.proyek;
drop policy if exists "baca laporan" on public.laporan;
drop policy if exists "baca riwayat" on public.riwayat;
create policy "baca proyek"  on public.proyek  for select to anon, authenticated using (true);
create policy "baca laporan" on public.laporan for select to anon, authenticated using (true);
create policy "baca riwayat" on public.riwayat for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
revoke all on public.proyek, public.laporan, public.riwayat,
              public.dukungan, public.pengaturan from anon, authenticated;
grant select on public.proyek, public.laporan, public.riwayat to anon, authenticated;

-- Fungsi bantu disimpan di skema terpisah yang tidak terbuka ke API.
create schema if not exists tally_privat;
revoke all on schema tally_privat from public, anon, authenticated;

create or replace function tally_privat.hash_pin(p_pin text)
returns text language sql immutable
as $$
  select encode(sha256(convert_to('tally:' || coalesce(p_pin, ''), 'UTF8')), 'hex')
$$;

create or replace function tally_privat.peran_pin(p_pin text)
returns text language sql stable
set search_path = public, tally_privat
as $$
  select case
    when p_pin is null or length(trim(p_pin)) = 0 then null
    when exists (select 1 from public.pengaturan
                  where kunci = 'pin_admin_hash' and nilai = tally_privat.hash_pin(trim(p_pin)))
      then 'admin'
    when exists (select 1 from public.pengaturan
                  where kunci = 'pin_petugas_hash' and nilai = tally_privat.hash_pin(trim(p_pin)))
      then 'petugas'
    else null
  end
$$;

-- Rumus haversine: jarak dua titik di permukaan bumi, dalam meter.
create or replace function tally_privat.jarak_meter(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision language sql immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- Kode lacak acak tanpa huruf yang mirip angka (O/0, I/1).
create or replace function tally_privat.kode_baru()
returns text language plpgsql volatile
set search_path = public, tally_privat
as $$
declare
  abjad constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  hasil text;
begin
  loop
    hasil := 'TLY-';
    for i in 1..4 loop
      hasil := hasil || substr(abjad, 1 + floor(random() * length(abjad))::int, 1);
    end loop;
    exit when not exists (select 1 from public.laporan where kode = hasil);
  end loop;
  return hasil;
end
$$;

-- ---------------------------------------------------------------------
-- 3. FUNGSI (dipanggil website lewat /rest/v1/rpc/<nama>)
-- ---------------------------------------------------------------------

-- Kirim laporan baru. Lokasi pelapor TIDAK disimpan: yang disimpan hanya
-- jarak ke titik proyek dan apakah lolos cek radius.
create or replace function public.kirim_laporan(
  p_proyek_id text,
  p_kondisi   text,
  p_temuan    text[]           default '{}',
  p_catatan   text             default null,
  p_foto_path text             default null,
  p_lat       double precision default null,
  p_lng       double precision default null,
  p_kunci_tim text             default null
) returns json
language plpgsql security definer
set search_path = public, tally_privat
as $$
declare
  v_proyek public.proyek%rowtype;
  v_induk  public.laporan%rowtype;
  v_kode   text;
  v_jarak  int;
  v_batas  int;
  v_verif  boolean := false;
  v_status text := 'Diterima';
  v_sumber text := 'publik';
begin
  select * into v_proyek from public.proyek where id = p_proyek_id;
  if not found then
    raise exception 'Proyek % tidak ditemukan', p_proyek_id using errcode = 'P0002';
  end if;
  if p_kondisi is null or p_kondisi not in
     ('Sesuai','Sedang dikerjakan','Belum dikerjakan','Terbengkalai','Rusak setelah selesai') then
    raise exception 'Kondisi tidak dikenal' using errcode = '22023';
  end if;
  if p_catatan is not null and char_length(p_catatan) > 600 then
    raise exception 'Catatan maksimal 600 karakter' using errcode = '22001';
  end if;
  if coalesce(array_length(p_temuan, 1), 0) > 8 then
    raise exception 'Temuan maksimal 8 butir' using errcode = '22023';
  end if;
  if p_foto_path is not null
     and p_foto_path !~ '^laporan/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$' then
    raise exception 'Alamat foto tidak valid' using errcode = '22023';
  end if;

  if p_lat is not null and p_lng is not null then
    v_jarak := round(tally_privat.jarak_meter(p_lat, p_lng, v_proyek.lat, v_proyek.lng));
    v_batas := case when v_proyek.presisi_lokasi in ('titik','jalan') then 300 else 1500 end;
    v_verif := v_jarak <= v_batas;
  end if;

  if p_kunci_tim is not null and tally_privat.peran_pin(p_kunci_tim) = 'admin' then
    v_sumber := 'tim';
  end if;

  -- Sudah ada kasus terbuka untuk proyek + kondisi yang sama? Gabungkan.
  select * into v_induk
    from public.laporan
   where proyek_id = p_proyek_id
     and kondisi = p_kondisi
     and induk_kode is null
     and status not in ('Selesai','Ditolak')
   order by dibuat_pada
   limit 1;
  if v_induk.kode is not null then
    v_status := v_induk.status;
  end if;

  v_kode := tally_privat.kode_baru();

  insert into public.laporan
    (kode, proyek_id, kondisi, temuan, catatan, foto_path,
     jarak_meter, terverifikasi, status, induk_kode, sumber)
  values
    (v_kode, p_proyek_id, p_kondisi, coalesce(p_temuan, '{}'),
     nullif(trim(p_catatan), ''), p_foto_path,
     v_jarak, v_verif, v_status, v_induk.kode, v_sumber);

  insert into public.riwayat (kode, status, catatan)
  values (v_kode, 'Diterima',
          case when v_induk.kode is not null
               then 'Digabung ke kasus ' || v_induk.kode
               else 'Laporan masuk' end);

  if v_induk.kode is not null then
    update public.laporan
       set jumlah_dukungan = jumlah_dukungan + 1, diperbarui_pada = now()
     where kode = v_induk.kode;
  end if;

  return json_build_object(
    'kode', v_kode, 'induk_kode', v_induk.kode, 'status', v_status,
    'jarak_meter', v_jarak, 'batas_meter', v_batas,
    'terverifikasi', v_verif, 'sumber', v_sumber);
end
$$;

-- "Saya juga lihat ini": tambah dukungan ke kasus (sekali per perangkat).
create or replace function public.dukung(p_kode text, p_perangkat_id text)
returns json
language plpgsql security definer
set search_path = public, tally_privat
as $$
declare
  v_lap   public.laporan%rowtype;
  v_kasus text;
  v_baru  int;
begin
  if p_perangkat_id is null or char_length(p_perangkat_id) not between 8 and 64 then
    raise exception 'ID perangkat tidak valid' using errcode = '22023';
  end if;
  select * into v_lap from public.laporan where kode = upper(trim(p_kode));
  if not found then
    raise exception 'Kode % tidak ditemukan', p_kode using errcode = 'P0002';
  end if;
  v_kasus := coalesce(v_lap.induk_kode, v_lap.kode);

  insert into public.dukungan (kode, perangkat_id)
  values (v_kasus, p_perangkat_id)
  on conflict (kode, perangkat_id) do nothing;
  get diagnostics v_baru = row_count;

  if v_baru > 0 then
    update public.laporan
       set jumlah_dukungan = jumlah_dukungan + 1, diperbarui_pada = now()
     where kode = v_kasus;
  end if;

  return json_build_object(
    'kode', v_kasus,
    'baru', v_baru > 0,
    'jumlah_dukungan', (select jumlah_dukungan from public.laporan where kode = v_kasus));
end
$$;

-- Lacak satu kode: laporan, kasusnya, proyek, dan linimasa status.
create or replace function public.lacak(p_kode text)
returns json
language sql stable security definer
set search_path = public, tally_privat
as $$
  with l as (select * from public.laporan where kode = upper(trim(p_kode))),
       k as (select coalesce(induk_kode, kode) as kode_kasus from l)
  select case when not exists (select 1 from l) then null else
    json_build_object(
      'laporan', (select row_to_json(l) from l),
      'kasus',   (select row_to_json(x) from public.laporan x join k on x.kode = k.kode_kasus),
      'proyek',  (select json_build_object('id', p.id, 'nama', p.nama, 'dinas', p.dinas,
                                           'kecamatan', p.kecamatan, 'status_resmi', p.status_resmi)
                    from public.proyek p join l on p.id = l.proyek_id),
      'riwayat', (select coalesce(json_agg(json_build_object(
                           'status', r.status, 'catatan', r.catatan, 'waktu', r.waktu)
                         order by r.waktu), '[]'::json)
                    from public.riwayat r join k on r.kode = k.kode_kasus),
      'anggota', (select count(*) from public.laporan a join k on a.induk_kode = k.kode_kasus)
    ) end
$$;

-- Cek PIN: mengembalikan 'petugas', 'admin', atau null.
create or replace function public.cek_pin(p_pin text)
returns text
language sql stable security definer
set search_path = public, tally_privat
as $$
  select tally_privat.peran_pin(p_pin)
$$;

-- Petugas mengubah status kasus (berlaku untuk induk dan semua anggotanya).
create or replace function public.perbarui_kasus(
  p_kode              text,
  p_status            text,
  p_pin               text,
  p_catatan           text default null,
  p_foto_sesudah_path text default null
) returns json
language plpgsql security definer
set search_path = public, tally_privat
as $$
declare
  v_peran text := tally_privat.peran_pin(p_pin);
  v_lap   public.laporan%rowtype;
  v_kasus text;
begin
  if v_peran is null then
    raise exception 'PIN petugas salah' using errcode = '28000';
  end if;
  if p_status not in ('Diterima','Diverifikasi','Diteruskan ke dinas',
                      'Ditindaklanjuti','Selesai','Ditolak') then
    raise exception 'Status tidak dikenal' using errcode = '22023';
  end if;
  if p_catatan is not null and char_length(p_catatan) > 600 then
    raise exception 'Catatan maksimal 600 karakter' using errcode = '22001';
  end if;
  if p_foto_sesudah_path is not null
     and p_foto_sesudah_path !~ '^sesudah/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$' then
    raise exception 'Alamat foto tidak valid' using errcode = '22023';
  end if;

  select * into v_lap from public.laporan where kode = upper(trim(p_kode));
  if not found then
    raise exception 'Kode % tidak ditemukan', p_kode using errcode = 'P0002';
  end if;
  v_kasus := coalesce(v_lap.induk_kode, v_lap.kode);

  update public.laporan
     set status = p_status,
         tanggapan = coalesce(nullif(trim(p_catatan), ''), tanggapan),
         foto_sesudah_path = coalesce(p_foto_sesudah_path, foto_sesudah_path),
         diperbarui_pada = now()
   where kode = v_kasus or induk_kode = v_kasus;

  insert into public.riwayat (kode, status, catatan)
  values (v_kasus, p_status, nullif(trim(p_catatan), ''));

  return json_build_object('kode', v_kasus, 'status', p_status, 'peran', v_peran);
end
$$;

-- Hapus laporan (khusus PIN admin tim), misalnya untuk laporan iseng.
-- Menghapus induk berarti menghapus seluruh kasusnya.
create or replace function public.hapus_laporan(p_kode text, p_pin text)
returns json
language plpgsql security definer
set search_path = public, tally_privat
as $$
declare
  v_lap   public.laporan%rowtype;
  v_hapus int;
begin
  if coalesce(tally_privat.peran_pin(p_pin), '') <> 'admin' then
    raise exception 'Butuh PIN admin tim' using errcode = '28000';
  end if;
  select * into v_lap from public.laporan where kode = upper(trim(p_kode));
  if not found then
    raise exception 'Kode % tidak ditemukan', p_kode using errcode = 'P0002';
  end if;
  delete from public.laporan where kode = v_lap.kode or induk_kode = v_lap.kode;
  get diagnostics v_hapus = row_count;
  if v_lap.induk_kode is not null then
    update public.laporan
       set jumlah_dukungan = greatest(jumlah_dukungan - 1, 0)
     where kode = v_lap.induk_kode;
  end if;
  return json_build_object('dihapus', v_hapus);
end
$$;

-- Hanya fungsi publik di atas yang boleh dipanggil dari website.
revoke all on function public.kirim_laporan(text,text,text[],text,text,double precision,double precision,text) from public;
revoke all on function public.dukung(text,text)           from public;
revoke all on function public.lacak(text)                 from public;
revoke all on function public.cek_pin(text)               from public;
revoke all on function public.perbarui_kasus(text,text,text,text,text) from public;
revoke all on function public.hapus_laporan(text,text)    from public;
grant execute on function public.kirim_laporan(text,text,text[],text,text,double precision,double precision,text) to anon, authenticated;
grant execute on function public.dukung(text,text)        to anon, authenticated;
grant execute on function public.lacak(text)              to anon, authenticated;
grant execute on function public.cek_pin(text)            to anon, authenticated;
grant execute on function public.perbarui_kasus(text,text,text,text,text) to anon, authenticated;
grant execute on function public.hapus_laporan(text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. PENYIMPANAN FOTO
--    Bucket publik: siapa pun bisa melihat foto, website hanya boleh
--    MENAMBAH file baru di folder laporan/ dan sesudah/ (maks. 2 MB).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-laporan', 'foto-laporan', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tally unggah foto" on storage.objects;
create policy "tally unggah foto" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'foto-laporan'
              and (name like 'laporan/%' or name like 'sesudah/%'));

-- ---------------------------------------------------------------------
-- 5. DATA AWAL
-- ---------------------------------------------------------------------

-- PIN demo Panel Petugas untuk juri: 404404 (sesuai nama tim, error 404).
-- PIN admin tim JANGAN ditulis di file ini; atur terpisah di SQL Editor.
insert into public.pengaturan (kunci, nilai)
values ('pin_petugas_hash', tally_privat.hash_pin('404404'))
on conflict (kunci) do nothing;

-- 24 proyek Kota Depok (sumber: data/proyek.json dan data/SUMBER-DATA.md).
-- "do nothing": koreksi yang sudah kalian buat di Table Editor tidak tertimpa.
insert into public.proyek
  (id, nama, sektor, tahun, kecamatan, dinas, penyedia, pagu, hps, nilai_kontrak,
   mulai, selesai, jadwal, status_resmi, sumber_dana, kode_tender, kode_rup,
   sumber, sumber_url, lat, lng, presisi_lokasi, catatan_lokasi)
values
  ('PRJ-001', 'Pembangunan dan Penataan Lingkungan Puskesmas Kelurahan Pancoran Mas', 'Kesehatan', 2026, 'Pancoran Mas', 'Dinas Perumahan dan Permukiman', 'CV. Firmauli Farida', 8367737802.0, 8367579550.75, 7613800000.0, null, null, 'Batas tanda tangan kontrak: 2 Juli 2026 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2026', '10140120000', '65428840', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10140120000/pengumumanlelang', -6.40284, 106.81927, 'titik', 'Puskesmas Pancoranmas, Jl. Pemuda (OpenStreetMap)'),
  ('PRJ-002', 'Pembangunan dan Penataan Lingkungan Puskesmas Leuwinanggung', 'Kesehatan', 2026, 'Tapos', 'Dinas Perumahan dan Permukiman', 'PT. Marzaqah Mutualisme Makmur Sentosa', 8367737802.0, 8367736185.74, 7600239000.0, null, null, 'Batas tanda tangan kontrak: 2 Juli 2026 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2026', '10140106000', '65399521', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10140106000/pengumumanlelang', -6.41064, 106.90845, 'kelurahan', 'Titik tengah Kel. Leuwinanggung'),
  ('PRJ-003', 'Pembangunan dan Penataan Lingkungan Kantor Kelurahan Meruyung', 'Kantor Pelayanan', 2026, 'Limo', 'Dinas Perumahan dan Permukiman', 'CV. Tetra D Jaya Mandiri', 7700000000.0, 7699965214.3, 7237861810.79, null, null, 'Batas tanda tangan kontrak: 9 Juli 2026 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2026', '10140091000', '65377604', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10140091000/pengumumanlelang', -6.38004, 106.76913, 'kelurahan', 'Titik tengah Kel. Meruyung'),
  ('PRJ-004', 'Pembangunan dan Penataan Lingkungan Rumah Kreatif Anak Istimewa', 'Sosial', 2026, 'Beji', 'Dinas Perumahan dan Permukiman', 'PT. Primerindo Multi Karya', 17752070000.0, 17752067500.8, 15706465616.64, null, null, 'Batas tanda tangan kontrak: 2 Juli 2026 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2026', '10140028000', '65511529', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10140028000/pengumumanlelang', -6.37258, 106.81839, 'kecamatan', 'Titik tengah Kec. Beji (alamat persis belum diketahui)'),
  ('PRJ-005', 'Rehabilitasi dan Penataan Lingkungan RSUD KiSA', 'Kesehatan', 2026, 'Sawangan', 'Dinas Perumahan dan Permukiman', 'CV. Arsita Karya', 1850340000.0, 1850323251.96, 1545000000.0, null, null, 'Batas tanda tangan kontrak: 2 Juli 2026 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2026', '10140109000', '65502119', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10140109000/pengumumanlelang', -6.40403, 106.75824, 'titik', 'RSUD Kota Depok, Jl. Muchtar Raya, Sawangan (OpenStreetMap) — cek apakah sama dengan RSUD KiSA'),
  ('PRJ-006', 'Pembangunan dan Penataan Lingkungan Depok Open Space Kawasan Balaikota Depok Tahap 3', 'Ruang Publik', 2026, 'Pancoran Mas', 'Dinas Perumahan dan Permukiman', 'CV. Jeselindo Jaya', 5721140000.0, 5706759881.44, 5300000000.0, null, null, 'Batas tanda tangan kontrak: 17 April 2026 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2026', '10119997000', '65498056', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10119997000/pengumumanlelang', -6.39351, 106.82119, 'titik', 'Balai Kota Depok, Jl. Margonda Raya (OpenStreetMap)'),
  ('PRJ-007', 'Pembangunan SDN Cinere 1', 'Pendidikan', 2026, 'Cinere', 'Dinas Pendidikan', 'PT Niscala Karya Konstruksi', 12058580453.0, 12048984000.0, null, null, null, 'Batas tanda tangan kontrak: 2 Juli 2026 (jadwal LPSE)', 'Pemenang ditetapkan, nilai kontrak belum tayang', 'APBD Kota Depok 2026', '10140154000', '64613535', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10140154000/pengumumanlelang', -6.33251, 106.78925, 'kelurahan', 'Titik tengah Kel. Cinere'),
  ('PRJ-008', 'Pembangunan dan Penataan Lingkungan SMPN 3 (Sukmajaya)', 'Pendidikan', 2025, 'Sukmajaya', 'Dinas Perumahan dan Permukiman', 'PT. Nenci Citra Pratama', 28305035323.0, 28305032617.51, 26234815723.2, null, null, 'Batas tanda tangan kontrak: 4 Juni 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10022144000', '54494616', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10022144000/pengumumanlelang', -6.38586, 106.84774, 'titik', 'SMP Negeri 3 Depok, Jl. Barito Raya (OpenStreetMap)'),
  ('PRJ-009', 'Pembangunan dan Penataan Lingkungan Puskesmas Bedahan', 'Kesehatan', 2025, 'Sawangan', 'Dinas Perumahan dan Permukiman', 'PT. Firham Putra Pratama', 7083172000.0, 7083163484.77, 6296774671.66, null, null, 'Batas tanda tangan kontrak: 4 Juni 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10022015000', '54494605', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10022015000/pengumumanlelang', -6.42678, 106.76987, 'kelurahan', 'Titik tengah Kel. Bedahan'),
  ('PRJ-010', 'Pembangunan dan Penataan Lingkungan Masjid Jatijajar (Lanjutan)', 'Ruang Publik', 2025, 'Tapos', 'Dinas Perumahan dan Permukiman', 'PT. Fitri Utama Mandiri', 15000000000.0, 14999999963.27, 13761378505.68, null, null, 'Batas tanda tangan kontrak: 11 Juni 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10022933000', '54494610', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10022933000/pengumumanlelang', -6.42045, 106.86625, 'jalan', 'Jalan Masjid, Kel. Jatijajar (OpenStreetMap)'),
  ('PRJ-011', 'Pembangunan dan Penataan Lingkungan SDN Kedaung', 'Pendidikan', 2025, 'Sawangan', 'Dinas Perumahan dan Permukiman', 'PT. Marzaqah Mutualisme Makmur Sentosa', 7266766784.0, 7266766700.92, 6689689000.0, null, null, 'Batas tanda tangan kontrak: 4 Juni 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10023138000', '54494581', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10023138000/pengumumanlelang', -6.36629, 106.74784, 'kelurahan', 'Titik tengah Kel. Kedaung'),
  ('PRJ-012', 'Pembangunan dan Penataan Lingkungan SMPN 25 (Lanjutan)', 'Pendidikan', 2025, 'Sawangan', 'Dinas Perumahan dan Permukiman', 'Primerindo Pratama', 10621409750.0, 10621405918.46, 9758181051.0, null, null, 'Batas tanda tangan kontrak: 4 Juni 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10023063000', '54494615', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10023063000/pengumumanlelang', -6.40019, 106.76372, 'kecamatan', 'Titik tengah Kec. Sawangan (alamat persis belum diketahui)'),
  ('PRJ-013', 'Rehabilitasi dan Penataan Lingkungan Stadion Mahakam', 'Olahraga', 2025, 'Sukmajaya', 'Dinas Perumahan dan Permukiman', 'PT. Sedasa Sinergi Inovasi', 7000000000.0, 6999991750.56, 6433336063.64, null, null, 'Batas tanda tangan kontrak: 19 Agustus 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10054286000', '55133307', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10054286000/pengumumanlelang', -6.38506, 106.84729, 'titik', 'Stadion Mahakam, Jl. Rasamala Raya (OpenStreetMap)'),
  ('PRJ-014', 'Drainase Jl. Mawar 3 RW 004 Kel. Depok Jaya, Kec. Pancoran Mas', 'Drainase', 2025, 'Pancoran Mas', 'Dinas Perumahan dan Permukiman', 'CV. Martumbur Rezeki', 245470790.0, 245192700.0, 172661000.0, null, null, 'Batas tanda tangan kontrak: 24 Juli 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10025014000', '55183079', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10025014000/pengumumanlelang', -6.38953, 106.81431, 'kelurahan', 'Titik tengah Kel. Depok Jaya — geser ke Jl. Mawar 3 setelah survei'),
  ('PRJ-015', 'Drainase Jl. Kenanga 1 dan Jl. Kenanga 2 RW 005 Kel. Depok Jaya, Kec. Pancoran Mas', 'Drainase', 2025, 'Pancoran Mas', 'Dinas Perumahan dan Permukiman', 'CV. Abyakta Camani Cemerlang', 222108330.0, 221500000.0, 153000000.0, null, null, 'Batas tanda tangan kontrak: 24 Juli 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10024938000', '55183004', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10024938000/pengumumanlelang', -6.38953, 106.81431, 'kelurahan', 'Titik tengah Kel. Depok Jaya — geser ke Jl. Kenanga setelah survei'),
  ('PRJ-016', 'Drainase Jalan RW 013 Komplek Areman Baru Kel. Tugu, Kec. Cimanggis', 'Drainase', 2025, 'Cimanggis', 'Dinas Perumahan dan Permukiman', 'CV. Meriall Incosyaira', 546730240.0, 544155500.0, 367119022.38, null, null, 'Batas tanda tangan kontrak: 24 Juli 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10024850000', '55183115', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10024850000/pengumumanlelang', -6.36971, 106.84886, 'kelurahan', 'Sekitar Kel. Tugu — geser ke Komplek Areman Baru setelah survei'),
  ('PRJ-017', 'Drainase Perum Griya Telaga Permai RT 004 RW 019 Kel. Cilangkap, Kec. Tapos', 'Drainase', 2025, 'Tapos', 'Dinas Perumahan dan Permukiman', 'CV. Meriall Incosyaira', 240430960.0, 240204600.0, 164617659.78, null, null, 'Batas tanda tangan kontrak: 24 Juli 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10025049000', '55183008', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10025049000/pengumumanlelang', -6.44516, 106.85695, 'kelurahan', 'Titik tengah Kel. Cilangkap — geser ke Perum Griya Telaga Permai setelah survei'),
  ('PRJ-018', 'Keperluan Mendesak Rehabilitasi SDN Mekarjaya 11', 'Pendidikan', 2025, 'Sukmajaya', 'Dinas Perumahan dan Permukiman', 'CV. Sejahtera Mandiri', 1653258000.0, 1653257858.22, 1445225000.0, null, null, 'Batas tanda tangan kontrak: 19 September 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10072337000', '58524715', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10072337000/pengumumanlelang', -6.39674, 106.83923, 'kelurahan', 'Sekitar Kel. Mekar Jaya — titik persis sekolah belum diketahui'),
  ('PRJ-019', 'Pembangunan dan Penataan Lingkungan Kantor Kelurahan Tugu', 'Kantor Pelayanan', 2025, 'Cimanggis', 'Dinas Perumahan dan Permukiman', 'PT. Bumi Mandiri Berdikari', 7000000000.0, 6999999446.71, 6579999439.69, null, null, 'Batas tanda tangan kontrak: 4 Juni 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10023137000', '54494591', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10023137000/pengumumanlelang', -6.37014, 106.84852, 'kelurahan', 'Sekitar Kel. Tugu — titik persis kantor kelurahan belum diketahui'),
  ('PRJ-020', 'Rehabilitasi dan Penataan Lingkungan SMPN 18', 'Pendidikan', 2025, 'Bojongsari', 'Dinas Perumahan dan Permukiman', 'Brilian Cemerlang', 1000000000.0, 999999326.01, 979020000.0, null, null, 'Batas tanda tangan kontrak: 4 Juni 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10023141000', '55133241', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10023141000/pengumumanlelang', -6.39966, 106.74062, 'kecamatan', 'Titik tengah Kec. Bojongsari (alamat persis belum diketahui)'),
  ('PRJ-021', 'Rehabilitasi dan Penataan Lingkungan SDN Pondok Petir 3', 'Pendidikan', 2025, 'Bojongsari', 'Dinas Perumahan dan Permukiman', 'CV. Bangun Mandiri Indonesia', 1511090000.0, 1511057792.21, 1400000000.0, null, null, 'Batas tanda tangan kontrak: 19 September 2025 (jadwal LPSE)', 'Berkontrak', 'APBD Kota Depok 2025', '10072389000', '59348945', 'LPSE Kota Depok (SPSE)', 'https://spse.inaproc.id/depok/lelang/10072389000/pengumumanlelang', -6.37737, 106.73152, 'kelurahan', 'Titik tengah Kel. Pondok Petir'),
  ('PRJ-022', 'Pelebaran Jalan Raya Cipayung (Jembatan Lima – Jembatan Serong, ±1,4 km)', 'Jalan', 2026, 'Cipayung', 'Dinas Pekerjaan Umum dan Penataan Ruang', null, 28000000000, null, null, null, '2026-12-08', 'Target selesai 8 Desember 2026', 'Berjalan', 'APBD Kota Depok 2026', null, null, 'JPNN Jabar, 18 Sep 2026 (Kepala DPUPR Yodi Joko Bintoro)', 'https://jabar.jpnn.com/jabar-terkini/33334/pemkot-depok-gelontorkan-rp28-miliar-untuk-pelebaran-jalan-raya-cipayung', -6.43503, 106.7966, 'jalan', 'Jalan Raya Cipayung (OpenStreetMap)'),
  ('PRJ-023', 'Perbaikan & pelebaran 2 m Jalan Raya Cipayung (depan Perum Green Pitara – Jembatan Serong)', 'Jalan', 2026, 'Cipayung', 'Dinas Pekerjaan Umum dan Penataan Ruang', null, 1700000000, null, 1700000000, '2026-07-09', '2026-10-06', '9 Juli – 6 Oktober 2026', 'Berjalan', 'APBD Kota Depok 2026', null, null, 'detikNews, 1 Sep 2026', 'https://news.detik.com/berita/d-8643123/perbaikan-jalan-raya-cipayung-depok-rampung-oktober-2026-anggaran-rp-1-7-m', -6.41347, 106.79826, 'jalan', 'Jalan Raya Cipayung ruas Rangkapan Jaya (OpenStreetMap)'),
  ('PRJ-024', 'Penataan Drainase Jalan Raya Sawangan (Segmen A 210,6 m + Segmen B 58,6 m)', 'Drainase', 2026, 'Pancoran Mas', 'Dinas Pekerjaan Umum dan Penataan Ruang', null, 1100000000, null, null, '2026-06-03', '2026-08-01', '3 Juni – 1 Agustus 2026 (60 hari kalender)', 'Berjalan', 'APBD Kota Depok 2026', null, null, 'JPNN Jabar, 22 Jun 2026', 'https://jabar.jpnn.com/jabar-terkini/31740/pupr-depok-gelontorkan-rp-11-miliar-untuk-penataan-drainase-jalan-raya-sawangan', -6.39499, 106.79874, 'jalan', 'Jalan Raya Sawangan, Kel. Mampang (OpenStreetMap)')
on conflict (id) do nothing;

-- Selesai. Cek: select count(*) from proyek;  -- hasilnya 24
