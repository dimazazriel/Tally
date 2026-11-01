const TAHAP = ['Diterima', 'Diverifikasi', 'Diteruskan ke dinas', 'Ditindaklanjuti', 'Selesai'];
const SLA_HARI = 7;

function tampilkanLacak(kode) {
  const wadah = document.getElementById('linimasa');
  const l = ambilLaporan().find((x) => x.kode === kode.trim().toUpperCase());
  if (!l) { wadah.textContent = 'Kode tidak ditemukan.'; return; }

  const umurHari = Math.floor((Date.now() - new Date(l.riwayat[0].waktu)) / 86400000);
  const sisa = SLA_HARI - umurHari;
  const infoSla = sisa >= 0
    ? `sisa ${sisa} hari dari batas ${SLA_HARI} hari`
    : `<span class="text-red-700">lewat ${-sisa} hari dari batas</span>`;

  wadah.innerHTML = `
    <p class="mb-3">Status: <b>${l.status}</b> · ${infoSla}</p>
    <ol class="border-l-2 pl-4 space-y-2">
      ${TAHAP.map((t) => {
        const r = l.riwayat.find((x) => x.status === t);
        return `<li class="${r ? '' : 'opacity-40'}"><b>${t}</b>
          ${r ? ' — ' + new Date(r.waktu).toLocaleString('id-ID') : ''}</li>`;
      }).join('')}
    </ol>`;
}

document.getElementById('formLacak').addEventListener('submit', (e) => {
  e.preventDefault();
  tampilkanLacak(document.getElementById('kode').value);
});

// Kalau datang dari tautan "Lacak sekarang", langsung tampilkan
const kodeDariLink = new URLSearchParams(location.search).get('kode');
if (kodeDariLink) {
  document.getElementById('kode').value = kodeDariLink;
  tampilkanLacak(kodeDariLink);
}