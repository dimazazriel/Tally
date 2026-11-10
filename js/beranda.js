// Beranda: Struk Kota, angka partisipasi, proyek yang perlu dicek, laporan terbaru
(async function () {
  // 1. Struk Kota + meter anggaran dari data APBD (CaLK 2025 & Databoks 2026)
  fetch('data/apbd.json').then((r) => r.json()).then((apbd) => {
    $('#daftar-struk').innerHTML = apbd.belanja.map((b) =>
      `<div class="struk__baris"><dt>${esc(b.bidang)}</dt><dd>${rupiahRingkas(b.nilai)}</dd></div>`
    ).join('') +
      `<div class="struk__baris struk__baris--tebal"><dt>TOTAL BELANJA</dt><dd>${rupiahRingkas(apbd.totalBelanja.realisasi)}</dd></div>`;
    $('#struk-sumber').innerHTML = `Sumber: <a href="${esc(apbd.sumberUrl)}" target="_blank" rel="noopener">CaLK Pemkot Depok TA ${apbd.tahun}</a>, laporan keuangan yang sudah diaudit.`;

    const baris = apbd.anggaranVsRealisasi.map((x) => meter(
      x.jenis + ' 2025', x.persen, `${rupiahRingkas(x.realisasi)} dari ${rupiahRingkas(x.anggaran)}`
    ));
    const t = apbd.tahun2026;
    baris.push(meter('Seluruh belanja 2026 (Jan–Sep)', t.persenRealisasi, `${rupiahRingkas(t.realisasiJanSep)} dari ${rupiahRingkas(t.anggaranBelanja)}`));
    $('#meter-uang').innerHTML = baris.join('') +
      `<p class="sumber">Sumber: <a href="${esc(apbd.sumberUrl)}" target="_blank" rel="noopener">CaLK 2025</a>; <a href="${esc(t.sumberUrl)}" target="_blank" rel="noopener">${esc(t.sumber)}</a>.</p>`;
  }).catch(() => { $('#daftar-struk').innerHTML = '<p class="galat">Data APBD gagal dimuat. Muat ulang halaman.</p>'; });

  function meter(label, pct, ket) {
    return `<div class="meter">
      <div class="meter__kepala"><span>${esc(label)}</span><b>${persen(pct, 2)}</b></div>
      <div class="meter__jalur" role="img" aria-label="${esc(label)}: ${persen(pct, 2)} terealisasi"><div class="meter__isi" style="width:${Math.min(100, pct)}%"></div></div>
      <div class="meter__ket">${esc(ket)}</div>
    </div>`;
  }

  // 2. Data proyek dan laporan
  let proyek = [], laporan = [];
  try {
    [proyek, laporan] = await Promise.all([Data.proyek(), Data.laporan()]);
  } catch (e) {
    console.error(e);
    const pesan = `<p class="galat">${ikon('peringatan')}Data proyek gagal dimuat: ${esc(e.message)}. Muat ulang halaman.</p>`;
    $('#misi').innerHTML = pesan;
    $('#galeri').innerHTML = '';
    ['#nota-proyek', '#nota-laporan', '#nota-tindak'].forEach((s) => ($(s).textContent = '—'));
    return;
  }
  const kasus = kelompokkanKasus(laporan.filter((l) => l.status !== 'Ditolak'));
  const kasusMasalah = kasus.filter((k) => kondisiMasalah(k.kondisi));
  const ditindak = kasusMasalah.filter((k) => ['Ditindaklanjuti', 'Selesai'].includes(k.status));
  $('#nota-proyek').textContent = proyek.length;
  $('#nota-laporan').textContent = angka(laporan.filter((l) => l.status !== 'Ditolak').length);
  $('#nota-tindak').textContent = kasusMasalah.length ? `${ditindak.length}/${kasusMasalah.length}` : '0';

  // 3. Proyek yang perlu dicek: urutkan berdasarkan bobot sinyal
  const bobot = { hps: 3, belum: 1, lokasi: 1, penyedia: 1 };
  const kandidat = proyek.map((p) => {
    const lp = laporan.filter((l) => l.proyekId === p.id);
    const s = sinyalProyek(p, proyek, lp);
    return { p, s, skor: s.reduce((a, x) => a + (bobot[x.kunci] || 0), 0), st: statusLapangan(lp) };
  }).filter((x) => x.st.kunci !== 'cocok').sort((a, b) => b.skor - a.skor || (b.p.pagu - a.p.pagu)).slice(0, 4);

  $('#misi').innerHTML = kandidat.length ? kandidat.map(({ p, s, st }) => {
    const utama = s[0] || { judul: 'Belum ada laporan warga' };
    return `<article class="misi__item ${utama.kunci === 'hps' ? '' : 'misi__item--info'}">
      <div>
        <div class="baris" style="gap:8px;margin-bottom:6px">
          <span class="lencana ${utama.kunci === 'hps' ? 'lencana--cek' : 'lencana--cap'}">${ikon(utama.kunci === 'hps' ? 'peringatan' : 'info')}${esc(utama.judul)}</span>
          ${st.kunci === 'tidak' ? '<span class="lencana lencana--tidak">' + ikon('peringatan') + 'Ada laporan tidak cocok</span>' : ''}
        </div>
        <h3>${esc(p.nama)}</h3>
        <p>${esc(p.id)} · Kec. ${esc(p.kecamatan)} · kontrak ${rupiahRingkas(p.nilaiKontrak ?? p.pagu)}${p.penyedia ? ' · ' + esc(p.penyedia) : ''}</p>
      </div>
      <a class="tombol tombol--garis" href="detail.html?id=${encodeURIComponent(p.id)}">Lihat struknya</a>
    </article>`;
  }).join('') : '<div class="kosong"><h3>Semua proyek sudah dicek warga</h3><p>Terima kasih. Lihat peta untuk memantau tindak lanjutnya.</p></div>';

  // 4. Galeri laporan terbaru yang punya foto
  const berfoto = laporan.filter((l) => l.fotoUrl && l.status !== 'Ditolak').slice(0, 6);
  const namaProyek = (id) => (proyek.find((p) => p.id === id) || {}).nama || id;
  $('#galeri').innerHTML = berfoto.length ? berfoto.map((l) => `
    <figure class="foto-laporan">
      <img src="${esc(l.fotoUrl)}" alt="Foto laporan ${esc(l.kondisi)} di ${esc(namaProyek(l.proyekId))}" loading="lazy" width="400" height="300">
      <figcaption>
        <div class="baris" style="gap:6px">${lencanaKondisi(l.kondisi)}${l.terverifikasi ? '<span class="lencana lencana--cocok">' + ikon('centang') + 'Terverifikasi</span>' : ''}</div>
        <a href="detail.html?id=${encodeURIComponent(l.proyekId)}">${esc(namaProyek(l.proyekId))}</a>
        <span class="pudar" style="font-size:var(--t-xs)">${esc(l.kode)} · ${sejak(l.dibuatPada)}</span>
      </figcaption>
    </figure>`).join('') : `
    <div class="kosong" style="grid-column:1/-1">
      <h3>Belum ada foto dari lapangan</h3>
      <p>Laporan pertama akan muncul di sini lengkap dengan fotonya. Pilih satu proyek di dekatmu dan cocokkan dengan struknya.</p>
      <a class="tombol" href="peta.html">${ikon('peta')}Pilih proyek di peta</a>
    </div>`;
})();
