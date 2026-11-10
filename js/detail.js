// Detail proyek: struk resmi (kata dokumen) vs laporan warga (kata warga)
(async function () {
  const id = param('id');
  let proyek = [], laporan = [];
  try {
    [proyek, laporan] = await Promise.all([Data.proyek(), Data.laporan()]);
  } catch (e) {
    $('#kepala-proyek').innerHTML += `<p class="galat">${ikon('peringatan')}Data gagal dimuat: ${esc(e.message)}</p>`;
    return;
  }
  const p = proyek.find((x) => x.id === id);
  if (!p) {
    $('#kepala-proyek').innerHTML = `<div class="kosong"><h1 style="font-size:var(--t-2xl)">Proyek tidak ditemukan</h1>
      <p>Kode proyek "${esc(id || '')}" tidak ada di data Tally. Pilih proyek dari peta.</p><a class="tombol" href="peta.html">${ikon('peta')}Buka peta proyek</a></div>`;
    $('#belah').hidden = true;
    $$('.dua-kolom').forEach((x) => (x.hidden = true));
    return;
  }

  document.title = `${p.id} ${p.nama} · Tally`;
  const lp = laporan.filter((l) => l.proyekId === p.id);
  const st = statusLapangan(lp);
  const sinyal = sinyalProyek(p, proyek, lp);

  // --- Kepala ---
  $('#kepala-proyek').innerHTML = `
    <nav class="remah" aria-label="Remah roti"><a href="peta.html?id=${encodeURIComponent(p.id)}">Peta proyek</a><span aria-hidden="true">/</span><span>${esc(p.id)}</span></nav>
    <h1>${esc(p.nama)}</h1>
    <div class="baris" style="margin-top:14px;gap:8px">
      <span class="chip">${esc(p.sektor)}</span><span class="chip">Tahun ${esc(p.tahun)}</span>
      <span class="chip">${ikon('pin')}Kec. ${esc(p.kecamatan)}</span><span class="chip">${esc(p.dinas)}</span>
    </div>`;

  // --- Struk proyek (kata dokumen) ---
  const rasio = p.nilaiKontrak && p.hps ? p.nilaiKontrak / p.hps : null;
  const baris = (k, v) => `<div class="struk__baris"><dt>${k}</dt><dd>${v}</dd></div>`;
  $('#struk-proyek').innerHTML = `
    <p class="struk__judul">STRUK PROYEK</p>
    <p class="struk__sub">${esc(p.id)}${p.kodeTender ? '<br>Kode tender ' + esc(p.kodeTender) : ''}</p>
    <dl>
      ${baris('Pagu anggaran', rupiah(p.pagu))}
      ${baris('HPS', rupiahAtau(p.hps, 'tidak tercantum'))}
      ${baris('Nilai kontrak', rupiahAtau(p.nilaiKontrak))}
      ${rasio ? baris('Kontrak ÷ HPS', persen(rasio * 100)) : ''}
      ${baris('Penyedia', esc(p.penyedia || 'tidak tercantum di sumber'))}
      ${baris('Status resmi', esc(p.statusResmi))}
      ${baris('Jadwal', esc(p.jadwal || '—'))}
      ${p.nilaiKontrak ? `<div class="struk__baris struk__baris--tebal"><dt>SELISIH DARI PAGU</dt><dd>${rupiah(p.pagu - p.nilaiKontrak)}</dd></div>` : ''}
    </dl>
    <p class="struk__catatan">Sumber: <a href="${esc(p.sumberUrl)}" target="_blank" rel="noopener">${esc(p.sumber)}</a>. Sumber dana: ${esc(p.sumberDana || '—')}.</p>`;


  // --- Kata warga ---
  const kasus = kelompokkanKasus(lp.filter((l) => l.status !== 'Ditolak'));
  const ringkas = st.kunci === 'belum'
    ? `<p><b>Belum ada warga yang mengecek proyek ini.</b> Kalau kamu bisa ke lokasinya, foto kondisinya dan kirim lewat Tally. Laporan pertama langsung menentukan stempel proyek ini.</p>`
    : st.kunci === 'tidak'
      ? `<p><b>${st.terbuka.length} kasus terbuka tidak cocok dengan dokumen.</b> Resmi tertulis "${esc(p.statusResmi)}", tetapi warga melaporkan ${[...new Set(st.terbuka.map((k) => k.kondisi.toLowerCase()))].join(' dan ')}.</p>`
      : `<p><b>Laporan warga cocok dengan dokumen.</b> ${kasus.some((k) => kondisiMasalah(k.kondisi)) ? 'Masalah yang pernah dilaporkan sudah ditangani.' : 'Belum ada masalah yang dilaporkan.'}</p>`;

  const kartuKasus = (k) => {
    const foto = [k, ...k.anggota].filter((x) => x.fotoUrl);
    const gps = [k, ...k.anggota].filter((x) => x.terverifikasi).length;
    const total = 1 + k.jumlahDukungan;
    return `<article class="kasus" data-kode="${esc(k.kode)}">
      <div class="kasus__kepala">
        <div class="baris" style="gap:6px">${lencanaKondisi(k.kondisi)}${lencanaStatus(k.status)}</div>
        <span class="pudar" style="font-size:var(--t-xs);font-family:var(--huruf-struk)">${esc(k.kode)}</span>
      </div>
      ${k.catatan ? `<p>“${esc(k.catatan)}”</p>` : ''}
      ${k.temuan && k.temuan.length ? `<div class="baris" style="gap:6px">${k.temuan.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      ${foto.length ? `<div class="kasus__foto">${foto.map((x) => `<a href="${esc(x.fotoUrl)}" target="_blank" rel="noopener"><img src="${esc(x.fotoUrl)}" alt="Foto bukti ${esc(x.kode)}" loading="lazy" width="112" height="84"></a>`).join('')}</div>` : ''}
      ${k.tanggapan ? `<p class="sinyal sinyal--info">${ikon('pesan')}<span><b>Tanggapan petugas:</b> ${esc(k.tanggapan)}</span></p>` : ''}
      <div class="kasus__meta">
        <span>${ikon('warga')}${total} warga melihat ini</span>
        <span>${ikon('lokasi')}${gps ? gps + ' laporan terverifikasi (foto langsung + GPS)' : 'belum ada laporan terverifikasi'}</span>
        <span>${ikon('jam')}${sejak(k.dibuatPada)}</span>
      </div>
      ${statusTutup(k.status) ? '' : `<div class="baris">
        <button class="tombol tombol--garis tombol--kecil" type="button" data-dukung="${esc(k.kode)}">${ikon('mata')}Saya juga lihat ini</button>
        <a class="tombol tombol--polos tombol--kecil" href="lacak.html?kode=${encodeURIComponent(k.kode)}">Lacak kasus</a>
      </div>`}
    </article>`;
  };

  const teksBagikan = `Cek proyek "${p.nama}" (${p.id}) di Tally. Cocok di dokumen, cocok di lapangan? ${urlSitus('detail.html?id=' + encodeURIComponent(p.id))}`;
  $('#kata-warga').innerHTML = `
    <div class="stempel-tempel">${stempelHTML(st, true, true)}</div>
    ${ringkas}
    <div style="margin-top:16px">${kasus.map(kartuKasus).join('')}</div>
    <div class="baris" style="margin-top:20px">
      <a class="tombol" href="lapor.html?id=${encodeURIComponent(p.id)}">${ikon('kamera')}Laporkan kondisi di lapangan</a>
      <a class="tombol tombol--garis" href="${linkWhatsApp(teksBagikan)}" target="_blank" rel="noopener">${ikon('bagikan')}Ajak warga lain lewat WhatsApp</a>
    </div>`;

  // "Saya juga lihat ini"
  $('#kata-warga').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dukung]');
    if (!b) return;
    b.setAttribute('aria-busy', 'true');
    b.disabled = true;
    try {
      const r = await Data.dukung(b.dataset.dukung);
      const meta = b.closest('.kasus').querySelector('.kasus__meta span');
      const kasusIni = kasus.find((k) => k.kode === r.kode);
      if (meta && kasusIni) meta.innerHTML = `${ikon('warga')}${1 + r.jumlah_dukungan} warga melihat ini`;
      b.removeAttribute('aria-busy');
      b.innerHTML = `${ikon('centang')}${r.baru ? 'Terima kasih, dukunganmu tercatat' : 'Sudah tercatat dari perangkat ini'}`;
      notif(r.baru ? 'Dukungan tercatat. Kasus ini naik prioritas di antrean petugas.' : 'Perangkat ini sudah melaporkan atau mendukung kasus ini, jadi tidak dihitung dua kali.');
    } catch (err) {
      b.removeAttribute('aria-busy');
      b.disabled = false;
      notif('Gagal mencatat dukungan: ' + err.message);
    }
  });

  // --- Sinyal ---
  $('#sinyal').innerHTML = sinyal.length
    ? sinyal.map((s) => `<div class="sinyal ${s.kunci === 'hps' ? '' : 'sinyal--info'}">${ikon(s.kunci === 'hps' ? 'peringatan' : 'info')}<span><b>${esc(s.judul)}.</b> ${esc(s.teks)}${s.kunci === 'hps' ? ' <a href="tentang.html#metode">Cara kami menghitung</a>.' : ''}</span></div>`).join('')
    : '<p class="pudar">Tidak ada sinyal khusus dari data resmi. Laporan warga tetap dibutuhkan untuk memastikan kondisinya.</p>';

  // --- Peta mini dengan radius verifikasi ---
  const radius = batasRadius(p);
  $('#catatan-lokasi').innerHTML = `<span>${p.catatanLokasi ? esc(p.catatanLokasi.replace(/\.\s*$/, '')) + '. ' : ''}Lingkaran = radius cek GPS ${radius} m. ` +
    (radius > 300 ? 'Radius dilonggarkan karena titiknya masih perkiraan.' : 'Titik ini lokasi bangunan atau ruas jalannya.') +
    '</span> <span id="jarak-saya"></span>';
  try {
    const pm = await PetaTally.buat($('#peta-mini'), {
      pusat: p, zoom: 14, kooperatif: true, lokasi: true,
      saatLokasi: (pos) => {
        if (!pos) return;
        $('#jarak-saya').innerHTML = `<b>Kamu sekitar ${jarakTeks(Math.round(jarakMeter(pos, p)))} dari titik proyek.</b>`;
      }
    });
    PetaTally.pasangPenanda(pm, p, st);
    PetaTally.aturArea(pm, 'area-cek', PetaTally.lingkaran(p.lng, p.lat, radius));
    pm.fitBounds(PetaTally.batasLingkaran(p, radius), { padding: 28, duration: 0 });
    PetaTally.lokasiOtomatis(pm);
  } catch (e) {
    PetaTally.tampilkanGagal($('#peta-mini'), e);
  }
})();
