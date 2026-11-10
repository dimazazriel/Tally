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

  // ---------- Pencarian tahan salah ketik ----------
  // "cawangan" tetap menemukan Sawangan, "pancoranmas" menemukan Pancoran Mas.
  const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const KATA_ABAI = new Set(['dan', 'di', 'ke', 'yang', 'kec', 'kecamatan', 'kel', 'kelurahan', 'proyek']);

  // Jarak edit (Damerau-Levenshtein sederhana): berapa huruf yang salah
  function jarakEdit(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // Skor satu kata ketikan terhadap satu kata data. 0 = tidak cocok.
  // SALAH_KETIK = skor untuk kecocokan yang hanya mirip (beda 1–2 huruf).
  const SALAH_KETIK = new Set([1.6, 1.1]);
  function skorKata(q, t) {
    if (t === q) return 3;
    if (t.startsWith(q)) return q.length >= 2 ? 2.6 : 1.2;
    if (q.length >= 3 && t.includes(q)) return 2;
    if (q.length >= 4) {
      const batas = q.length >= 7 ? 2 : 1;
      let d = 99;
      if (Math.abs(t.length - q.length) <= batas) d = jarakEdit(q, t);
      if (t.length > q.length) d = Math.min(d, jarakEdit(q, t.slice(0, q.length)));   // ketikan belum selesai
      if (d <= batas) return d === 1 ? 1.6 : 1.1;
    }
    return 0;
  }

  // Indeks kata per proyek (beserta gabungan dua kata, mis. "pancoran"+"mas")
  const indeksKata = (teks) => {
    const k = normal(teks).split(' ').filter(Boolean);
    return [...k, ...k.slice(1).map((x, i) => k[i] + x)];
  };
  const indeks = new Map(proyek.map((p) => [p.id, [
    [indeksKata(p.nama), 1], [indeksKata(p.kecamatan), 1], [indeksKata(p.id + ' ' + p.id.replace('-', '')), 1],
    [indeksKata(p.sektor), 0.8], [indeksKata(p.penyedia), 0.8], [indeksKata(p.catatanLokasi), 0.7], [indeksKata(p.dinas), 0.6]
  ]]));

  // Skor proyek untuk satu kueri: semua kata penting harus cocok di salah satu kolom
  function skorProyek(p, kataKueri) {
    let total = 0, mirip = false;
    for (const q of kataKueri) {
      let terbaik = 0, mentah = 0;
      for (const [kata, bobot] of indeks.get(p.id)) {
        for (const t of kata) {
          const s = skorKata(q, t);
          if (s * bobot > terbaik) { terbaik = s * bobot; mentah = s; }
        }
      }
      if (!terbaik) { if (KATA_ABAI.has(q)) continue; return { skor: 0 }; }
      if (SALAH_KETIK.has(mentah)) mirip = true;
      total += terbaik;
    }
    return { skor: total, mirip };
  }
  const kataDari = (kueri) => normal(kueri).split(' ').filter(Boolean);
  // "Kec. Sawangan" (dari saran area) = saring menurut kolom kecamatan saja
  const kueriKecamatan = (kataKueri) => (kataKueri[0] === 'kec' || kataKueri[0] === 'kecamatan') && kataKueri.length > 1 ? kataKueri.slice(1) : null;
  const cocokKecamatan = (p, kata) => kata.every((q) => indeksKata(p.kecamatan).some((t) => skorKata(q, t) >= 2.6));

  // Kecamatan yang cocok dengan kueri (untuk saran "area")
  const daftarKec = [...new Set(proyek.map((p) => p.kecamatan).filter(Boolean))];
  function kecamatanCocok(kataKueri) {
    const penting = kataKueri.filter((q) => !KATA_ABAI.has(q));
    if (!penting.length) return null;
    let terbaik = null;
    daftarKec.forEach((kec) => {
      const kata = indeksKata(kec);
      let total = 0;
      for (const q of penting) {
        const s = Math.max(0, ...kata.map((t) => skorKata(q, t)));
        if (!s) return;
        total += s;
      }
      if (!terbaik || total > terbaik.skor) terbaik = { nama: kec, skor: total / penting.length };
    });
    return terbaik;
  }

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
      </div>
      <div class="popup__tautan">
        <a href="${urlRute(p)}" target="_blank" rel="noopener">Rute di Google Maps</a><span aria-hidden="true">·</span><a href="${urlGmaps(p)}" target="_blank" rel="noopener">Buka titik</a>
        ${lokasiKira(p.presisiLokasi) ? '<small>Titik perkiraan, cek alamat di struk proyek.</small>' : ''}
      </div>`;
  }

  const nilai = (p) => p.nilaiKontrak ?? p.pagu;
  const bobotPerlu = (p) => info.get(p.id).sinyal.reduce((a, s) => a + (s.kunci === 'hps' ? 3 : 1), 0) + (info.get(p.id).st.kunci === 'tidak' ? 5 : 0);

  let hasilTerakhir = [];
  function saring() {
    const kueri = $('#cari').value.trim();
    const kataKueri = kataDari(kueri);
    const sektor = $('#filter-sektor').value, tahun = $('#filter-tahun').value, status = $('#filter-status').value;
    let urut = $('#urutan').value;
    if (urut === 'jarak' && !posisiSaya) urut = 'perlu';   // menunggu lokasi
    const skor = new Map();
    const kataKec = kueriKecamatan(kataKueri);
    let mirip = false;
    const hasil = proyek.filter((p) => {
      if ((sektor && p.sektor !== sektor) || (tahun && String(p.tahun) !== tahun) || (status && info.get(p.id).st.kunci !== status)) return false;
      if (!kataKueri.length) return true;
      if (kataKec) return cocokKecamatan(p, kataKec);
      const s = skorProyek(p, kataKueri);
      if (!s.skor) return false;
      skor.set(p.id, s.skor);
      return true;
    });
    // Hasil yang semuanya hanya "mirip" (salah ketik) diberi keterangan
    if (kataKueri.length && hasil.length && !kataKec) mirip = hasil.every((p) => skorProyek(p, kataKueri).mirip);
    hasil.sort({
      perlu: (a, b) => (skor.get(b.id) || 0) - (skor.get(a.id) || 0) || bobotPerlu(b) - bobotPerlu(a) || nilai(b) - nilai(a),
      laporan: (a, b) => info.get(b.id).jumlah - info.get(a.id).jumlah || nilai(b) - nilai(a),
      nilai: (a, b) => nilai(b) - nilai(a),
      jarak: (a, b) => jarakDariSaya(a) - jarakDariSaya(b),
      id: (a, b) => a.id.localeCompare(b.id)
    }[urut]);
    hasilTerakhir = hasil;

    $('#jumlah').textContent = (mirip ? `Tidak ada yang persis "${kueri}", jadi ditampilkan yang mirip. ` : '') +
      (hasil.length === proyek.length ? `Menampilkan ${hasil.length} proyek` : `${hasil.length} dari ${proyek.length} proyek cocok dengan saringan`);
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
    // Halaman peta: geser satu jari di HP, perbesar/putar dua jari (seperti Google Maps)
    peta = await PetaTally.buat($('#peta'), { pusat: { lat: -6.395, lng: 106.81 }, zoom: 12, kooperatif: false, lokasi: true, saatLokasi });
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
  ['#filter-sektor', '#filter-tahun', '#filter-status'].forEach((s) => $(s).addEventListener('change', saring));

  // ---------- Saran pencarian (combobox) ----------
  const kotakCari = $('#cari'), kotakSaran = $('#saran-cari');
  let saran = [], saranAktif = -1;

  function hitungSaran() {
    const kataKueri = kataDari(kotakCari.value);
    if (!kataKueri.length) return [];
    const daftar = [];
    const kec = kecamatanCocok(kataKueri);
    if (kec && kec.skor >= 1.5) {
      const jml = proyek.filter((p) => p.kecamatan === kec.nama).length;
      daftar.push({ jenis: 'kecamatan', nilai: kec.nama, judul: 'Kec. ' + kec.nama, ket: `${jml} proyek · tampilkan areanya` });
    }
    proyek.map((p) => ({ p, s: skorProyek(p, kataKueri).skor })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || bobotPerlu(b.p) - bobotPerlu(a.p)).slice(0, 6)
      .forEach(({ p }) => daftar.push({ jenis: 'proyek', nilai: p.id, judul: p.nama, ket: `${p.id} · Kec. ${p.kecamatan}`, st: info.get(p.id).st }));
    return daftar;
  }

  function tampilkanSaran() {
    saran = hitungSaran();
    saranAktif = -1;
    const ada = kotakCari.value.trim().length > 0;
    kotakSaran.innerHTML = saran.length ? saran.map((x, i) => `<li role="option" id="saran-${i}" data-i="${i}" aria-selected="false">
        ${x.jenis === 'kecamatan' ? ikon('pin') : `<span class="titik-status ${x.st.kunci !== 'belum' ? 'titik-status--' + x.st.kunci : ''}" aria-hidden="true"></span>`}
        <span><b>${esc(x.judul)}</b><small>${esc(x.ket)}</small></span></li>`).join('')
      : `<li class="saran__kosong" role="option" aria-disabled="true" aria-selected="false"><span></span><span>Tidak ada proyek yang mirip dengan "${esc(kotakCari.value.trim())}"</span></li>`;
    kotakSaran.hidden = !ada;
    kotakCari.setAttribute('aria-expanded', String(ada));
    kotakCari.removeAttribute('aria-activedescendant');
  }

  function tutupSaran() {
    kotakSaran.hidden = true;
    kotakCari.setAttribute('aria-expanded', 'false');
    kotakCari.removeAttribute('aria-activedescendant');
    saranAktif = -1;
  }

  function sorot(i) {
    if (!saran.length) return;
    saranAktif = (i + saran.length) % saran.length;
    $$('#saran-cari li[data-i]').forEach((li) => li.setAttribute('aria-selected', String(Number(li.dataset.i) === saranAktif)));
    const li = $('#saran-' + saranAktif);
    kotakCari.setAttribute('aria-activedescendant', li.id);
    li.scrollIntoView({ block: 'nearest' });
  }

  // Pilih saran: kecamatan → tampilkan areanya; proyek → terbang ke titiknya
  function pakaiSaran(x) {
    if (!x) return;
    tutupSaran();
    if (x.jenis === 'kecamatan') {
      kotakCari.value = 'Kec. ' + x.nilai;
      saring();
      const titik = hasilTerakhir.length ? hasilTerakhir : proyek.filter((p) => p.kecamatan === x.nilai);
      tutupPopup();
      if (peta && titik.length) peta.fitBounds(PetaTally.batasTitik(titik), { padding: 72, maxZoom: 15, duration: gerakHalus() ? 700 : 0 });
    } else {
      const p = proyek.find((q) => q.id === x.nilai);
      kotakCari.value = p.nama;
      saring();
      pilih(p.id);
    }
    if (peta && layarSempit.matches) $('#peta').scrollIntoView({ behavior: gerakHalus() ? 'smooth' : 'auto', block: 'center' });
  }

  kotakCari.addEventListener('input', () => { saring(); tampilkanSaran(); });
  kotakCari.addEventListener('focus', () => { if (kotakCari.value.trim()) tampilkanSaran(); });
  kotakCari.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (kotakSaran.hidden) tampilkanSaran(); sorot(saranAktif + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sorot(saranAktif - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!kotakCari.value.trim()) return;
      if (kotakSaran.hidden) saran = hitungSaran();
      pakaiSaran(saran[saranAktif >= 0 ? saranAktif : 0]);
    } else if (e.key === 'Escape' && !kotakSaran.hidden) { e.preventDefault(); e.stopPropagation(); tutupSaran(); }
  });
  // pointerdown + preventDefault: kotak cari tidak kehilangan fokus sebelum saran dipilih
  kotakSaran.addEventListener('pointerdown', (e) => e.preventDefault());
  kotakSaran.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) pakaiSaran(saran[Number(li.dataset.i)]);
  });
  kotakCari.addEventListener('blur', () => setTimeout(tutupSaran, 120));
  // Tombol × bawaan kotak pencarian
  kotakCari.addEventListener('search', () => { if (!kotakCari.value) { saring(); tutupSaran(); } });

  // ---------- Panel kiri bisa dilipat (komputer) ----------
  const tata = $('#peta-tata'), tombolLipat = $('#lipat-samping');
  function aturLipat(lipat, simpan = true) {
    tata.classList.toggle('peta-tata--lipat', lipat);
    tombolLipat.setAttribute('aria-expanded', String(!lipat));
    tombolLipat.setAttribute('aria-label', lipat ? 'Tampilkan daftar proyek' : 'Sembunyikan daftar proyek');
    tombolLipat.title = lipat ? 'Tampilkan daftar' : 'Sembunyikan daftar';
    if (simpan) { try { localStorage.setItem('tally_peta_lipat', lipat ? '1' : '0'); } catch (e) { /* abaikan */ } }
    if (peta) requestAnimationFrame(() => { peta.resize(); if (popup && popup.isOpen()) pastikanPopupTerlihat(); });
  }
  tombolLipat.addEventListener('click', () => aturLipat(!tata.classList.contains('peta-tata--lipat')));
  try { if (localStorage.getItem('tally_peta_lipat') === '1' && !layarSempit.matches) aturLipat(true, false); } catch (e) { /* abaikan */ }
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
