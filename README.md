# wujud

Wujud menghubungkan data anggaran proyek pemerintah dengan bukti lapangan dari warga, lalu melacak tindak lanjutnya sampai selesai.

**Demo:** https://dimazazriel.github.io/wujud/

## Tech stack
- HTML, JavaScript, Tailwind CSS (CDN)
- Leaflet.js + OpenStreetMap — peta proyek
- Chart.js — grafik Struk Kota & Papan Skor
- JSON + localStorage — penyimpanan data

## Cara menjalankan
1. Clone repo: `git clone https://github.com/dimazazriel/wujud.git`
2. Install: tidak perlu, semua library dimuat lewat CDN.
3. Run: buka folder di VS Code → klik kanan `index.html` → **Open with Live Server**.

## Sitemap
```mermaid
flowchart TD
  B[Beranda] --> P[Peta Proyek] --> D[Detail Proyek] --> F[Formulir Lapor] --> L[Lacak Laporan]
  B --> S[Papan Skor]
  B --> T[Tentang]

  ## Sitemap
```mermaid
flowchart TD
  B[Beranda] --> P[Peta Proyek] --> D[Detail Proyek] --> F[Formulir Lapor] --> L[Lacak Laporan]
  B --> S[Papan Skor]
  B --> T[Tentang]

  ## Catatan data
- Realisasi APBD 2025: CaLK Pemerintah Kota Depok TA 2025 (PPID Kota Depok)
- 21 proyek: LPSE Kota Depok (spse.inaproc.id/depok), 3 proyek jalan/drainase: berita resmi DPUPR
- Laporan warga: hasil kunjungan lapangan tim
Rincian lengkap ada di data/SUMBER-DATA.md.

## Tim
- Atilla — UI & Beranda
- Naufal — Peta & Logika
- Dimaz — Data & Cerita