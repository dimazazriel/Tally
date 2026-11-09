// =====================================================================
// util.js — fungsi bantu yang dipakai semua halaman
// =====================================================================

// ---------- Format angka & waktu ----------

// rupiah(3950000000) → "Rp3.950.000.000"
const rupiah = (n) =>
  n == null ? '—' : 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);

// Angka yang belum tersedia (null) ditampilkan dengan keterangan
const rupiahAtau = (n, kosong = 'belum tayang') => (n == null ? kosong : rupiah(n));

// rupiahRingkas(4156197412994) → "Rp4,16 T"
function rupiahRingkas(n) {
  if (n == null) return '—';
  const f = (x, d) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }).format(x);
  if (n >= 1e12) return 'Rp' + f(n / 1e12, 2) + ' T';
  if (n >= 1e9) return 'Rp' + f(n / 1e9, 1) + ' M';
  if (n >= 1e6) return 'Rp' + f(n / 1e6, 1) + ' jt';
  return rupiah(n);
}

const angka = (n, d = 0) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
const persen = (n, d = 1) => (n == null || !isFinite(n) ? '—' : angka(n, d) + '%');

function tanggal(iso, denganJam = true) {
  if (!iso) return '—';
  const opsi = { day: 'numeric', month: 'short', year: 'numeric' };
  if (denganJam) Object.assign(opsi, { hour: '2-digit', minute: '2-digit' });
  return new Date(iso).toLocaleString('id-ID', opsi);
}

// sejak("2026-11-08T10:00:00Z") → "2 hari lalu"
function sejak(iso) {
  if (!iso) return '';
  const detik = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return Math.floor(detik / 60) + ' menit lalu';
  if (detik < 86400) return Math.floor(detik / 3600) + ' jam lalu';
  return Math.floor(detik / 86400) + ' hari lalu';
}

const jarakTeks = (m) => (m == null ? 'tanpa lokasi' : m < 1000 ? m + ' m' : angka(m / 1000, 1) + ' km');

// Amankan teks buatan pengguna sebelum dimasukkan ke HTML (cegah XSS)
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const $ = (sel, akar = document) => akar.querySelector(sel);
const $$ = (sel, akar = document) => [...akar.querySelectorAll(sel)];
const ikon = (nama, kelas = 'ikon') => `<svg class="${kelas}" aria-hidden="true"><use href="#i-${nama}"></use></svg>`;
const param = (nama) => new URLSearchParams(location.search).get(nama);

// Notifikasi kecil di bawah layar
function notif(teks) {
  let el = $('#notif');
  if (!el) {
    el = document.createElement('div');
    el.id = 'notif';
    el.className = 'notif';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = teks;
  el.classList.add('tampil');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('tampil'), 2600);
}

async function salin(teks) {
  try { await navigator.clipboard.writeText(teks); notif('Tersalin: ' + teks); }
  catch (e) { notif('Gagal menyalin. Salin manual: ' + teks); }
}

const linkWhatsApp = (teks) => 'https://wa.me/?text=' + encodeURIComponent(teks);
const urlSitus = (jalur) => new URL(jalur, location.href).href;

// ID acak per perangkat untuk "Saya juga lihat ini" (bukan identitas pribadi)
function perangkatId() {
  let id = null;
  try { id = localStorage.getItem('tally_perangkat'); } catch (e) {}
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
    try { localStorage.setItem('tally_perangkat', id); } catch (e) {}
  }
  return id;
}

// ---------- Kosakata Tally ----------

const KONDISI = [
  { nama: 'Sesuai', masalah: false, ket: 'Proyek ada dan kondisinya sesuai data resmi.' },
  { nama: 'Sedang dikerjakan', masalah: false, ket: 'Ada pekerjaan berjalan di lokasi.' },
  { nama: 'Belum dikerjakan', masalah: true, ket: 'Belum ada tanda pekerjaan padahal kontrak sudah jalan.' },
  { nama: 'Terbengkalai', masalah: true, ket: 'Pekerjaan berhenti, material atau bangunan dibiarkan.' },
  { nama: 'Rusak setelah selesai', masalah: true, ket: 'Sudah jadi, tetapi cepat rusak.' }
];
const kondisiMasalah = (k) => (KONDISI.find((x) => x.nama === k) || {}).masalah === true;

