const TAHAP = ['Diterima', 'Diverifikasi', 'Diteruskan ke dinas', 'Ditindaklanjuti', 'Selesai'];

function render() {
  const daftar = ambilLaporan();
  document.getElementById('tabelLaporan').innerHTML = daftar.map((l, i) => `
    <tr class="border-b">
      <td class="p-2 font-mono">${l.kode}</td>
      <td class="p-2">${l.proyekId}</td>
      <td class="p-2">${l.kondisi}</td>
      <td class="p-2">
        <select data-i="${i}" class="border rounded p-1">
          ${TAHAP.map((t) => `<option ${t === l.status ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('');
}

document.getElementById('tabelLaporan').addEventListener('change', (e) => {
  const i = e.target.dataset.i;
  const daftar = ambilLaporan();
  daftar[i].status = e.target.value;
  daftar[i].riwayat.push({ status: e.target.value, waktu: new Date().toISOString() });
  simpanLaporan(daftar);
  render();
});

siapkanLaporan().then(render);

// Blob = "file sementara" yang dibuat di memori browser, lalu diunduh
document.getElementById('ekspor').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(ambilLaporan(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'laporan.json';
  a.click();
});