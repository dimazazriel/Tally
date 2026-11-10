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
  let fotoBlob = null, fotoTerunggah = null, fotoLangsung = false, lokasi = null, janjiPeta = null, penandaProyek = null;

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
      // Cap foto dan jarak memakai proyek lama: foto harus diambil ulang
      if (fotoBlob) { buangFoto(); notif('Proyek diganti. Ambil foto lagi supaya cap dan jaraknya sesuai proyek ini.'); }
      hentikanKamera();
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
        <div class="kasus__kepala">${lencanaKondisi(k.kondisi)}<span class="pudar" style="font-size:var(--t-xs)"><span data-hitung>${1 + k.jumlahDukungan} warga</span> · ${sejak(k.dibuatPada)}</span></div>
        <button class="tombol tombol--garis tombol--kecil" type="button" data-dukung="${esc(k.kode)}">${ikon('mata')}Saya juga lihat ini</button>
      </div>`).join('')}` : '';
    perbaruiCekBukti();
  }

  $('#laporan-serupa').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dukung]');
    if (!b) return;
    b.setAttribute('aria-busy', 'true'); b.disabled = true;
    try {
      const r = await Data.dukung(b.dataset.dukung);
      b.removeAttribute('aria-busy');
      b.innerHTML = `${ikon('centang')}${r.baru ? 'Dukungan tercatat' : 'Sudah tercatat dari perangkat ini'}`;
      const hitung = b.closest('.kasus') && b.closest('.kasus').querySelector('[data-hitung]');
      if (hitung) hitung.textContent = `${1 + r.jumlah_dukungan} warga`;
      notif(r.baru ? 'Terima kasih. Kasus ini naik prioritas di antrean petugas.' : 'Perangkat ini sudah melaporkan atau mendukung kasus ini, jadi tidak dihitung dua kali.');
    } catch (err) {
      b.removeAttribute('aria-busy'); b.disabled = false;
      notif('Gagal: ' + err.message);
    }
  });

  // Peta jarak: titik proyek, lingkaran radius cek GPS, dan posisimu
  async function gambarPeta() {
    if (!p) return;
    const proyekIni = p;
    if (!janjiPeta) janjiPeta = PetaTally.buat($('#peta-lapor'), { pusat: proyekIni, zoom: 15, kooperatif: true });
    let peta;
    try {
      peta = await janjiPeta;
    } catch (e) {
      PetaTally.tampilkanGagal($('#peta-lapor'), e);
      return;
    }
    if (proyekIni !== p) return;   // proyek sudah diganti saat peta dimuat
    if (penandaProyek) penandaProyek.remove();
    penandaProyek = PetaTally.pasangPenanda(peta, p, statusLapangan(laporan.filter((l) => l.proyekId === p.id)));
    const r = batasRadius(p);
    PetaTally.aturArea(peta, 'area-cek', PetaTally.lingkaran(p.lng, p.lat, r));
    if (lokasi) {
      PetaTally.tandaiSaya(peta, lokasi);
      const b = PetaTally.batasLingkaran(p, r).extend([lokasi.lng, lokasi.lat]);
      peta.fitBounds(b, { padding: 36, maxZoom: 16, duration: 0 });
    } else {
      peta.fitBounds(PetaTally.batasLingkaran(p, r), { padding: 24, duration: 0 });
    }
  }

  // ---------- Foto bukti: kamera langsung ----------
  // Foto dijepret dari kamera di halaman ini (bukan dari galeri), lalu diberi
  // cap waktu dan jarak ke proyek. Lokasi diambil pada detik memotret.
  // Kalau kamera tidak bisa dibuka, unggahan galeri tetap boleh (kecuali
  // izinkanFotoGaleri: false di config.js), tetapi tidak pernah terverifikasi.
  const cfg = window.TALLY_CONFIG || {};
  const inputFoto = $('#foto');
  let aliran = null, idPantau = null, posisiTerakhir = null, urlPratinjau = null;
  const kameraBisaDipakai = () => window.isSecureContext && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const modeGaleri = () => !$('#cadangan-galeri').hidden;

  function hentikanKamera() {
    if (aliran) { aliran.getTracks().forEach((t) => t.stop()); aliran = null; }
    if (idPantau != null) { navigator.geolocation.clearWatch(idPantau); idPantau = null; }
    $('#kamera-video').srcObject = null;
    $('#kamera-layar').hidden = true;
    $('#jepret').hidden = true;
    $('#tutup-kamera').hidden = true;
    $('#buka-kamera').hidden = !!fotoBlob;
  }
  window.addEventListener('pagehide', hentikanKamera);

  function tampilkanGaleri(alasan) {
    hentikanKamera();
    if (cfg.izinkanFotoGaleri === false) {
      galat('#galat-foto', alasan + ' Laporan di Tally membutuhkan foto langsung dari kamera.');
      return;
    }
    $('#alasan-galeri span').textContent = alasan;
    $('#cadangan-galeri').hidden = false;
    $('#ambil-lokasi').hidden = false;
    tulisInfoLokasi();
  }

  async function bukaKamera() {
    $('#galat-foto').hidden = true;
    if (!p) return galat('#galat-foto', 'Pilih proyeknya dulu di langkah 0.');
    if (!kameraBisaDipakai()) {
      return tampilkanGaleri(window.isSecureContext
        ? 'Browser ini tidak bisa membuka kamera dari halaman web.'
        : 'Kamera hanya bisa dibuka lewat alamat HTTPS.');
    }
    const tombol = $('#buka-kamera');
    tombol.setAttribute('aria-busy', 'true');
    try {
      try {
        aliran = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
        });
      } catch (e) {
        if (e.name !== 'OverconstrainedError') throw e;
        aliran = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    } catch (e) {
      tombol.removeAttribute('aria-busy');
      return tampilkanGaleri(({
        NotAllowedError: 'Izin kamera ditolak. Izinkan kamera lewat ikon gembok di samping alamat situs, lalu tekan "Buka kamera" lagi.',
        NotFoundError: 'Perangkat ini tidak punya kamera.',
        NotReadableError: 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.'
      })[e.name] || 'Kamera tidak bisa dibuka. Kalau kamu membuka Tally dari WhatsApp atau Instagram, buka lewat Chrome atau Safari.');
    }
    tombol.removeAttribute('aria-busy');
    const video = $('#kamera-video');
    video.srcObject = aliran;
    try { await video.play(); } catch (e) { /* sebagian browser memutar otomatis */ }
    $('#kamera-layar').hidden = false;
    $('#cadangan-galeri').hidden = true;
    $('#ambil-lokasi').hidden = true;
    tombol.hidden = true;
    $('#jepret').hidden = false;
    $('#tutup-kamera').hidden = false;
    pantauLokasi();
  }

  // Lokasi dipantau selama kamera terbuka, supaya posisi pada detik memotret sudah siap
  function pantauLokasi() {
    posisiTerakhir = null;
    const info = $('#kamera-info');
    if (!navigator.geolocation) { info.textContent = 'Browser ini tidak mendukung lokasi. Laporan tidak akan terverifikasi.'; return; }
    info.textContent = 'Mencari lokasi…';
    idPantau = navigator.geolocation.watchPosition((pos) => {
      posisiTerakhir = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy, waktu: pos.timestamp };
      info.textContent = `${jarakTeks(Math.round(jarakMeter(posisiTerakhir, p)))} dari titik proyek · akurasi GPS ±${Math.round(posisiTerakhir.akurasi)} m`;
    }, (err) => {
      info.textContent = ({
        1: 'Izin lokasi ditolak. Foto tetap bisa diambil, tetapi laporan tidak terverifikasi.',
        2: 'Lokasi tidak tersedia. Nyalakan GPS/Location di perangkat.',
        3: 'Masih mencari lokasi… coba di tempat terbuka.'
      })[err.code] || 'Gagal mengambil lokasi.';
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  }

  // Posisi yang dipakai harus segar: diambil paling lama 20 detik sebelum memotret.
  // Kalau belum ada, tunggu maksimal 10 detik.
  const posisiSegar = (waktu) => (posisiTerakhir && waktu - posisiTerakhir.waktu <= 20000 ? posisiTerakhir : null);
  function tungguPosisi(waktu, batasMs) {
    return new Promise((selesai) => {
      const mulai = Date.now();
      const t = setInterval(() => {
        const pos = posisiSegar(waktu) || (posisiTerakhir && posisiTerakhir.waktu >= waktu - 20000 ? posisiTerakhir : null);
        if (pos || Date.now() - mulai > batasMs) { clearInterval(t); selesai(pos || null); }
      }, 250);
    });
  }

  // Cap di bagian bawah foto: asal foto, proyek, waktu, jarak, akurasi.
  // Koordinat pelapor sengaja TIDAK ditulis (foto tampil publik).
  async function capFoto(kanvas, { waktu, posisi, langsung }) {
    try { await document.fonts.load('700 24px "IBM Plex Mono"'); } catch (e) {}
    const ktx = kanvas.getContext('2d');
    const w = kanvas.width, h = kanvas.height;
    const ukuran = Math.max(12, Math.round(w / 46));
    const pita = Math.round(ukuran * 3.3), tepi = Math.round(ukuran * 0.8);
    ktx.fillStyle = 'rgba(27, 27, 58, 0.8)';
    ktx.fillRect(0, h - pita, w, pita);
    const jam = waktu.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' WIB';
    const baris1 = `TALLY · ${langsung ? 'FOTO LANGSUNG' : 'FOTO DARI GALERI'} · ${p.id}`;
    const baris2 = !langsung
      ? `diunggah ${jam} · waktu & tempat pemotretan tidak diketahui`
      : posisi
        ? `${jam} · ${jarakTeks(Math.round(jarakMeter(posisi, p)))} dari proyek · GPS ±${Math.round(posisi.akurasi)} m`
        : `${jam} · tanpa lokasi`;
    ktx.fillStyle = '#ffffff';
    ktx.textBaseline = 'middle';
    ktx.font = `700 ${ukuran}px "IBM Plex Mono", ui-monospace, monospace`;
    ktx.fillText(baris1, tepi, h - pita * 0.66, w - tepi * 2);
    ktx.font = `500 ${Math.round(ukuran * 0.84)}px "IBM Plex Mono", ui-monospace, monospace`;
    ktx.fillText(baris2, tepi, h - pita * 0.3, w - tepi * 2);
  }

  const kanvasKeBlob = (kanvas) => new Promise((ok, gagal) =>
    kanvas.toBlob((b) => (b ? ok(b) : gagal(new Error('Foto tidak bisa diproses'))), 'image/jpeg', 0.8));

  function tampilkanPratinjau() {
    if (urlPratinjau) URL.revokeObjectURL(urlPratinjau);
    urlPratinjau = URL.createObjectURL(fotoBlob);
    $('#pratinjau-img').src = urlPratinjau;
    $('#pratinjau').hidden = false;
    $('#buka-kamera').hidden = true;
    $('#cadangan-galeri').hidden = true;
    $('#galat-foto').hidden = true;
  }

  async function jepret() {
    const video = $('#kamera-video');
    if (!video.videoWidth) return notif('Kamera belum siap. Tunggu sebentar.');
    const tombol = $('#jepret');
    tombol.setAttribute('aria-busy', 'true'); tombol.disabled = true;
    try {
      // 1. Bekukan gambar pada detik ini
      const waktu = new Date();
      const skala = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      const kanvas = document.createElement('canvas');
      kanvas.width = Math.round(video.videoWidth * skala);
      kanvas.height = Math.round(video.videoHeight * skala);
      kanvas.getContext('2d').drawImage(video, 0, 0, kanvas.width, kanvas.height);
      // 2. Lokasi pada detik memotret
      let posisi = posisiSegar(waktu.getTime());
      if (!posisi && idPantau != null) {
        $('#kamera-info').textContent = 'Foto tersimpan. Menunggu lokasi…';
        posisi = await tungguPosisi(waktu.getTime(), 10000);
      }
      hentikanKamera();
      // 3. Cap, lalu simpan
      await capFoto(kanvas, { waktu, posisi, langsung: true });
      fotoBlob = await kanvasKeBlob(kanvas);
      fotoLangsung = true;
      fotoTerunggah = null;
      lokasi = posisi ? { lat: posisi.lat, lng: posisi.lng, akurasi: posisi.akurasi, waktu } : null;
      tampilkanPratinjau();
      perbaruiCekBukti();
    } catch (e) {
      galat('#galat-foto', e.message);
    } finally {
      tombol.removeAttribute('aria-busy'); tombol.disabled = false;
    }
  }

  // Cadangan: foto dari galeri (dikecilkan dan diberi cap "FOTO DARI GALERI")
  async function terimaFotoGaleri(file) {
    $('#galat-foto').hidden = true;
    if (!file) return;
    if (!file.type.startsWith('image/')) return galat('#galat-foto', 'File itu bukan foto. Pilih file JPG, PNG, atau WEBP.');
    if (!p) return galat('#galat-foto', 'Pilih proyeknya dulu di langkah 0.');
    try {
      const kecil = await kompresFoto(file);
      const gambar = await new Promise((ok, gagal) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = () => gagal(new Error('Foto tidak bisa dibaca'));
        img.src = URL.createObjectURL(kecil);
      });
      const kanvas = document.createElement('canvas');
      kanvas.width = gambar.naturalWidth; kanvas.height = gambar.naturalHeight;
      kanvas.getContext('2d').drawImage(gambar, 0, 0);
      URL.revokeObjectURL(gambar.src);
      await capFoto(kanvas, { waktu: new Date(), posisi: null, langsung: false });
      fotoBlob = await kanvasKeBlob(kanvas);
      fotoLangsung = false;
      fotoTerunggah = null;
      tampilkanPratinjau();
      perbaruiCekBukti();
    } catch (e) {
      galat('#galat-foto', e.message);
    }
  }

  // Buang foto & lokasi (Foto ulang, atau proyek diganti setelah memotret)
  function buangFoto() {
    fotoBlob = null; fotoTerunggah = null; fotoLangsung = false; lokasi = null;
    $('#pratinjau').hidden = true;
    $('#buka-kamera').hidden = false;
    perbaruiCekBukti();
  }

  $('#buka-kamera').addEventListener('click', bukaKamera);
  $('#jepret').addEventListener('click', jepret);
  $('#tutup-kamera').addEventListener('click', hentikanKamera);
  $('#ganti-foto').addEventListener('click', () => {
    const galeri = !fotoLangsung && !kameraBisaDipakai();
    buangFoto();
    if (galeri) { tampilkanGaleri($('#alasan-galeri span').textContent || 'Kamera tidak tersedia.'); inputFoto.value = ''; inputFoto.click(); }
    else bukaKamera();
  });
  inputFoto.addEventListener('change', (e) => terimaFotoGaleri(e.target.files[0]));
  const zona = $('#zona-foto');
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('seret'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, () => zona.classList.remove('seret')));
  zona.addEventListener('drop', (e) => { e.preventDefault(); terimaFotoGaleri(e.dataTransfer.files[0]); });

  // ---------- Cek bukti: tiga syarat terverifikasi ----------
  function tulisInfoLokasi() {
    if (!p) return;
    const info = $('#info-lokasi');
    if (!lokasi) {
      info.textContent = fotoBlob && fotoLangsung
        ? 'Lokasi tidak tertangkap saat memotret. Nyalakan GPS dan izinkan lokasi, lalu tekan "Foto ulang".'
        : modeGaleri() || (fotoBlob && !fotoLangsung)
          ? 'Opsional: tambahkan lokasimu dengan tombol di samping.'
          : 'Lokasi diambil otomatis pada detik kamu menekan "Ambil foto".';
      return;
    }
    // Hasil jarak & akurasi sudah tampil di daftar syarat; di sini cukup asal lokasinya
    info.textContent = fotoLangsung && lokasi.waktu
      ? 'Lokasi dicatat pada detik memotret, pukul ' + lokasi.waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.'
      : 'Lokasi ditambahkan manual. Foto dari galeri tetap tidak bisa terverifikasi.';
  }

  function tulisSyarat() {
    const batas = p ? batasRadius(p) : null;
    const jarak = lokasi && p ? Math.round(jarakMeter(lokasi, p)) : null;
    const akurasi = lokasi && lokasi.akurasi != null ? Math.round(lokasi.akurasi) : null;
    const butir = (status, teks) => `<li class="syarat__butir syarat__butir--${status}">${ikon(status === 'ok' ? 'centang' : status === 'gagal' ? 'silang' : 'jam')}<span>${teks}</span></li>`;
    const sudahFoto = !!fotoBlob;
    $('#syarat-bukti').innerHTML = [
      !sudahFoto ? butir('tunggu', 'Foto langsung dari kamera Tally')
        : fotoLangsung ? butir('ok', 'Foto langsung dari kamera Tally') : butir('gagal', 'Foto dari galeri, bukan kamera langsung'),
      akurasi == null ? butir(sudahFoto ? 'gagal' : 'tunggu', `Lokasi saat memotret, akurasi GPS paling kasar ${BATAS_AKURASI_GPS} m`)
        : butir(akurasi <= BATAS_AKURASI_GPS ? 'ok' : 'gagal', `Akurasi GPS ±${akurasi} m (batas ${BATAS_AKURASI_GPS} m)`),
      jarak == null ? butir(sudahFoto ? 'gagal' : 'tunggu', `Di dalam radius proyek${batas ? ' (' + batas + ' m)' : ''}`)
        : butir(jarak <= batas ? 'ok' : 'gagal', `${jarakTeks(jarak)} dari titik proyek (batas ${batas} m)`)
    ].join('');
    const lolos = sudahFoto && fotoLangsung && akurasi != null && akurasi <= BATAS_AKURASI_GPS && jarak != null && jarak <= batas;
    $('#ringkas-syarat').innerHTML = !sudahFoto
      ? 'Laporan terverifikasi kalau ketiga syarat di atas terpenuhi.'
      : lolos
        ? `<span class="lencana lencana--cocok">${ikon('centang')}Akan terverifikasi</span> Ketiga syarat terpenuhi.`
        : `<span class="lencana lencana--cek">${ikon('peringatan')}Belum terverifikasi</span> Laporan tetap bisa dikirim, tetapi petugas akan memeriksanya lebih teliti.`;
  }

  function perbaruiCekBukti() {
    tulisInfoLokasi();
    tulisSyarat();
    gambarPeta();
  }

  // Lokasi manual: hanya muncul di mode galeri (tidak membuat laporan terverifikasi)
  $('#ambil-lokasi').addEventListener('click', () => {
    const info = $('#info-lokasi'), tombol = $('#ambil-lokasi');
    if (!p) { info.textContent = 'Pilih proyeknya dulu.'; return; }
    if (!navigator.geolocation) { info.textContent = 'Browser ini tidak mendukung lokasi.'; return; }
    if (!window.isSecureContext) { info.textContent = 'Lokasi hanya bisa diambil lewat HTTPS.'; return; }
    tombol.setAttribute('aria-busy', 'true');
    info.textContent = 'Mencari lokasimu…';
    navigator.geolocation.getCurrentPosition((pos) => {
      tombol.removeAttribute('aria-busy');
      lokasi = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy };
      perbaruiCekBukti();
    }, (err) => {
      tombol.removeAttribute('aria-busy');
      info.textContent = ({
        1: 'Izin lokasi ditolak. Buka ikon gembok di samping alamat situs, izinkan Lokasi, lalu coba lagi.',
        2: 'Lokasi tidak tersedia. Nyalakan GPS/Location di perangkat, lalu coba lagi.',
        3: 'Mencari lokasi terlalu lama. Coba lagi di tempat terbuka.'
      })[err.code] || 'Gagal mengambil lokasi.';
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
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
    if (!fotoBlob) { galat('#galat-foto', 'Ambil satu foto bukti dengan tombol "Buka kamera".'); ok = false; }
    if (!ok) { ($('.galat:not([hidden])') || {}).scrollIntoView?.({ behavior: 'smooth', block: 'center' }); return; }

    const tombol = $('#tombol-kirim');
    tombol.setAttribute('aria-busy', 'true'); tombol.disabled = true;
    try {
      // Kalau pengiriman sebelumnya gagal setelah foto terunggah, foto itu dipakai lagi
      if (!fotoTerunggah) fotoTerunggah = await Data.unggahFoto(fotoBlob, 'laporan');
      const fotoPath = fotoTerunggah;
      const hasil = await Data.kirimLaporan({
        proyekId: p.id, kondisi,
        temuan: $$('input[name="temuan"]:checked').map((x) => x.value),
        catatan: $('#catatan').value.trim(),
        fotoPath, lat: lokasi ? lokasi.lat : null, lng: lokasi ? lokasi.lng : null,
        fotoLangsung, akurasi: lokasi && lokasi.akurasi != null ? lokasi.akurasi : null
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
              <div class="struk__baris"><dt>Cek bukti</dt><dd>${esc(cekBukti({ terverifikasi: h.terverifikasi, jarakMeter: h.jarak_meter, akurasiMeter: h.akurasi_meter, fotoLangsung: h.foto_langsung }).teks)}</dd></div>
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
