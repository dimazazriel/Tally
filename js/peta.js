// Peta proyek: peta MapLibre + daftar samping, disaring per sektor/tahun/status,
// bisa diurutkan dari yang terdekat dengan lokasi pengguna.
(async function () {
  let proyek = [], laporan = [];
  try {
    [proyek, laporan] = await Promise.all([Data.proyek(), Data.laporan()]);
  } catch (e) {
    $('#jumlah').innerHTML = `<span class="galat">${ikon('peringatan')}Data gagal dimuat: ${esc(e.message)}</span>`;
    return;
  }

  // Hitung status & sinyal tiap proyek sekali saja
  const info = new Map(proyek.map((p) => {
    const lp = laporan.filter((l) => l.proyekId === p.id);
    return [p.id, { st: statusLapangan(lp), jumlah: lp.filter((l) => l.status !== 'Ditolak').length, sinyal: sinyalProyek(p, proyek, lp) }];
  }));

  // Isi pilihan sektor dari data
  [...new Set(proyek.map((p) => p.sektor))].sort().forEach((s) => {
    $('#filter-sektor').insertAdjacentHTML('beforeend', `<option>${esc(s)}</option>`);
  });

  const layarSempit = window.matchMedia('(max-width: 979px)');
  const penanda = new Map();
  let aktifId = null, posisiSaya = null, peta = null, popup = null;

  const jarakDariSaya = (p) => (posisiSaya ? jarakMeter(posisiSaya, p) : null);

  function popupHTML(p) {
    const i = info.get(p.id);
    const j = jarakDariSaya(p);
    return `<h3>${esc(p.nama)}</h3>
      <div class="baris" style="gap:6px;margin-bottom:6px"><span class="lencana ${i.st.kunci === 'belum' ? '' : 'lencana--' + i.st.kelas}">${esc(i.st.label)}</span><span class="chip">${esc(p.id)}</span></div>
      <div>${esc(p.dinas)}</div>
      <div>Kontrak: <b class="angka">${rupiahAtau(p.nilaiKontrak)}</b></div>
      ${lokasiKira(p.presisiLokasi) ? `<div class="pudar">Lokasi perkiraan: titik tengah ${esc(p.presisiLokasi)}</div>` : ''}
      ${i.jumlah ? `<div>${i.jumlah} laporan warga</div>` : ''}
      ${j !== null ? `<div class="pudar">Sekitar ${jarakTeks(Math.round(j))} dari lokasimu</div>` : ''}
      <div class="popup__aksi">
        <a class="tombol tombol--kecil" href="detail.html?id=${encodeURIComponent(p.id)}">Lihat struk</a>
        <a class="tombol tombol--kecil tombol--garis" href="lapor.html?id=${encodeURIComponent(p.id)}">Laporkan</a>
      </div>`;
  }

  function saring() {
    const kata = $('#cari').value.trim().toLowerCase();
    const sektor = $('#filter-sektor').value, tahun = $('#filter-tahun').value, status = $('#filter-status').value;
    let urut = $('#urutan').value;
    if (urut === 'jarak' && !posisiSaya) urut = 'perlu';   // menunggu lokasi
    const hasil = proyek.filter((p) =>
      (!sektor || p.sektor === sektor) &&
      (!tahun || String(p.tahun) === tahun) &&
      (!status || info.get(p.id).st.kunci === status) &&
      (!kata || [p.nama, p.kecamatan, p.penyedia, p.dinas, p.id].join(' ').toLowerCase().includes(kata))
    );
    const nilai = (p) => p.nilaiKontrak ?? p.pagu;
    const bobotPerlu = (p) => info.get(p.id).sinyal.reduce((a, s) => a + (s.kunci === 'hps' ? 3 : 1), 0) + (info.get(p.id).st.kunci === 'tidak' ? 5 : 0);
    hasil.sort({
      perlu: (a, b) => bobotPerlu(b) - bobotPerlu(a) || nilai(b) - nilai(a),
      laporan: (a, b) => info.get(b.id).jumlah - info.get(a.id).jumlah || nilai(b) - nilai(a),
      nilai: (a, b) => nilai(b) - nilai(a),
      jarak: (a, b) => jarakDariSaya(a) - jarakDariSaya(b),
      id: (a, b) => a.id.localeCompare(b.id)
    }[urut]);

    $('#jumlah').textContent = hasil.length === proyek.length ? `Menampilkan ${hasil.length} proyek` : `${hasil.length} dari ${proyek.length} proyek cocok dengan saringan`;
    $('#daftar').innerHTML = hasil.length ? hasil.map((p) => {
      const i = info.get(p.id);
      const sinyalUtama = i.sinyal.find((s) => s.kunci === 'hps');
      const j = jarakDariSaya(p);
      return `<li><button type="button" data-id="${esc(p.id)}" ${p.id === aktifId ? 'aria-current="true"' : ''}>
        <span class="titik-status ${i.st.kunci !== 'belum' ? 'titik-status--' + i.st.kunci : ''}" aria-hidden="true"></span>
        <b>${esc(p.nama)}</b>
        <small>${esc(p.id)} · Kec. ${esc(p.kecamatan)} · ${rupiahRingkas(nilai(p))}${j !== null ? ' · ' + jarakTeks(Math.round(j)) : ''}</small>
        <span class="baris">
          <span class="lencana ${i.st.kunci === 'belum' ? '' : 'lencana--' + i.st.kelas}">${esc(i.st.label)}${i.jumlah ? ' · ' + i.jumlah + ' laporan' : ''}</span>
          ${sinyalUtama ? `<span class="lencana lencana--cek">${esc(sinyalUtama.judul)}</span>` : ''}
        </span>
      </button></li>`;
    }).join('') : `<li class="kosong"><h3>Tidak ada proyek yang cocok</h3><p>Coba hapus kata pencarian atau pilih "Semua" di saringan.</p></li>`;

    if (!peta) return;
    penanda.forEach((m) => m.remove());
    penanda.clear();
    hasil.forEach((p) => penanda.set(p.id, PetaTally.pasangPenanda(peta, p, info.get(p.id).st, {
      // detail 0 = diaktifkan dengan papan ketik (Enter/Spasi)
      saatPilih: (id, el, e) => pilih(id, { terbang: false, papanKetik: e && e.detail === 0, asal: el })
    })));
    if (aktifId && penanda.has(aktifId)) PetaTally.tandaiAktif(penanda.get(aktifId), true);
    else if (aktifId) tutupPopup();
  }

  function tutupPopup() {
    if (popup && popup.isOpen()) popup.remove();
    else lepasPilihan();
  }

  function lepasPilihan() {
    if (!aktifId) return;
    PetaTally.tandaiAktif(penanda.get(aktifId), false);
    aktifId = null;
    if (peta) PetaTally.aturArea(peta, 'area-cek', null);
    $$('#daftar button').forEach((b) => b.removeAttribute('aria-current'));
  }

  let asalFokus = null;
  function pilih(id, { terbang = true, papanKetik = false, asal = null } = {}) {
    const p = proyek.find((q) => q.id === id);
    if (!p) return;
    if (aktifId && aktifId !== id) PetaTally.tandaiAktif(penanda.get(aktifId), false);
    aktifId = id;
    PetaTally.tandaiAktif(penanda.get(id), true);
    $$('#daftar button').forEach((b) => { if (b.dataset.id === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    if (!peta) return;
    // Lingkaran = radius cek GPS: salah satu syarat laporan terverifikasi
    PetaTally.aturArea(peta, 'area-cek', PetaTally.lingkaran(p.lng, p.lat, batasRadius(p)));
    popup.setOffset(PetaTally.offsetPopup(p.presisiLokasi)).setLngLat([p.lng, p.lat]).setHTML(popupHTML(p));
    if (!popup.isOpen()) popup.addTo(peta);
    asalFokus = asal;
    if (papanKetik) { const a = popup.getElement().querySelector('a, button'); if (a) a.focus(); }
    if (terbang) {
      // Penanda diletakkan agak ke bawah supaya popup di atasnya muat di layar
      const tinggi = peta.getContainer().clientHeight;
      peta.easeTo({ center: [p.lng, p.lat], zoom: Math.max(peta.getZoom(), 14.5), offset: [0, Math.round(tinggi * 0.22)], duration: gerakHalus() ? 650 : 0 });
      peta.once('moveend', pastikanPopupTerlihat);
    } else {
      pastikanPopupTerlihat();
    }
  }

  const gerakHalus = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Geser peta secukupnya bila popup terpotong tepi peta
  function pastikanPopupTerlihat() {
    requestAnimationFrame(() => {
      const el = popup && popup.isOpen() && popup.getElement();
      if (!el) return;
      const a = el.getBoundingClientRect(), w = peta.getContainer().getBoundingClientRect(), jarak = 12;
      let dx = 0, dy = 0;
      if (a.top < w.top + jarak) dy = a.top - (w.top + jarak);
      else if (a.bottom > w.bottom - jarak) dy = a.bottom - (w.bottom - jarak);
      if (a.left < w.left + jarak) dx = a.left - (w.left + jarak);
      else if (a.right > w.right - jarak) dx = a.right - (w.right - jarak);
      if (dx || dy) peta.panBy([dx, dy], { duration: gerakHalus() ? 300 : 0 });
    });
  }

  // Lokasi pengguna: tampilkan jarak & aktifkan urutan "terdekat".
  // Daftar & popup hanya digambar ulang bila posisi bergeser cukup jauh,
  // supaya daftar tidak melompat-lompat saat GPS memperbarui posisi.
  let posisiTerpakai = null;
  function saatLokasi(pos) {
    if (!pos) {
      if (!posisiSaya && $('#urutan').value === 'jarak') { $('#urutan').value = 'perlu'; saring(); }
      return;
    }
    posisiSaya = pos;
    if (posisiTerpakai && jarakMeter(posisiTerpakai, pos) < 150) return;
    posisiTerpakai = pos;
    saring();
    if (aktifId && popup && popup.isOpen()) popup.setHTML(popupHTML(proyek.find((q) => q.id === aktifId)));
  }

  // Bangun peta (gagal pun, daftar tetap jalan)
  try {
    peta = await PetaTally.buat($('#peta'), { pusat: { lat: -6.395, lng: 106.81 }, zoom: 12, kooperatif: layarSempit.matches, lokasi: true, saatLokasi });
    // Popup selalu di atas penanda; peta digeser bila popup terpotong
    popup = new maplibregl.Popup({ anchor: 'bottom', closeButton: true, closeOnClick: false, focusAfterOpen: false, maxWidth: '300px', className: 'popup-tally' });
    popup.on('close', lepasPilihan);
    peta.on('click', (e) => { if (!e.originalEvent.target.closest('.penanda')) tutupPopup(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !popup.isOpen()) return;
      const kembali = asalFokus && asalFokus.isConnected && popup.getElement().contains(document.activeElement) ? asalFokus : null;
      popup.remove();
      if (kembali) kembali.focus();
    });
    if (proyek.length) peta.fitBounds(PetaTally.batasTitik(proyek), { padding: 48, maxZoom: 14, duration: 0 });
    const legenda = $('#legenda');
    if (legenda) {
      if (layarSempit.matches) legenda.open = false;   // di HP keterangan dilipat agar peta lega
      PetaTally.pasangElemen(peta, legenda, 'bottom-left');
    }
    PetaTally.lokasiOtomatis(peta);
  } catch (e) {
    peta = null;
    PetaTally.tampilkanGagal($('#peta'), e);
  }

  $('#daftar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    pilih(b.dataset.id);
    // Di layar sempit peta ada di atas daftar: gulir ke peta supaya hasilnya terlihat
    if (peta && layarSempit.matches) $('#peta').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  });
  ['#cari', '#filter-sektor', '#filter-tahun', '#filter-status'].forEach((s) =>
    $(s).addEventListener(s === '#cari' ? 'input' : 'change', saring));
  $('#urutan').addEventListener('change', () => {
    const perluLokasi = $('#urutan').value === 'jarak' && !posisiSaya;
    if (perluLokasi && !(peta && peta.__lokasi)) {
      notif('Peta belum siap, jadi lokasimu belum bisa dibaca.');
      $('#urutan').value = 'perlu';
    }
    saring();
    if (perluLokasi && peta && peta.__lokasi) {
      $('#jumlah').textContent = 'Mencari lokasimu untuk mengurutkan dari yang terdekat…';
      peta.__lokasi.mulai(false);
    }
  });

  // Dukung tautan seperti peta.html?status=tidak atau ?id=PRJ-001
  if (['belum', 'cocok', 'tidak'].includes(param('status'))) $('#filter-status').value = param('status');
  if (param('sektor') && [...$('#filter-sektor').options].some((o) => o.value === param('sektor'))) $('#filter-sektor').value = param('sektor');
  saring();
  if (param('id') && proyek.some((p) => p.id === param('id'))) pilih(param('id'));
})();
