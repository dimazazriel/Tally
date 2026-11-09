// Peta proyek: Leaflet + daftar samping, disaring per sektor/tahun/status
(async function () {
  const peta = L.map('peta', { zoomControl: true, scrollWheelZoom: true }).setView([-6.395, 106.81], 12);
  lapisanPeta(peta);

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

  const penanda = new Map();
  let aktifId = null;
  const lapisan = L.layerGroup().addTo(peta);

  function popupHTML(p) {
    const i = info.get(p.id);
    return `<h3>${esc(p.nama)}</h3>
      <div class="baris" style="gap:6px;margin-bottom:6px"><span class="lencana ${i.st.kunci === 'belum' ? '' : 'lencana--' + i.st.kelas}">${esc(i.st.label)}</span><span class="chip">${esc(p.id)}</span></div>
      <div>${esc(p.dinas)}</div>
      <div>Kontrak: <b class="angka">${rupiahAtau(p.nilaiKontrak)}</b></div>
      ${i.jumlah ? `<div>${i.jumlah} laporan warga</div>` : ''}
      <div class="popup__aksi">
        <a class="tombol tombol--kecil" href="detail.html?id=${encodeURIComponent(p.id)}">Lihat struk</a>
        <a class="tombol tombol--kecil tombol--garis" href="lapor.html?id=${encodeURIComponent(p.id)}">Laporkan</a>
      </div>`;
  }

  function saring() {
    const kata = $('#cari').value.trim().toLowerCase();
    const sektor = $('#filter-sektor').value, tahun = $('#filter-tahun').value, status = $('#filter-status').value;
    const urut = $('#urutan').value;
    let hasil = proyek.filter((p) =>
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
      id: (a, b) => a.id.localeCompare(b.id)
    }[urut]);

    $('#jumlah').textContent = hasil.length === proyek.length ? `Menampilkan ${hasil.length} proyek` : `${hasil.length} dari ${proyek.length} proyek cocok dengan saringan`;
    $('#daftar').innerHTML = hasil.length ? hasil.map((p) => {
      const i = info.get(p.id);
      const sinyalUtama = i.sinyal.find((s) => s.kunci === 'hps');
      return `<li><button type="button" data-id="${esc(p.id)}" ${p.id === aktifId ? 'aria-current="true"' : ''}>
        <span class="titik-status ${i.st.kunci !== 'belum' ? 'titik-status--' + i.st.kunci : ''}" aria-hidden="true"></span>
        <b>${esc(p.nama)}</b>
        <small>${esc(p.id)} · Kec. ${esc(p.kecamatan)} · ${rupiahRingkas(nilai(p))}</small>
        <span class="baris">
          <span class="lencana ${i.st.kunci === 'belum' ? '' : 'lencana--' + i.st.kelas}">${esc(i.st.label)}${i.jumlah ? ' · ' + i.jumlah + ' laporan' : ''}</span>
          ${sinyalUtama ? `<span class="lencana lencana--cek">${esc(sinyalUtama.judul)}</span>` : ''}
        </span>
      </button></li>`;
    }).join('') : `<li class="kosong"><h3>Tidak ada proyek yang cocok</h3><p>Coba hapus kata pencarian atau pilih "Semua" di saringan.</p></li>`;

    lapisan.clearLayers();
    penanda.clear();
    hasil.forEach((p) => {
      const m = L.marker([p.lat, p.lng], { icon: pinPeta(info.get(p.id).st, p.presisiLokasi, p.id === aktifId), title: p.nama, alt: p.nama, zIndexOffset: zPin(info.get(p.id).st, p.id === aktifId) })
        .bindPopup(popupHTML(p))
        .on('click', () => tandai(p.id, false))
        .addTo(lapisan);
      penanda.set(p.id, m);
    });
  }

  function tandai(id, terbang = true) {
    const sebelum = aktifId;
    aktifId = id;
    [sebelum, id].forEach((x) => {
      const p = proyek.find((q) => q.id === x), m = penanda.get(x);
      if (p && m) { m.setIcon(pinPeta(info.get(x).st, p.presisiLokasi, x === aktifId)); m.setZIndexOffset(zPin(info.get(x).st, x === aktifId)); }
    });
    $$('#daftar button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.id === id));
    const m = penanda.get(id);
    if (m && terbang) {
      peta.flyTo(m.getLatLng(), Math.max(peta.getZoom(), 15), { duration: 0.6 });
      m.openPopup();
    }
  }

  $('#daftar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) tandai(b.dataset.id);
  });
  ['#cari', '#filter-sektor', '#filter-tahun', '#filter-status', '#urutan'].forEach((s) =>
    $(s).addEventListener(s === '#cari' ? 'input' : 'change', saring));

  // Dukung tautan seperti peta.html?status=tidak
  if (param('status')) $('#filter-status').value = param('status');
  if (param('sektor')) $('#filter-sektor').value = param('sektor');
  saring();
  // Tampilkan semua proyek di layar, apa pun ukuran jendelanya
  if (proyek.length) peta.fitBounds(L.latLngBounds(proyek.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 14 });
  if (param('id')) tandai(param('id'));
})();
