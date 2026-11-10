// =====================================================================
// data.js — satu pintu untuk semua data Tally
//
// Mode "online"  : membaca/menulis ke database Supabase (PostgreSQL)
//                  lewat REST API (/rest/v1) dan Storage (/storage/v1).
// Mode "cadangan": dipakai otomatis bila database belum diatur atau tidak
//                  terjangkau. Proyek dibaca dari data/proyek.json, laporan
//                  disimpan di localStorage perangkat ini.
// Halaman cukup memanggil Data.xxx() tanpa peduli mode yang aktif.
// =====================================================================
const Data = (() => {
  const cfg = window.TALLY_CONFIG || {};
  const URL_DB = (cfg.supabaseUrl || '').replace(/\/+$/, '');
  const KUNCI = cfg.supabaseKey || '';
  const BUCKET = cfg.bucketFoto || 'foto-laporan';
  const adaDb = Boolean(URL_DB && KUNCI);

  let mode = null;          // 'online' | 'cadangan'
  let janjiSiap = null;     // Promise agar siap() hanya jalan sekali per halaman
  let cacheProyek = null;

  // ---------- Pemetaan nama kolom database (snake_case) ↔ JS (camelCase) ----------
  const keProyek = (r) => ({
    id: r.id, nama: r.nama, sektor: r.sektor, tahun: r.tahun, kecamatan: r.kecamatan, dinas: r.dinas,
    penyedia: r.penyedia, pagu: num(r.pagu), hps: num(r.hps), nilaiKontrak: num(r.nilai_kontrak),
    mulai: r.mulai, selesai: r.selesai, jadwal: r.jadwal, statusResmi: r.status_resmi,
    sumberDana: r.sumber_dana, kodeTender: r.kode_tender, kodeRUP: r.kode_rup, sumber: r.sumber,
    sumberUrl: r.sumber_url, lat: r.lat, lng: r.lng, presisiLokasi: r.presisi_lokasi, catatanLokasi: r.catatan_lokasi
  });
  const keLaporan = (r) => ({
    kode: r.kode, proyekId: r.proyek_id, kondisi: r.kondisi, temuan: r.temuan || [], catatan: r.catatan,
    fotoUrl: urlFoto(r.foto_path), jarakMeter: r.jarak_meter, terverifikasi: r.terverifikasi, status: r.status,
    fotoLangsung: r.foto_langsung == null ? null : r.foto_langsung === true,
    akurasiMeter: r.akurasi_meter == null ? null : Number(r.akurasi_meter),
    indukKode: r.induk_kode, jumlahDukungan: r.jumlah_dukungan || 0, sumber: r.sumber, tanggapan: r.tanggapan,
    fotoSesudahUrl: urlFoto(r.foto_sesudah_path), dibuatPada: r.dibuat_pada, diperbaruiPada: r.diperbarui_pada
  });
  const num = (v) => (v == null ? null : Number(v));

  function urlFoto(path) {
    if (!path) return null;
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    return `${URL_DB}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  // ---------- Pemanggil HTTP ----------
  // Publishable key (sb_publishable_...) dikirim HANYA di header apikey.
  // Kunci lama (JWT "eyJ...") juga dikirim sebagai Authorization: Bearer.
  function kepala(tambahan = {}) {
    const h = { apikey: KUNCI, ...tambahan };
    if (KUNCI.startsWith('eyJ')) h.Authorization = 'Bearer ' + KUNCI;
    return h;
  }

  async function minta(jalur, opsi = {}, batasMs = 9000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), batasMs);
    try {
      const res = await fetch(URL_DB + jalur, { ...opsi, signal: ctl.signal });
      const teks = await res.text();
      let isi = null;
      try { isi = teks ? JSON.parse(teks) : null; } catch (e) { isi = teks; }
      if (!res.ok) {
        const pesan = (isi && (isi.message || isi.error_description || isi.error)) || ('Kesalahan server ' + res.status);
        const err = new Error(pesan);
        err.status = res.status;
        err.kode = isi && isi.code;
        throw err;
      }
      return isi;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Database tidak merespons. Coba lagi sebentar.');
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
  const ambil = (jalur) => minta('/rest/v1/' + jalur, { headers: kepala() });
  const rpc = (nama, args) => minta('/rest/v1/rpc/' + nama, {
    method: 'POST',
    headers: kepala({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(args)
  });

  // ---------- Penentuan mode ----------
  async function siap() {
    if (janjiSiap) return janjiSiap;
    janjiSiap = (async () => {
      if (adaDb) {
        try {
          const baris = await ambil('proyek?select=*&order=id');
          cacheProyek = baris.map(keProyek);
          mode = 'online';
          return mode;
        } catch (e) {
          console.warn('[Tally] Database tidak terjangkau, pakai mode cadangan:', e.message);
        }
      }
      mode = 'cadangan';
      const res = await fetch('data/proyek.json');
      if (!res.ok) throw new Error('Data proyek tidak bisa dimuat (HTTP ' + res.status + ')');
      cacheProyek = await res.json();
      return mode;
    })();
    return janjiSiap;
  }

  // ---------- Penyimpanan lokal (mode cadangan) ----------
  const LK = 'tally_cadangan_laporan', RK = 'tally_cadangan_riwayat', DK = 'tally_cadangan_dukungan';
  const baca = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const tulis = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { throw new Error('Penyimpanan perangkat penuh. Hapus data situs ini di pengaturan browser.'); }
  };
  function kodeLokal() {
    const abjad = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const ada = new Set(baca(LK).map((l) => l.kode));
    let k;
    do { k = 'TLY-' + Array.from({ length: 4 }, () => abjad[Math.floor(Math.random() * abjad.length)]).join(''); } while (ada.has(k));
    return k;
  }

  // Perubahan status yang diizinkan (sama dengan fungsi perbarui_kasus di database)
  const ALUR_BOLEH = {
    'Diterima': ['Diverifikasi', 'Ditolak'],
    'Diverifikasi': ['Diteruskan ke dinas', 'Ditolak'],
    'Diteruskan ke dinas': ['Ditindaklanjuti'],
    'Ditindaklanjuti': ['Selesai'],
    'Selesai': ['Ditindaklanjuti'],
    'Ditolak': ['Diterima']
  };

  // ---------- API publik untuk halaman ----------
  async function proyek() { await siap(); return cacheProyek; }

  async function laporan() {
    await siap();
    if (mode === 'online') {
      const rows = await ambil('laporan?select=*&order=dibuat_pada.desc');
      return rows.map(keLaporan);
    }
    return baca(LK).map(keLaporan).sort((a, b) => new Date(b.dibuatPada) - new Date(a.dibuatPada));
  }

  async function riwayat() {
    await siap();
    if (mode === 'online') return ambil('riwayat?select=kode,status,catatan,waktu&order=waktu.asc');
    return baca(RK);
  }

  // Unggah foto (Blob JPEG). Mengembalikan path untuk disimpan di laporan.
  async function unggahFoto(blob, folder = 'laporan') {
    await siap();
    if (mode !== 'online') return blobKeDataUrl(blob);
    const nama = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    await minta(`/storage/v1/object/${BUCKET}/${nama}`, {
      method: 'POST',
      headers: kepala({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false', 'cache-control': '31536000' }),
      body: blob
    }, 30000);
    return nama;
  }

  async function kirimLaporan({ proyekId, kondisi, temuan = [], catatan = '', fotoPath = null, lat = null, lng = null,
                                fotoLangsung = false, akurasi = null }) {
    await siap();
    const kunciTim = (() => { try { return localStorage.getItem('tally_kunci_tim'); } catch (e) { return null; } })();
    if (mode === 'online') {
      const args = {
        p_proyek_id: proyekId, p_kondisi: kondisi, p_temuan: temuan, p_catatan: catatan || null,
        p_foto_path: fotoPath, p_lat: lat, p_lng: lng, p_kunci_tim: kunciTim, p_perangkat_id: perangkatId(),
        p_foto_langsung: fotoLangsung === true, p_akurasi_meter: akurasi
      };
      // Database yang belum menjalankan schema.sql terbaru belum mengenal parameter
      // baru (error PGRST202). Coba lagi dengan parameter versi sebelumnya.
      const versiLama = [['p_foto_langsung', 'p_akurasi_meter'], ['p_perangkat_id']];
      for (let i = 0; ; i++) {
        try {
          return await rpc('kirim_laporan', args);
        } catch (e) {
          if (e.kode !== 'PGRST202' || i >= versiLama.length) throw e;
          versiLama[i].forEach((k) => delete args[k]);
        }
      }
    }
    // --- mode cadangan: tiru logika fungsi kirim_laporan di database ---
    const p = cacheProyek.find((x) => x.id === proyekId);
    if (!p) throw new Error('Proyek tidak ditemukan');
    const semua = baca(LK);
    let jarak = null, batas = null, verif = false;
    const akurasiBulat = akurasi == null ? null : Math.round(akurasi);
    if (lat != null && lng != null) {
      jarak = Math.round(jarakMeter({ lat, lng }, p));
      batas = batasRadius(p);
      verif = jarak <= batas && fotoLangsung === true && akurasiBulat != null && akurasiBulat <= BATAS_AKURASI_GPS;
    }
    const induk = semua.filter((l) => l.proyek_id === proyekId && l.kondisi === kondisi && !l.induk_kode && !statusTutup(l.status))
      .sort((a, b) => new Date(a.dibuat_pada) - new Date(b.dibuat_pada))[0];
    const kode = kodeLokal();
    const kini = new Date().toISOString();
    semua.push({
      kode, proyek_id: proyekId, kondisi, temuan, catatan: catatan || null, foto_path: fotoPath, jarak_meter: jarak,
      foto_langsung: fotoLangsung === true, akurasi_meter: akurasiBulat,
      terverifikasi: verif, status: induk ? induk.status : 'Diterima', induk_kode: induk ? induk.kode : null,
      jumlah_dukungan: 0, sumber: 'publik', tanggapan: null, foto_sesudah_path: null, dibuat_pada: kini, diperbarui_pada: kini
    });
    // Sama seperti database: hitungan warga hanya naik untuk perangkat baru
    const d = baca(DK), saya = perangkatId();
    if (induk) {
      if (!d.some((x) => x.kode === induk.kode && x.perangkat === saya)) {
        d.push({ kode: induk.kode, perangkat: saya, laporan: kode });
        semua.find((l) => l.kode === induk.kode).jumlah_dukungan += 1;
      }
    } else {
      d.push({ kode, perangkat: saya });
    }
    tulis(DK, d);
    tulis(LK, semua);
    const r = baca(RK);
    r.push({ kode, status: 'Diterima', catatan: induk ? 'Digabung ke kasus ' + induk.kode : 'Laporan masuk', waktu: kini });
    tulis(RK, r);
    return { kode, induk_kode: induk ? induk.kode : null, status: induk ? induk.status : 'Diterima', jarak_meter: jarak, batas_meter: batas,
             terverifikasi: verif, foto_langsung: fotoLangsung === true, akurasi_meter: akurasiBulat, sumber: 'publik' };
  }

  async function dukung(kode) {
    await siap();
    if (mode === 'online') return rpc('dukung', { p_kode: kode, p_perangkat_id: perangkatId() });
    const semua = baca(LK);
    const l = semua.find((x) => x.kode === kode);
    if (!l) throw new Error('Kode tidak ditemukan');
    const kasus = l.induk_kode || l.kode;
    if (statusTutup((semua.find((x) => x.kode === kasus) || l).status)) throw new Error('Kasus ' + kasus + ' sudah ditutup');
    const d = baca(DK);
    const baru = !d.some((x) => x.kode === kasus && x.perangkat === perangkatId());
    if (baru) {
      d.push({ kode: kasus, perangkat: perangkatId() });
      tulis(DK, d);
      semua.find((x) => x.kode === kasus).jumlah_dukungan += 1;
      tulis(LK, semua);
    }
    return { kode: kasus, baru, jumlah_dukungan: semua.find((x) => x.kode === kasus).jumlah_dukungan };
  }

  async function lacak(kode) {
    await siap();
    const k = String(kode || '').trim().toUpperCase();
    let hasil;
    if (mode === 'online') {
      hasil = await rpc('lacak', { p_kode: k });
    } else {
      const semua = baca(LK);
      const l = semua.find((x) => x.kode === k);
      if (!l) return null;
      const kk = l.induk_kode || l.kode;
      const p = cacheProyek.find((x) => x.id === l.proyek_id) || {};
      hasil = {
        laporan: l, kasus: semua.find((x) => x.kode === kk) || l,
        proyek: { id: p.id, nama: p.nama, dinas: p.dinas, kecamatan: p.kecamatan, status_resmi: p.statusResmi },
        riwayat: baca(RK).filter((r) => r.kode === kk), anggota: semua.filter((x) => x.induk_kode === kk).length
      };
    }
    if (!hasil) return null;
    return { ...hasil, laporan: keLaporan(hasil.laporan), kasus: keLaporan(hasil.kasus) };
  }

  async function cekPin(pin) {
    await siap();
    if (mode === 'online') return rpc('cek_pin', { p_pin: pin });
    return pin === cfg.pinDemo ? 'petugas' : null;
  }

  async function perbaruiKasus({ kode, status, pin, catatan = null, fotoSesudahPath = null }) {
    await siap();
    if (mode === 'online') {
      return rpc('perbarui_kasus', { p_kode: kode, p_status: status, p_pin: pin, p_catatan: catatan, p_foto_sesudah_path: fotoSesudahPath });
    }
    if (pin !== cfg.pinDemo) throw new Error('PIN petugas salah');
    const semua = baca(LK);
    const l = semua.find((x) => x.kode === kode);
    if (!l) throw new Error('Kode tidak ditemukan');
    const kasus = l.induk_kode || l.kode;
    const lama = (semua.find((x) => x.kode === kasus) || l).status;
    if (!(ALUR_BOLEH[lama] || []).includes(status)) throw new Error(`Status kasus tidak bisa diubah dari "${lama}" ke "${status}"`);
    if (statusTutup(status) && !(catatan || '').trim()) throw new Error('Catatan untuk pelapor wajib diisi saat menutup atau menolak kasus');
    const kini = new Date().toISOString();
    semua.filter((x) => x.kode === kasus || x.induk_kode === kasus).forEach((x) => {
      x.status = status;
      if (catatan) x.tanggapan = catatan;
      if (fotoSesudahPath) x.foto_sesudah_path = fotoSesudahPath;
      x.diperbarui_pada = kini;
    });
    tulis(LK, semua);
    const r = baca(RK);
    r.push({ kode: kasus, status, catatan: catatan || null, waktu: kini });
    tulis(RK, r);
    return { kode: kasus, status };
  }

  async function hapusLaporan(kode, pin) {
    await siap();
    if (mode === 'online') return rpc('hapus_laporan', { p_kode: kode, p_pin: pin });
    throw new Error('Penghapusan hanya tersedia saat database terhubung');
  }

  return {
    siap, proyek, laporan, riwayat, unggahFoto, kirimLaporan, dukung, lacak, cekPin, perbaruiKasus, hapusLaporan, urlFoto,
    get mode() { return mode; },
    get adaDb() { return adaDb; },
    get urlDb() { return URL_DB; },
    get kunciPublik() { return KUNCI; }
  };
})();
