// Titik tengah awal peta [lat, lng] dan level zoom
const peta = L.map('peta').setView([-6.395, 106.81], 12); // seluruh Kota Depok

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(peta);

let semuaProyek = [];
const lapisanTitik = L.layerGroup().addTo(peta);

function tampilkan(daftar) {
  lapisanTitik.clearLayers();
  daftar.forEach((p) => {
    L.marker([p.lat, p.lng])
      .bindPopup(`<b>${p.nama}</b><br>
        ${p.dinas} · ${p.tahun}<br>
        Kontrak: ${rupiahAtau(p.nilaiKontrak)}<br>
        <a href="detail.html?id=${p.id}">Lihat struk proyek →</a>`)
      .addTo(lapisanTitik);
  });
}

function saring() {
  const sektor = document.getElementById('filterSektor').value;
  const tahun = document.getElementById('filterTahun').value;
  const kata = document.getElementById('cari').value.toLowerCase();
  tampilkan(semuaProyek.filter((p) =>
    (sektor === 'Semua' || p.sektor === sektor) &&
    (tahun === 'Semua' || String(p.tahun) === tahun) &&
    p.nama.toLowerCase().includes(kata)
  ));
}

fetch('data/proyek.json')
  .then((res) => res.json())
  .then((data) => { semuaProyek = data; tampilkan(data); });

document.getElementById('filterSektor').addEventListener('change', saring);
document.getElementById('filterTahun').addEventListener('change', saring);
document.getElementById('cari').addEventListener('input', saring);