const TEMUAN = [
  'Tidak ada pekerja di lokasi',
  'Material dibiarkan menumpuk',
  'Tidak ada papan proyek',
  'Retak atau berlubang',
  'Saluran mampet atau tergenang',
  'Pekerjaan tampak rapi dan selesai'
];

const ALUR_STATUS = ['Diterima', 'Diverifikasi', 'Diteruskan ke dinas', 'Ditindaklanjuti', 'Selesai'];
const KET_STATUS = {
  'Diterima': 'Laporan masuk ke sistem',
  'Diverifikasi': 'Foto dan lokasi dicek petugas',
  'Diteruskan ke dinas': 'Dikirim ke dinas penanggung jawab',
  'Ditindaklanjuti': 'Dinas mulai menangani',
  'Selesai': 'Ditangani, disertai tanggapan atau foto sesudah',
  'Ditolak': 'Tidak bisa diproses; alasannya ada di catatan petugas'
};
const statusTutup = (s) => s === 'Selesai' || s === 'Ditolak';

function lencanaStatus(status) {
  const kelas = status === 'Selesai' ? 'cocok' : status === 'Ditolak' ? 'tidak' : status === 'Diterima' ? '' : 'cap';
  const ik = status === 'Selesai' ? 'centang' : status === 'Ditolak' ? 'silang' : 'jam';
  return `<span class="lencana ${kelas ? 'lencana--' + kelas : ''}">${ikon(ik)}${esc(status)}</span>`;
}

function lencanaKondisi(kondisi) {
  const masalah = kondisiMasalah(kondisi);
  return `<span class="lencana ${masalah ? 'lencana--tidak' : 'lencana--cocok'}">${ikon(masalah ? 'peringatan' : 'centang')}${esc(kondisi)}</span>`;
}

// ---------- Logika kasus ----------

// Kelompokkan laporan jadi kasus: induk + anggota (laporan yang digabung)
function kelompokkanKasus(laporan) {
  const peta = new Map();
  laporan.filter((l) => !l.indukKode).forEach((l) => peta.set(l.kode, { ...l, anggota: [] }));
  laporan.filter((l) => l.indukKode).forEach((l) => {
    const induk = peta.get(l.indukKode);
    if (induk) induk.anggota.push(l);
    else peta.set(l.kode, { ...l, anggota: [] });   // induknya terhapus: berdiri sendiri
  });
  return [...peta.values()].sort((a, b) => new Date(b.dibuatPada) - new Date(a.dibuatPada));
}

// Status lapangan sebuah proyek → stempel
function statusLapangan(laporanProyek) {
  const aktif = laporanProyek.filter((l) => l.status !== 'Ditolak');
  if (!aktif.length) return { kunci: 'belum', label: 'Belum dicek', kelas: 'belum' };
  const kasus = kelompokkanKasus(aktif);
  const terbuka = kasus.filter((k) => kondisiMasalah(k.kondisi) && !statusTutup(k.status));
  if (terbuka.length) return { kunci: 'tidak', label: 'Tidak cocok', kelas: 'tidak', terbuka };
  return { kunci: 'cocok', label: 'Cocok', kelas: 'cocok' };
}

function stempelHTML(st, besar = false, hentak = false) {
  const kelas = st.kunci === 'tidak' ? 'stempel--tidak' : st.kunci === 'cocok' ? 'stempel--cocok' : '';
  const sub = st.kunci === 'belum' ? 'menunggu warga' : 'hasil cek warga';
  return `<span class="stempel ${kelas} ${besar ? 'stempel--besar' : ''} ${hentak ? 'stempel--hentak' : ''}" role="img" aria-label="Status lapangan: ${esc(st.label)}">${esc(st.label)}<small>${sub}</small></span>`;
}

// Hari berjalan sejak kasus masuk, berhenti saat ditutup
function infoSla(kasus, riwayatKasus = []) {
  const batas = (window.TALLY_CONFIG || {}).batasHariSla || 7;
  const mulai = new Date(kasus.dibuatPada);
  const tutup = statusTutup(kasus.status)
    ? new Date((riwayatKasus.filter((r) => statusTutup(r.status)).pop() || {}).waktu || kasus.diperbaruiPada || Date.now())
    : new Date();
  const hari = Math.max(0, Math.floor((tutup - mulai) / 86400000));
  return { hari, batas, lewat: !statusTutup(kasus.status) && hari > batas, selesai: statusTutup(kasus.status) };
}

