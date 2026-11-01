const id = new URLSearchParams(location.search).get('id');
let lokasi = null;
let fotoData = null;
let proyek = null;

fetch('data/proyek.json').then((r) => r.json()).then((data) => {
  proyek = data.find((p) => p.id === id);
});

// Jarak dua titik dalam meter (rumus haversine)
function jarakMeter(a, b) {
  const R = 6371000, rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Perkecil foto (maks. 1000 px, JPEG) supaya muat di localStorage.
// Foto HP bisa 3-5 MB, sedangkan laci localStorage hanya sekitar 5 MB.
function kompresFoto(file, sisiMaks = 1000, mutu = 0.7) {
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
      selesai(kanvas.toDataURL('image/jpeg', mutu));
    };
    gambar.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Foto tidak bisa dibaca')); };
    gambar.src = url;
  });
}

// 1. Pratinjau foto (sudah dikecilkan)
let fotoSiap = Promise.resolve(null);
document.querySelector('[name=foto]').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fotoSiap = kompresFoto(file).then((data) => {
    fotoData = data;
    const img = document.getElementById('pratinjau');
    img.src = fotoData;
    img.classList.remove('hidden');
    return data;
  });
  fotoSiap.catch(() => alert('Foto tidak bisa dibaca. Coba foto lain.'));
});

// 2. Ambil lokasi + cek radius 300 m
document.getElementById('ambilLokasi').addEventListener('click', () => {
  const info = document.getElementById('infoLokasi');
  if (!navigator.geolocation) { info.textContent = 'Browser tidak mendukung lokasi.'; return; }
  if (!window.isSecureContext) { info.textContent = 'Lokasi hanya jalan di HTTPS atau localhost.'; return; }
  info.textContent = 'Mencari lokasi…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lokasi = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!proyek) { info.textContent = 'Lokasi didapat.'; return; }
      const jarak = Math.round(jarakMeter(lokasi, proyek));
      // Titik proyek yang masih "titik tengah kelurahan" belum persis,
      // jadi batas jaraknya dilonggarkan
      const batas = ['titik', 'jalan'].includes(proyek.presisiLokasi) ? 300 : 1500;
      info.textContent = jarak <= batas
        ? `✔ Terverifikasi: kamu ${jarak} m dari proyek (batas ${batas} m).`
        : `⚠ Kamu ${jarak} m dari proyek (lebih dari ${batas} m).`;
    },
    (err) => {
      const pesan = {
        1: 'Izin lokasi ditolak. Klik ikon gembok di kiri alamat > Lokasi > Izinkan, lalu muat ulang.',
        2: 'Lokasi tidak tersedia. Nyalakan Location di Windows atau HP, lalu coba lagi.',
        3: 'Mencari lokasi terlalu lama. Coba lagi, atau pindah ke tempat terbuka.'
      };
      info.textContent = (pesan[err.code] || 'Gagal mengambil lokasi.') +
        ' Laporan tetap bisa dikirim tanpa tanda terverifikasi.';
      console.warn('Geolocation error', err.code, err.message);
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
  );
});

// 3. Simpan laporan + beri kode lacak
document.getElementById('formLapor').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!proyek) { alert('Buka formulir ini dari halaman detail proyek (ada ?id=PRJ-...).'); return; }
  try { await fotoSiap; } catch (err) { return; }   // tunggu foto selesai dikecilkan
  const form = new FormData(e.target);
  const kode = buatKodeLacak();
  const daftar = ambilLaporan();
  daftar.push({
    kode,
    proyekId: id,
    kondisi: form.get('kondisi'),
    catatan: form.get('catatan'),
    foto: fotoData,
    lokasi,
    status: 'Diterima',
    riwayat: [{ status: 'Diterima', waktu: new Date().toISOString() }]
  });
  try { simpanLaporan(daftar); }
  catch (err) { alert('Penyimpanan penuh. Hapus laporan lama lewat Console: localStorage.clear()'); return; }

  e.target.classList.add('hidden');
  const hasil = document.getElementById('hasil');
  hasil.classList.remove('hidden');
  hasil.innerHTML = `Laporan terkirim. Kode lacak kamu: <b class="font-mono">${kode}</b><br>
    <a class="underline" href="lacak.html?kode=${kode}">Lacak sekarang →</a>`;
});