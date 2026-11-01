siapkanLaporan().then(async () => {
  const proyek = await fetch('data/proyek.json').then((r) => r.json());
  const laporan = ambilLaporan();
  if (laporan.length === 0) {
    document.getElementById('skorKosong').classList.remove('hidden');
    return;
  }

  // Hitung per dinas: total laporan & yang selesai
  const skor = {};
  laporan.forEach((l) => {
    const p = proyek.find((x) => x.id === l.proyekId);
    if (!p) return;
    if (!skor[p.dinas]) skor[p.dinas] = { total: 0, selesai: 0 };
    skor[p.dinas].total++;
    if (l.status === 'Selesai') skor[p.dinas].selesai++;
  });

  const dinas = Object.keys(skor);
  new Chart(document.getElementById('grafikSkor'), {
    type: 'bar',
    data: {
      labels: dinas,
      datasets: [{
        label: '% laporan selesai',
        data: dinas.map((d) => Math.round(skor[d].selesai / skor[d].total * 100))
      }]
    },
    options: { scales: { y: { min: 0, max: 100 } } }
  });
});