// ---------- Sinyal data: alasan sebuah proyek layak dicek ----------
function sinyalProyek(p, semuaProyek = [], laporanProyek = []) {
  const s = [];
  if (p.nilaiKontrak && p.hps && p.nilaiKontrak / p.hps < 0.8) {
    s.push({
      kunci: 'hps',
      judul: 'Kontrak ' + persen((p.nilaiKontrak / p.hps) * 100) + ' dari HPS',
      teks: 'Di bawah batas 80% HPS. Aturan pengadaan meminta evaluasi kewajaran harga untuk penawaran serendah ini, karena berisiko pada mutu. Ini sinyal untuk dicek, bukan tuduhan.'
    });
  }
  if (p.presisiLokasi === 'kelurahan' || p.presisiLokasi === 'kecamatan') {
    s.push({
      kunci: 'lokasi',
      judul: 'Titik lokasi masih perkiraan',
      teks: 'Data publik hanya menyebut ' + p.presisiLokasi + '-nya. Laporan dari lokasi sebenarnya membantu memperbaiki titik ini.'
    });
  }
  if (p.penyedia) {
    const lain = semuaProyek.filter((x) => x.id !== p.id && x.penyedia === p.penyedia);
    if (lain.length) s.push({
      kunci: 'penyedia',
      judul: 'Penyedia memenangkan ' + (lain.length + 1) + ' paket di daftar ini',
      teks: p.penyedia + ' juga mengerjakan ' + lain.map((x) => x.id).join(', ') + '. Ditampilkan sebagai fakta dari LPSE, tanpa kesimpulan.'
    });
  }
  if (!laporanProyek.filter((l) => l.status !== 'Ditolak').length) {
    s.push({ kunci: 'belum', judul: 'Belum ada laporan warga', teks: 'Jadilah orang pertama yang mencocokkan proyek ini dengan kondisi di lapangan.' });
  }
  return s;
}

// ---------- Kompres foto sebelum diunggah ----------
function kompresFoto(file, sisiMaks = 1280, mutu = 0.78) {
  return new Promise((selesai, gagal) => {
    const url = URL.createObjectURL(file);
    const gambar = new Image();
    gambar.onload = () => {
      const skala = Math.min(1, sisiMaks / Math.max(gambar.width, gambar.height));
      const kanvas = document.createElement('canvas');
      kanvas.width = Math.round(gambar.width * skala);
      kanvas.height = Math.round(gambar.height * skala);
      kanvas.getContext('2d').drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
      URL.revokeObjectURL(url);
      kanvas.toBlob((blob) => (blob ? selesai(blob) : gagal(new Error('Foto tidak bisa diproses'))), 'image/jpeg', mutu);
    };
    gambar.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('File ini bukan foto yang bisa dibaca')); };
    gambar.src = url;
  });
}

const blobKeDataUrl = (blob) => new Promise((ok, gagal) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = gagal;
  r.readAsDataURL(blob);
});

// Jarak dua titik dalam meter (rumus haversine), dipakai untuk pratinjau
function jarakMeter(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const batasRadius = (p) => (p.presisiLokasi === 'titik' || p.presisiLokasi === 'jalan' ? 300 : 1500);

// Lapisan peta dasar (CARTO Positron), otomatis pindah ke OSM bila gagal
function lapisanPeta(peta) {
  const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  });
  let gagal = 0;
  carto.on('tileerror', () => {
    if (++gagal === 4) {
      peta.removeLayer(carto);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(peta);
    }
  });
  carto.addTo(peta);
}

function pinPeta(st, presisi, aktif = false) {
  const kira = presisi === 'kelurahan' || presisi === 'kecamatan';
  const ik = st.kunci === 'tidak' ? 'peringatan' : st.kunci === 'cocok' ? 'centang' : 'tanya';
  return L.divIcon({
    className: '',
    html: `<span class="pin pin--${st.kunci} ${kira ? 'pin--kira' : ''} ${aktif ? 'pin--aktif' : ''}"><span class="pin__tubuh"></span>${ikon(ik)}</span>`,
    iconSize: [30, 40], iconAnchor: [15, 34], popupAnchor: [0, -30]
  });
}
// Penanda bermasalah selalu tampil di atas penanda lain di titik yang sama
const zPin = (st, aktif) => (aktif ? 3000 : st.kunci === 'tidak' ? 2000 : st.kunci === 'cocok' ? 1000 : 0);
