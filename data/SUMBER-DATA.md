# Sumber Data Wujud — Kota Depok

Semua angka di folder `data/` diambil dari sumber resmi atau berita yang bisa dicek ulang. Diakses 24 Oktober 2026.

## 1. `apbd.json` — Struk Kota

| Isi | Sumber |
|---|---|
| Realisasi belanja 2025 per jenis (pegawai, barang & jasa, modal per jenis aset, hibah, bansos, tak terduga, subsidi) | CaLK Pemkot Depok TA 2025 (laporan keuangan yang sudah diaudit), PPID Kota Depok: https://ppid.depok.go.id/wp-content/uploads/2026/08/2.-CALK-2025.pdf |
| Anggaran vs realisasi pendapatan & belanja 2025, SiLPA 2025 | Dokumen CaLK yang sama |
| Anggaran belanja 2026 (Rp4.387,78 miliar) dan realisasi Jan–Sep 2026 | Databoks Katadata, 7 Sep 2026: https://databoks.katadata.co.id/datapublish/2026/09/07/realisasi-belanja-daerah-pemkot-depok-per-september-2026 |

Cek: jumlah 11 baris `belanja` = Rp4.156.197.412.994,37, sama persis dengan total realisasi belanja 2025 di CaLK.

Catatan: CaLK tidak memuat rincian belanja per dinas atau per urusan (pendidikan, kesehatan, dll). Karena itu Struk Kota memakai rincian **per jenis belanja**, bukan per bidang.

## 2. `proyek.json` — Peta & Struk Proyek (24 proyek)

- **21 proyek dari LPSE Kota Depok** (https://spse.inaproc.id/depok). Nama paket, satuan kerja, pagu, HPS, pemenang, nilai kontrak, kode tender, dan kode RUP diambil dari halaman pengumuman, pemenang, dan pemenang berkontrak tiap tender. Link sumber ada di `sumberUrl` tiap proyek.
- **3 proyek jalan/drainase DPUPR 2026 dari berita** (detikNews dan JPNN Jabar). Nama penyedianya tidak disebut di berita dan tidak ditemukan di daftar tender LPSE 2026, jadi `penyedia` dibiarkan `null`.

Arti field yang mungkin membingungkan:

| Field | Arti |
|---|---|
| `pagu` | Batas anggaran paket |
| `hps` | Harga Perkiraan Sendiri, perkiraan harga dari pemerintah sebelum tender |
| `nilaiKontrak` | Harga yang disepakati dengan pemenang. `null` = belum tayang di LPSE |
| `statusResmi` | Status menurut sumber resmi: "Berkontrak" (LPSE) atau "Berjalan" (berita) |
| `presisiLokasi` | `titik` = lokasi bangunan dari OpenStreetMap; `jalan` = ruas jalannya; `kelurahan`/`kecamatan` = titik tengah wilayah, **belum titik persis** |

Koordinat diambil dari OpenStreetMap (Nominatim). Proyek dengan presisi `kelurahan`/`kecamatan` sebaiknya dikoreksi setelah survei lapangan atau dicek di Google Maps.

## 3. `lpse-depok-tender-2025-2026.json` — data mentah

Seluruh 241 paket tender LPSE Kota Depok tahun anggaran 2025 dan 2026 (konstruksi dan konsultansi): kode, nama, tahap, HPS, nilai kontrak. Dipakai kalau tim mau menambah proyek atau membuat statistik (misalnya jumlah tender gagal/ulang).

## 4. Yang TIDAK boleh dikarang

- **Laporan warga.** Jangan membuat laporan contoh fiktif. Mulai dari kosong, lalu tim mengunjungi 3–5 proyek di daftar ini dan mengirim laporan asli (foto + GPS) lewat formulir Wujud. Itu sekaligus jadi bahan video demo.
- **Status "Lapangan".** Hanya boleh berasal dari laporan nyata.
- **Penilaian penyedia.** Wujud menampilkan data, bukan tuduhan. Kalau ada pola menarik (misalnya satu penyedia memenangkan beberapa paket), tampilkan sebagai fakta beserta sumbernya, tanpa kesimpulan.

## 5. Cara cek ulang sendiri (LPSE)

1. Buka https://spse.inaproc.id/depok/lelang
2. Pilih Tahun Anggaran 2025 atau 2026, Jenis Pengadaan "Pekerjaan Konstruksi".
3. Ketik nama paket di kotak Cari, klik nama paketnya.
4. Tab **Pengumuman** = pagu, HPS, satker, lokasi. Tab **Pemenang Berkontrak** = penyedia dan harga kontrak.
