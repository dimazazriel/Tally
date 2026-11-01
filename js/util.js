// Format angka jadi Rupiah: rupiah(3950000000) → "Rp 3.950.000.000"
const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

// Ambil semua laporan dari localStorage (kosong → [])
function ambilLaporan() {
  try { return JSON.parse(localStorage.getItem('wujud_laporan')) || []; }
  catch (e) { return []; }
}

// Simpan semua laporan ke localStorage
function simpanLaporan(daftar) {
  localStorage.setItem('wujud_laporan', JSON.stringify(daftar));
}

// Buat kode lacak acak, contoh: WJD-7K2Q
function buatKodeLacak() {
  return 'WJD-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Siapkan laci laporan kosong. Tidak ada laporan contoh:
// semua laporan harus berasal dari kunjungan lapangan yang nyata.
async function siapkanLaporan() {
  if (!localStorage.getItem('wujud_laporan')) simpanLaporan([]);
}

// Angka yang belum tersedia (null) ditampilkan dengan keterangan
const rupiahAtau = (n, kosong = 'belum tayang') => (n == null ? kosong : rupiah(n));