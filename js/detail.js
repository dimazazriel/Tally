const id = new URLSearchParams(location.search).get('id');

fetch('data/proyek.json')
  .then((res) => res.json())
  .then((data) => {
    const wadah = document.getElementById('struk');
    const p = data.find((x) => x.id === id);
    if (!p) { wadah.textContent = 'Proyek tidak ditemukan.'; return; }

    // Ada laporan warga yang bilang "tidak sesuai"?
    const laporan = ambilLaporan().filter((l) => l.proyekId === id);
    const bermasalah = laporan.some((l) => l.kondisi !== 'Sesuai');

    wadah.innerHTML = `
      <p class="font-mono text-xs tracking-widest text-slate-500">STRUK PROYEK · ${p.id}</p>
      <h1 class="text-2xl font-extrabold mt-1">${p.nama}</h1>
      <dl class="font-mono text-sm mt-4 space-y-1">
        <div class="flex justify-between border-b border-dashed"><dt>Pagu</dt><dd>${rupiah(p.pagu)}</dd></div>
        <div class="flex justify-between border-b border-dashed"><dt>HPS</dt><dd>${rupiahAtau(p.hps, '—')}</dd></div>
        <div class="flex justify-between border-b border-dashed"><dt>Nilai kontrak</dt><dd>${rupiahAtau(p.nilaiKontrak)}</dd></div>
        <div class="flex justify-between border-b border-dashed"><dt>Penyedia</dt><dd>${p.penyedia || 'tidak tercantum di sumber'}</dd></div>
        <div class="flex justify-between border-b border-dashed"><dt>Dinas</dt><dd>${p.dinas}</dd></div>
        <div class="flex justify-between border-b border-dashed"><dt>Jadwal</dt><dd>${p.jadwal}</dd></div>
        ${p.nilaiKontrak ? `<div class="flex justify-between font-bold border-t-2 border-slate-900 pt-1">
          <dt>SELISIH PAGU</dt><dd>${rupiah(p.pagu - p.nilaiKontrak)}</dd></div>` : ''}
      </dl>
      <p class="text-xs text-slate-500 mt-2">
        Sumber: <a class="underline" target="_blank" href="${p.sumberUrl}">${p.sumber}</a>
        ${p.kodeTender ? ' · Kode tender ' + p.kodeTender : ''}<br>
        Lokasi di peta: ${p.catatanLokasi}
      </p>
      <p class="mt-4 p-3 rounded ${bermasalah ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
        Resmi: <b>${p.statusResmi}</b> · Lapangan:
        <b>${bermasalah ? laporan.length + ' laporan tidak sesuai' : 'belum ada masalah'}</b>
      </p>
      <a href="lapor.html?id=${p.id}" class="inline-block mt-4 bg-slate-900 text-white px-4 py-2 rounded">
        Laporkan kondisi di lapangan
      </a>`;
  });