// Papan skor: hitung kasus per dinas / kecamatan / penyedia
(async function () {
  let proyek = [], laporan = [], riwayat = [];
  try {
    [proyek, laporan, riwayat] = await Promise.all([Data.proyek(), Data.laporan(), Data.riwayat()]);
  } catch (e) {
    $('#isi-tabel').innerHTML = `<tr><td colspan="6"><p class="galat">${ikon('peringatan')}Data gagal dimuat: ${esc(e.message)}</p></td></tr>`;
    return;
  }
  const proyekById = new Map(proyek.map((p) => [p.id, p]));
  const kasus = kelompokkanKasus(laporan).filter((k) => kondisiMasalah(k.kondisi) && k.status !== 'Ditolak');

  // Hari respons: dari masuk sampai pertama kali Ditindaklanjuti/Selesai
  const respons = (k) => {
    const r = riwayat.find((x) => x.kode === k.kode && (x.status === 'Ditindaklanjuti' || x.status === 'Selesai'));
    return r ? (new Date(r.waktu) - new Date(k.dibuatPada)) / 86400000 : null;
  };
  const lewat = (k) => infoSla(k, riwayat.filter((r) => r.kode === k.kode)).lewat;

  const rata = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const semuaRespons = kasus.map(respons).filter((x) => x != null);
  const selesai = kasus.filter((k) => k.status === 'Selesai');
  const isi = [
    angka(laporan.filter((l) => l.status !== 'Ditolak').length),
    angka(kasus.length),
    kasus.length ? persen((selesai.length / kasus.length) * 100, 0) : '—',
    semuaRespons.length ? angka(rata(semuaRespons), 1) : '—',
    angka(kasus.filter(lewat).length)
  ];
  $$('#ringkas b').forEach((b, i) => (b.textContent = isi[i]));
  $('#ajak').hidden = kasus.length >= 5;

  const LABEL = { dinas: 'Dinas', kecamatan: 'Kecamatan', penyedia: 'Penyedia' };
  function render(kelompok) {
    $('#judul-kelompok').textContent = LABEL[kelompok].toLowerCase();
    $('#kolom-nama').textContent = LABEL[kelompok];
    const kunci = (p) => (kelompok === 'kecamatan' ? 'Kec. ' + p.kecamatan : p[kelompok] || 'Tidak tercantum di sumber');
    const grup = new Map();
    proyek.forEach((p) => {
      const g = grup.get(kunci(p)) || { nama: kunci(p), proyek: 0, kasus: [] };
      g.proyek++;
      grup.set(g.nama, g);
    });
    kasus.forEach((k) => {
      const p = proyekById.get(k.proyekId);
      if (p) grup.get(kunci(p)).kasus.push(k);
    });
    const baris = [...grup.values()].map((g) => {
      const s = g.kasus.filter((k) => k.status === 'Selesai').length;
      const r = rata(g.kasus.map(respons).filter((x) => x != null));
      return { ...g, selesai: s, pct: g.kasus.length ? (s / g.kasus.length) * 100 : null, respons: r, lewat: g.kasus.filter(lewat).length };
    }).sort((a, b) => (b.kasus.length > 0) - (a.kasus.length > 0) || (b.pct ?? -1) - (a.pct ?? -1) || b.kasus.length - a.kasus.length || b.proyek - a.proyek);

    $('#isi-tabel').innerHTML = baris.map((g) => `
      <tr>
        <th scope="row" style="font-size:var(--t-s);color:var(--tinta);background:none;white-space:normal">${esc(g.nama)}</th>
        <td class="kanan angka">${g.proyek}</td>
        <td class="kanan angka">${g.kasus.length || '<span class="pudar">0</span>'}</td>
        <td>${g.kasus.length
          ? `<div class="batang"><div class="meter__jalur" role="img" aria-label="${persen(g.pct, 0)} kasus selesai"><div class="meter__isi" style="width:${g.pct}%"></div></div><b>${persen(g.pct, 0)}</b></div>`
          : '<span class="pudar" style="font-size:var(--t-xs)">belum ada kasus</span>'}</td>
        <td class="kanan angka">${g.respons != null ? angka(g.respons, 1) + ' hari' : '<span class="pudar">—</span>'}</td>
        <td class="kanan angka">${g.lewat ? `<span class="lencana lencana--tidak">${ikon('jam')}${g.lewat}</span>` : '<span class="pudar">0</span>'}</td>
      </tr>`).join('');
  }

  $$('.tab button').forEach((b) => b.addEventListener('click', () => {
    $$('.tab button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render(b.dataset.kelompok);
  }));
  render('dinas');
})();
