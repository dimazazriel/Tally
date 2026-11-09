// Formulir lapor: kondisi, temuan, foto, cek GPS, catatan → database
(async function () {
  let proyek = [], laporan = [];
  try {
    [proyek, laporan] = await Promise.all([Data.proyek(), Data.laporan()]);
  } catch (e) {
    $('#kartu-proyek').innerHTML = `<p class="galat">${ikon('peringatan')}Data gagal dimuat: ${esc(e.message)}</p>`;
    return;
  }

  let p = proyek.find((x) => x.id === param('id')) || null;
  let fotoBlob = null, lokasi = null, petaLapor = null, lapisLapor = null;

  try { if (localStorage.getItem('tally_kunci_tim')) $('#banner-tim').hidden = false; } catch (e) {}

  // Pilihan kondisi & temuan
  $('#pilihan-kondisi').innerHTML = KONDISI.map((k, i) => `
    <label><input type="radio" name="kondisi" value="${esc(k.nama)}" ${i === 0 ? 'aria-describedby="galat-kondisi"' : ''}><b>${esc(k.nama)}</b><small>${esc(k.ket)}</small></label>`).join('');
  $('#pilihan-temuan').innerHTML = TEMUAN.map((t) => `<label><input type="checkbox" name="temuan" value="${esc(t)}">${esc(t)}</label>`).join('');

  // Tanpa ?id=: tampilkan pemilih proyek
  if (!p) {
    $('#langkah-proyek').hidden = false;
    $('#pilih-proyek').insertAdjacentHTML('beforeend', proyek.slice().sort((a, b) => a.id.localeCompare(b.id))
      .map((x) => `<option value="${esc(x.id)}">${esc(x.id)} · ${esc(x.nama)}</option>`).join(''));
    $('#pilih-proyek').addEventListener('change', (e) => {
      p = proyek.find((x) => x.id === e.target.value) || null;
      history.replaceState(null, '', p ? 'lapor.html?id=' + encodeURIComponent(p.id) : 'lapor.html');
      tampilkanProyek();
    });
  }

  function tampilkanProyek() {
    if (!p) {
      $('#kartu-proyek').innerHTML = '<p class="panel__judul">Belum ada proyek dipilih</p><p class="pudar" style="font-size:var(--t-s)">Pilih proyek di langkah 0, atau buka formulir ini dari halaman struk proyek.</p>';
      $('#laporan-serupa').hidden = true;
      return;
    }
    $('#remah-proyek').textContent = p.id;
    const lp = laporan.filter((l) => l.proyekId === p.id);
    const st = statusLapangan(lp);
    $('#kartu-proyek').innerHTML = `
      <p class="panel__judul" style="margin-bottom:6px">Kamu melaporkan</p>
      <h2 style="font-size:var(--t-l)">${esc(p.nama)}</h2>
      <div class="baris" style="gap:6px;margin:10px 0"><span class="chip">${esc(p.id)}</span><span class="chip">Kec. ${esc(p.kecamatan)}</span><span class="lencana ${st.kunci === 'belum' ? '' : 'lencana--' + st.kelas}">${esc(st.label)}</span></div>
      <dl style="margin:0;font-size:var(--t-s);display:grid;gap:4px">
        <div class="baris" style="justify-content:space-between"><dt class="pudar">Status resmi</dt><dd style="margin:0"><b>${esc(p.statusResmi)}</b></dd></div>
        <div class="baris" style="justify-content:space-between"><dt class="pudar">Nilai kontrak</dt><dd style="margin:0" class="angka">${rupiahAtau(p.nilaiKontrak)}</dd></div>
        <div class="baris" style="justify-content:space-between"><dt class="pudar">Dinas</dt><dd style="margin:0;text-align:right">${esc(p.dinas)}</dd></div>
      </dl>
      <p style="margin-top:12px;font-size:var(--t-s)"><a href="detail.html?id=${encodeURIComponent(p.id)}">Lihat struk lengkapnya</a></p>`;

    // Laporan serupa yang masih terbuka → tawarkan "Saya juga lihat ini"
    const terbuka = kelompokkanKasus(lp).filter((k) => !statusTutup(k.status));
    const serupa = $('#laporan-serupa');
    serupa.hidden = !terbuka.length;
    serupa.innerHTML = terbuka.length ? `
      <p class="panel__judul">Sudah ada laporan untuk proyek ini</p>
      <p class="pudar" style="font-size:var(--t-s);margin-bottom:12px">Kalau kamu melihat hal yang sama, cukup dukung laporannya. Kalau tetap mengirim dengan kondisi yang sama, laporanmu otomatis digabung ke kasus itu.</p>
      ${terbuka.map((k) => `<div class="kasus" style="margin-top:8px">
        <div class="kasus__kepala">${lencanaKondisi(k.kondisi)}<span class="pudar" style="font-size:var(--t-xs)">${1 + k.jumlahDukungan} warga · ${sejak(k.dibuatPada)}</span></div>
        <button class="tombol tombol--garis tombol--kecil" type="button" data-dukung="${esc(k.kode)}">${ikon('mata')}Saya juga lihat ini</button>
      </div>`).join('')}` : '';
    gambarPeta();
  }

  $('#laporan-serupa').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dukung]');
    if (!b) return;
    b.setAttribute('aria-busy', 'true'); b.disabled = true;
    try {
      const r = await Data.dukung(b.dataset.dukung);
      b.removeAttribute('aria-busy');
      b.innerHTML = `${ikon('centang')}${r.baru ? 'Dukungan tercatat' : 'Sudah kamu dukung'}`;
      notif(r.baru ? 'Terima kasih. Kasus ini naik prioritas di antrean petugas.' : 'Perangkat ini sudah pernah mendukung kasus ini.');
    } catch (err) {
      b.removeAttribute('aria-busy'); b.disabled = false;
      notif('Gagal: ' + err.message);
    }
  });

  // Peta jarak
  function gambarPeta() {
    if (!p) return;
    if (!petaLapor) {
      petaLapor = L.map('peta-lapor', { scrollWheelZoom: false }).setView([p.lat, p.lng], 15);
      lapisanPeta(petaLapor);
      lapisLapor = L.layerGroup().addTo(petaLapor);
    }
    lapisLapor.clearLayers();
    const r = batasRadius(p);
    L.marker([p.lat, p.lng], { icon: pinPeta({ kunci: 'belum' }, p.presisiLokasi), title: p.nama }).addTo(lapisLapor);
    const lingkar = L.circle([p.lat, p.lng], { radius: r, color: '#4a2fa0', weight: 1.5, fillOpacity: 0.06, dashArray: '4 6' }).addTo(lapisLapor);
    if (lokasi) {
      L.marker([lokasi.lat, lokasi.lng], { icon: L.divIcon({ className: '', html: '<span class="titik-saya"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: 'Posisimu' }).addTo(lapisLapor);
      petaLapor.fitBounds(L.latLngBounds([[p.lat, p.lng], [lokasi.lat, lokasi.lng]]).pad(0.35));
    } else {
      petaLapor.fitBounds(lingkar.getBounds().pad(0.2));
    }
  }

  // Foto: kompres lalu pratinjau
  const inputFoto = $('#foto');
  async function terimaFoto(file) {
    $('#galat-foto').hidden = true;
    if (!file) return;
    if (!file.type.startsWith('image/')) return galat('#galat-foto', 'File itu bukan foto. Pilih file JPG, PNG, atau WEBP.');
    try {
      fotoBlob = await kompresFoto(file);
      $('#pratinjau-img').src = URL.createObjectURL(fotoBlob);
      $('#pratinjau').hidden = false;
      $('#zona-foto').hidden = true;
    } catch (e) {
      galat('#galat-foto', e.message);
    }
  }
  inputFoto.addEventListener('change', (e) => terimaFoto(e.target.files[0]));
  $('#ganti-foto').addEventListener('click', () => { inputFoto.value = ''; inputFoto.click(); });
  const zona = $('#zona-foto');
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('seret'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, () => zona.classList.remove('seret')));
  zona.addEventListener('drop', (e) => { e.preventDefault(); terimaFoto(e.dataTransfer.files[0]); });

  // Lokasi: cek radius
  $('#ambil-lokasi').addEventListener('click', () => {
    const info = $('#info-lokasi'), tombol = $('#ambil-lokasi');
    if (!p) { info.textContent = 'Pilih proyeknya dulu.'; return; }
    if (!navigator.geolocation) { info.textContent = 'Browser ini tidak mendukung lokasi.'; return; }
    if (!window.isSecureContext) { info.textContent = 'Lokasi hanya bisa diambil lewat HTTPS.'; return; }
    tombol.setAttribute('aria-busy', 'true');
    info.textContent = 'Mencari lokasimu…';
    navigator.geolocation.getCurrentPosition((pos) => {
      tombol.removeAttribute('aria-busy');
      lokasi = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const jarak = Math.round(jarakMeter(lokasi, p)), batas = batasRadius(p);
      info.innerHTML = jarak <= batas
        ? `<span class="lencana lencana--cocok">${ikon('centang')}Lolos cek GPS</span> Kamu ${jarakTeks(jarak)} dari titik proyek (batas ${batas} m).`
        : `<span class="lencana lencana--cek">${ikon('peringatan')}Di luar radius</span> Kamu ${jarakTeks(jarak)} dari titik proyek (batas ${batas} m). Laporan tetap bisa dikirim.`;
      gambarPeta();
    }, (err) => {
      tombol.removeAttribute('aria-busy');
      info.textContent = ({
        1: 'Izin lokasi ditolak. Buka ikon gembok di samping alamat situs, izinkan Lokasi, lalu coba lagi.',
        2: 'Lokasi tidak tersedia. Nyalakan GPS/Location di perangkat, lalu coba lagi.',
        3: 'Mencari lokasi terlalu lama. Coba lagi di tempat terbuka.'
      })[err.code] || 'Gagal mengambil lokasi.';
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });

  $('#catatan').addEventListener('input', (e) => ($('#hitung-catatan').textContent = e.target.value.length));

  function galat(sel, teks) {
    const el = $(sel);
    el.innerHTML = `${ikon('peringatan')}<span>${esc(teks)}</span>`;
    el.hidden = false;
    return false;
  }

  // Kirim
  $('#form-lapor').addEventListener('submit', async (e) => {
    e.preventDefault();
    ['#galat-kondisi', '#galat-foto', '#galat-kirim'].forEach((s) => ($(s).hidden = true));
    const kondisi = ($('input[name="kondisi"]:checked') || {}).value;
    let ok = true;
    if (!p) { galat('#galat-kirim', 'Pilih proyek yang kamu laporkan di langkah 0.'); ok = false; }
    if (!kondisi) { galat('#galat-kondisi', 'Pilih salah satu kondisi.'); ok = false; }
    if (!fotoBlob) { galat('#galat-foto', 'Tambahkan satu foto sebagai bukti.'); ok = false; }
    if (!ok) { ($('.galat:not([hidden])') || {}).scrollIntoView?.({ behavior: 'smooth', block: 'center' }); return; }

    const tombol = $('#tombol-kirim');
    tombol.setAttribute('aria-busy', 'true'); tombol.disabled = true;
    try {
      const fotoPath = await Data.unggahFoto(fotoBlob, 'laporan');
      const hasil = await Data.kirimLaporan({
        proyekId: p.id, kondisi,
        temuan: $$('input[name="temuan"]:checked').map((x) => x.value),
        catatan: $('#catatan').value.trim(),
        fotoPath, lat: lokasi ? lokasi.lat : null, lng: lokasi ? lokasi.lng : null
      });
      tampilkanHasil(hasil, kondisi);
    } catch (err) {
      galat('#galat-kirim', 'Laporan belum terkirim: ' + err.message + '. Coba kirim lagi.');
      tombol.removeAttribute('aria-busy'); tombol.disabled = false;
    }
  });

  function tampilkanHasil(h, kondisi) {
    $('#area-lapor').hidden = true;
    $('.halaman-kepala h1').textContent = 'Laporan diterima';
    $('.halaman-kepala .pengantar').textContent = 'Simpan kode lacak di bawah. Petugas punya waktu 7 hari untuk menanggapi.';
    const teksWa = `Aku baru melaporkan "${p.nama}" di Tally (${h.kode}). Lihat dan dukung: ${urlSitus('detail.html?id=' + encodeURIComponent(p.id))}`;
    $('#hasil').hidden = false;
    $('#hasil').innerHTML = `
      <div class="dua-kolom">
        <div class="kertas-bayang" style="max-width:460px;position:relative">
          <article class="struk">
            <p class="struk__judul">RESI LAPORAN</p>
            <p class="struk__sub">${esc(p.id)} · ${esc(p.kecamatan)}</p>
            <p class="resi__kode" id="kode-hasil">${esc(h.kode)}</p>
            <dl>
              <div class="struk__baris"><dt>Kondisi</dt><dd>${esc(kondisi)}</dd></div>
              <div class="struk__baris"><dt>Cek GPS</dt><dd>${h.jarak_meter == null ? 'tanpa lokasi' : (h.terverifikasi ? 'lolos, ' : 'di luar radius, ') + jarakTeks(h.jarak_meter)}</dd></div>
              <div class="struk__baris"><dt>Status</dt><dd>${esc(h.status)}</dd></div>
              ${h.induk_kode ? `<div class="struk__baris"><dt>Digabung ke kasus</dt><dd>${esc(h.induk_kode)}</dd></div>` : ''}
              ${h.sumber === 'tim' ? '<div class="struk__baris"><dt>Sumber</dt><dd>kunjungan tim</dd></div>' : ''}
            </dl>
            <p class="struk__catatan">${new Date().toLocaleString('id-ID')}</p>
          </article>
          <span class="stempel stempel--cap stempel--hentak" style="position:absolute;right:-8px;top:46%">Diterima<small>Tally</small></span>
        </div>
        <div class="tumpuk">
          <h2 style="font-size:var(--t-xl)">${h.induk_kode ? 'Laporanmu memperkuat kasus yang sudah ada' : 'Laporanmu membuka kasus baru'}</h2>
          <p class="pudar">${h.induk_kode
            ? `Warga lain sudah melaporkan kondisi yang sama, jadi laporanmu digabung ke kasus ${esc(h.induk_kode)}. Makin banyak bukti, makin tinggi prioritasnya.`
            : 'Petugas akan memeriksa foto dan lokasinya, lalu meneruskannya ke dinas penanggung jawab.'}</p>
          <div class="baris">
            <button class="tombol" type="button" id="salin-kode">${ikon('salin')}Salin kode lacak</button>
            <a class="tombol tombol--garis" href="lacak.html?kode=${encodeURIComponent(h.kode)}">Lacak sekarang</a>
          </div>
          <div class="baris">
            <a class="tombol tombol--polos" href="detail.html?id=${encodeURIComponent(p.id)}">Kembali ke struk proyek</a>
            <a class="tombol tombol--polos" href="${linkWhatsApp(teksWa)}" target="_blank" rel="noopener">${ikon('bagikan')}Ajak warga lain</a>
          </div>
        </div>
      </div>`;
    $('#salin-kode').addEventListener('click', () => salin(h.kode));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tampilkanProyek();
})();
