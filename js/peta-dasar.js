// Peta dasar Tally (dipakai halaman peta, detail, dan lapor).
// MapLibre GL JS + gaya OpenFreeMap Positron yang diredam warnanya, penanda status,
// dan titik lokasi pengguna. Tanpa kunci API.
// Seperti Google Maps: di komputer peta selalu menghadap utara (tidak bisa diputar);
// di layar sentuh peta bisa diputar dua jari dan kompas muncul saat peta miring.
const PetaTally = (() => {
  const SUMBER_GAYA = [
    { url: 'https://tiles.openfreemap.org/styles/positron', redam: true },
    { url: 'https://tiles.versatiles.org/assets/styles/neutrino/style.json', redam: false }
  ];
  const LATAR = '#eef0f3';
  const BATAS_WILAYAH = [[106.45, -6.75], [107.15, -6.05]]; // Depok dan sekitarnya
  const WARNA_AREA = '#4a2fa0';
  const WARNA_SAYA = '#2563eb';
  const GERAK_HALUS = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAYAR_SENTUH = window.matchMedia('(pointer: coarse)').matches;

  const TEKS = {
    'NavigationControl.ZoomIn': 'Perbesar',
    'NavigationControl.ZoomOut': 'Perkecil',
    'NavigationControl.ResetBearing': 'Hadapkan ke utara',
    'AttributionControl.ToggleAttribution': 'Sumber peta',
    'AttributionControl.MapFeedback': 'Laporkan kesalahan peta',
    'Popup.Close': 'Tutup',
    'Map.Title': 'Peta',
    'Marker.Title': 'Penanda peta',
    'ScaleControl.Meters': 'm',
    'ScaleControl.Kilometers': 'km',
    'CooperativeGesturesHandler.WindowsHelpText': 'Tahan Ctrl sambil menggulir untuk memperbesar peta',
    'CooperativeGesturesHandler.MacHelpText': 'Tahan ⌘ sambil menggulir untuk memperbesar peta',
    'CooperativeGesturesHandler.MobileHelpText': 'Geser peta dengan dua jari'
  };

  // ---------- Gaya peta ----------
  async function ambilJson(url, batasMs) {
    const henti = new AbortController();
    const waktu = setTimeout(() => henti.abort(), batasMs);
    try {
      const r = await fetch(url, { signal: henti.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(waktu);
    }
  }

  // Positron yang diredam: warna senada Tally, garis dan label lebih sedikit
  // supaya penanda status menjadi hal paling menonjol di peta.
  function redam(gaya) {
    const buang = /^(aeroway|airport|highway-shield|road_shield|label_country|label_state|boundary_disputed|landcover_ice|landcover_glacier)/;
    gaya.layers = gaya.layers.filter((l) => !buang.test(l.id));
    const lapis = Object.fromEntries(gaya.layers.map((l) => [l.id, l]));
    const cat = (id, sifat, nilai) => { if (lapis[id]) (lapis[id].paint = lapis[id].paint || {})[sifat] = nilai; };
    const mulaiZoom = (id, z) => { if (lapis[id]) lapis[id].minzoom = z; };
    cat('background', 'background-color', LATAR);
    cat('landuse_residential', 'fill-color', '#e7e9ee');
    cat('park', 'fill-color', '#dfe7db');
    cat('landcover_wood', 'fill-color', '#dce4d8');
    cat('water', 'fill-color', '#c6d4e3');
    cat('waterway', 'line-color', '#b5c7da');
    cat('building', 'fill-color', '#e2e4ea');
    cat('building', 'fill-outline-color', '#d4d7df');
    mulaiZoom('building', 14);
    cat('highway_minor', 'line-color', '#fbfbfc');
    cat('highway_minor', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 11, 0.35, 14, 1]);
    cat('highway_path', 'line-color', '#f6f7f9');
    mulaiZoom('highway_path', 15);
    cat('highway_major_casing', 'line-color', '#d2d6de');
    cat('highway_major_inner', 'line-color', '#ffffff');
    cat('highway_motorway_casing', 'line-color', '#cdd2dc');
    cat('railway', 'line-color', '#c5c9d4');
    mulaiZoom('railway', 12);
    cat('railway_dashline', 'line-color', '#f4f5f7');
    ['label_city', 'label_city_capital', 'label_town'].forEach((id) => { cat(id, 'text-color', '#3a3f55'); cat(id, 'text-halo-color', '#f4f5f8'); });
    ['label_village', 'label_other'].forEach((id) => { cat(id, 'text-color', '#5d6378'); cat(id, 'text-halo-color', '#f4f5f8'); });
    mulaiZoom('label_other', 12);
    ['highway-name-major', 'highway-name-minor', 'highway-name-path'].forEach((id) => cat(id, 'text-color', '#7a8094'));
    ['water_name_point_label', 'water_name_line_label', 'waterway_line_label'].forEach((id) => cat(id, 'text-color', '#5b7393'));
    return gaya;
  }

  let janjiGaya = null;
  function gayaPeta() {
    if (!janjiGaya) {
      janjiGaya = (async () => {
        for (const s of SUMBER_GAYA) {
          try {
            const g = await ambilJson(s.url, 7000);
            return s.redam ? redam(g) : g;
          } catch (e) { /* coba sumber berikutnya */ }
        }
        // Semua sumber gagal: peta polos, penanda tetap tampil
        return { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': LATAR } }] };
      })();
    }
    return janjiGaya;
  }

  // ---------- Membuat peta ----------
  // kooperatif: true = di HP peta digeser dua jari (untuk peta kecil di halaman panjang)
  // putar     : boleh diputar? Bawaan: hanya di layar sentuh (dua jari)
  async function buat(wadah, { pusat, zoom = 12, kooperatif = false, lokasi = false, saatLokasi, putar = LAYAR_SENTUH } = {}) {
    if (typeof maplibregl === 'undefined') throw new Error('Pustaka peta gagal dimuat.');
    wadah.classList.add('peta--memuat');
    let style;
    try {
      style = await gayaPeta();
    } finally {
      wadah.classList.remove('peta--memuat');
    }
    const peta = new maplibregl.Map({
      container: wadah,
      style,
      center: [pusat.lng, pusat.lat],
      zoom,
      minZoom: 10,
      maxZoom: 18.5,
      maxBounds: BATAS_WILAYAH,
      maxPitch: 0,
      pitchWithRotate: false,
      touchPitch: false,
      dragRotate: putar,
      cooperativeGestures: kooperatif,
      attributionControl: { compact: true },
      locale: TEKS
    });
    peta.__siap = false;
    peta.once('load', () => { peta.__siap = true; });
    // Galat peta (misalnya satu ubin gagal dimuat) dicatat sekali saja, bukan berulang di konsol
    peta.on('error', (e) => {
      if (peta.__galatTercatat) return;
      peta.__galatTercatat = true;
      console.warn('[Tally] Peta:', (e && e.error && e.error.message) || e);
    });
    if (!putar) {
      // Komputer: matikan semua cara memutar (klik kanan + seret, Ctrl + seret, Shift + panah)
      peta.keyboard.disableRotation();
      peta.touchZoomRotate.disableRotation();
    }
    peta.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    if (putar) peta.addControl(new KontrolKompas({ ringkas: true }), 'top-right');
    if (lokasi) {
      peta.__lokasi = new KontrolLokasi({ saatLokasi });
      peta.addControl(peta.__lokasi, 'top-right');
    }
    peta.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 96 }), 'bottom-right');
    return peta;
  }

  function saatSiap(peta, fn) {
    if (peta.__siap) fn();
    else peta.once('load', fn);
  }

  function tampilkanGagal(wadah, galat) {
    wadah.innerHTML = `<div class="peta-galat" role="status">${ikon('peringatan')}<p><b>Peta tidak bisa ditampilkan di perangkat ini.</b> ${esc((galat && galat.message) || '')} Daftar dan data proyek tetap bisa dipakai.</p></div>`;
  }

  // ---------- Bentuk geometri ----------
  function lingkaran(lng, lat, meter, titik = 72) {
    const R = 6378137, d = meter / R;
    const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180;
    const cincin = [];
    for (let i = 0; i <= titik; i++) {
      const b = (i / titik) * 2 * Math.PI;
      const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
      const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
      cincin.push([(lo2 * 180) / Math.PI, (la2 * 180) / Math.PI]);
    }
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [cincin] } };
  }

  function batasTitik(daftar) {
    const b = new maplibregl.LngLatBounds();
    daftar.forEach((t) => b.extend([t.lng, t.lat]));
    return b;
  }

  function batasLingkaran(t, meter) {
    const b = new maplibregl.LngLatBounds();
    lingkaran(t.lng, t.lat, meter, 16).geometry.coordinates[0].forEach((k) => b.extend(k));
    return b;
  }

  // Area (lingkaran radius cek GPS / akurasi lokasi) sebagai lapisan GeoJSON
  function aturArea(peta, id, fitur, { warna = WARNA_AREA, putus = true, isi = 0.07 } = {}) {
    saatSiap(peta, () => {
      const data = fitur || { type: 'FeatureCollection', features: [] };
      const sumber = peta.getSource(id);
      if (sumber) { sumber.setData(data); return; }
      peta.addSource(id, { type: 'geojson', data });
      peta.addLayer({ id: id + '-isi', type: 'fill', source: id, paint: { 'fill-color': warna, 'fill-opacity': isi } });
      const garis = { 'line-color': warna, 'line-width': 1.5, 'line-opacity': 0.8 };
      if (putus) garis['line-dasharray'] = [2, 2];
      peta.addLayer({ id: id + '-garis', type: 'line', source: id, paint: garis });
    });
  }

  // ---------- Penanda proyek ----------
  // Warna = status lapangan. Bentuk = ketepatan lokasi: pin untuk titik bangunan
  // atau ruas jalan, bulatan berpendar lembut untuk titik tengah kelurahan/kecamatan.
  const GLIF = {
    tanya: '<path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.3-1.2 1-1.2 1.8v.5"/><circle class="titik" cx="12" cy="17.6" r="1.25"/>',
    centang: '<path d="M6.6 12.6l3.6 3.5 7.2-7.9"/>',
    peringatan: '<path d="M12 6.8v6.6"/><circle class="titik" cx="12" cy="17.4" r="1.3"/>'
  };
  const GLIF_STATUS = { belum: 'tanya', cocok: 'centang', tidak: 'peringatan' };
  const URUT_STATUS = { belum: 1, cocok: 2, tidak: 3 };
  const JALUR_PIN = 'M14 34.6C14 34.6 3 22.7 3 13.7a11 11 0 1 1 22 0C25 22.7 14 34.6 14 34.6Z';

  function svgPenanda(kunci, kira) {
    const glif = GLIF[GLIF_STATUS[kunci] || 'tanya'];
    return kira
      ? `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
          <circle class="penanda__pendar" cx="16" cy="16" r="14.5"/>
          <circle class="penanda__pilih" cx="16" cy="16" r="11.8"/>
          <circle class="penanda__isi" cx="16" cy="16" r="9"/>
          <svg class="penanda__glif" x="10" y="10" width="12" height="12" viewBox="0 0 24 24">${glif}</svg>
        </svg>`
      : `<svg viewBox="0 0 28 36" width="28" height="36" aria-hidden="true" focusable="false">
          <path class="penanda__pilih" d="${JALUR_PIN}"/>
          <path class="penanda__isi" d="${JALUR_PIN}"/>
          <svg class="penanda__glif" x="7.5" y="7.2" width="13" height="13" viewBox="0 0 24 24">${glif}</svg>
        </svg>`;
  }

  function pasangPenanda(peta, p, st, { label, saatPilih } = {}) {
    const kira = lokasiKira(p.presisiLokasi);
    // Penanda yang bisa dipilih = tombol; di peta detail/lapor hanya gambar keterangan
    const el = document.createElement(saatPilih ? 'button' : 'div');
    if (saatPilih) el.type = 'button';
    else el.setAttribute('role', 'img');
    el.className = `penanda penanda--${st.kunci}${kira ? ' penanda--kira' : ''}${saatPilih ? '' : ' penanda--diam'}`;
    el.dataset.id = p.id;
    el.setAttribute('aria-label', label || `${p.id} ${p.nama}. ${st.label}${kira ? '. Lokasi perkiraan' : ''}`);
    el.innerHTML = `<span class="penanda__badan">${svgPenanda(st.kunci, kira)}</span>`;
    el.style.zIndex = String(URUT_STATUS[st.kunci] || 1);
    const m = new maplibregl.Marker({ element: el, anchor: kira ? 'center' : 'bottom' }).setLngLat([p.lng, p.lat]).addTo(peta);
    if (saatPilih) el.addEventListener('click', (e) => { e.stopPropagation(); saatPilih(p.id, el, e); });
    m.__kunci = st.kunci;
    return m;
  }

  function tandaiAktif(m, aktif) {
    if (!m) return;
    const el = m.getElement();
    el.classList.toggle('penanda--aktif', aktif);
    el.style.zIndex = aktif ? '10' : String(URUT_STATUS[m.__kunci] || 1);
    if (aktif) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  }

  // Jarak popup dari titik koordinat, agar tidak menutupi penandanya
  function offsetPopup(presisi) {
    if (lokasiKira(presisi)) return 18;
    return { top: [0, 4], 'top-left': [4, 0], 'top-right': [-4, 0], bottom: [0, -38], 'bottom-left': [8, -32], 'bottom-right': [-8, -32], left: [14, -20], right: [-14, -20], center: [0, -20] };
  }

  // ---------- Titik lokasi pengguna ----------
  function tandaiSaya(peta, posisi) {
    if (!peta.__titikSaya) {
      const el = document.createElement('div');
      el.className = 'titik-saya';
      el.title = 'Lokasimu';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<span class="titik-saya__denyut"></span><span class="titik-saya__inti"></span>';
      peta.__titikSaya = new maplibregl.Marker({ element: el, anchor: 'center' });
    }
    peta.__titikSaya.setLngLat([posisi.lng, posisi.lat]).addTo(peta);
    peta.__titikSaya.getElement().style.zIndex = '20';
    if (posisi.akurasi) {
      aturArea(peta, 'akurasi-saya', lingkaran(posisi.lng, posisi.lat, Math.min(posisi.akurasi, 3000), 48), { warna: WARNA_SAYA, putus: false, isi: 0.1 });
    }
  }

  function dalamWilayah(t) {
    return t.lng >= BATAS_WILAYAH[0][0] && t.lng <= BATAS_WILAYAH[1][0] && t.lat >= BATAS_WILAYAH[0][1] && t.lat <= BATAS_WILAYAH[1][1];
  }

  const PESAN_LOKASI = {
    1: 'Izin lokasi ditolak. Izinkan Lokasi untuk situs ini di pengaturan browser, lalu coba lagi.',
    2: 'Lokasi tidak tersedia. Nyalakan GPS atau Location di perangkat, lalu coba lagi.',
    3: 'Mencari lokasi terlalu lama. Coba lagi di tempat yang lebih terbuka.'
  };

  // Tombol "Tampilkan lokasiku". Lokasi hanya dipakai di perangkat ini, tidak dikirim.
  class KontrolLokasi {
    constructor({ saatLokasi } = {}) {
      this._saatLokasi = saatLokasi;
      this._pantau = null;
      this._posisi = null;
      this._mauTerbang = false;
      this._sudahMengabari = false;
    }
    onAdd(peta) {
      this._peta = peta;
      this._el = document.createElement('div');
      this._el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      this._el.innerHTML = `<button type="button" class="lokasiku" aria-pressed="false" aria-label="Tampilkan lokasiku" title="Tampilkan lokasiku">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="7.2" fill="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" fill="none"/></svg>
      </button>`;
      this._tombol = this._el.querySelector('button');
      this._tombol.addEventListener('click', () => this.mulai(true));
      return this._el;
    }
    onRemove() {
      this.berhenti();
      this._el.remove();
    }
    get posisi() { return this._posisi; }
    mulai(terbang = true) {
      if (!('geolocation' in navigator)) { notif('Browser ini tidak bisa membaca lokasi.'); return; }
      if (!window.isSecureContext) { notif('Lokasi hanya bisa dibaca lewat alamat HTTPS.'); return; }
      if (this._posisi && terbang) this._terbang();
      else if (terbang) this._mauTerbang = true;
      if (this._pantau !== null) return;
      this._sudahMengabari = false;
      this._atur('mencari');
      this._pantau = navigator.geolocation.watchPosition((pos) => this._dapat(pos), (err) => this._gagal(err),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
      // Pantau posisi paling lama 3 menit agar baterai tidak terkuras; tekan tombol lagi untuk memperbarui
      clearTimeout(this._batasWaktu);
      this._batasWaktu = setTimeout(() => this.berhenti(), 180000);
    }
    berhenti() {
      if (this._pantau !== null) navigator.geolocation.clearWatch(this._pantau);
      this._pantau = null;
      clearTimeout(this._batasWaktu);
    }
    _atur(keadaan) {
      this._tombol.classList.toggle('lokasiku--mencari', keadaan === 'mencari');
      this._tombol.classList.toggle('lokasiku--aktif', keadaan === 'aktif');
      this._tombol.setAttribute('aria-pressed', keadaan === 'aktif' ? 'true' : 'false');
      if (keadaan === 'mencari') this._tombol.setAttribute('aria-busy', 'true');
      else this._tombol.removeAttribute('aria-busy');
    }
    _dapat(pos) {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      this._posisi = { lat, lng, akurasi: accuracy };
      this._atur('aktif');
      tandaiSaya(this._peta, this._posisi);
      if (this._mauTerbang) { this._mauTerbang = false; this._terbang(); }
      if (this._saatLokasi) this._saatLokasi(this._posisi);
    }
    _terbang() {
      const t = this._posisi;
      if (!dalamWilayah(t)) {
        notif('Lokasimu di luar wilayah peta Depok, jadi titikmu tidak terlihat di peta.');
        return;
      }
      this._peta.easeTo({ center: [t.lng, t.lat], zoom: Math.max(this._peta.getZoom(), 15), duration: GERAK_HALUS ? 700 : 0 });
    }
    _gagal(err) {
      if (err.code === 1) {
        this.berhenti();
        this._atur(this._posisi ? 'aktif' : 'diam');
      } else if (!this._posisi) {
        this._atur('diam');
      }
      if (!this._sudahMengabari || err.code === 1) {
        this._sudahMengabari = true;
        notif(PESAN_LOKASI[err.code] || 'Gagal membaca lokasi.');
      }
      if (this._saatLokasi && !this._posisi) this._saatLokasi(null, err);
    }
  }

  // Tampilkan lokasi otomatis hanya jika izinnya sudah pernah diberikan (tanpa memunculkan pertanyaan izin)
  function lokasiOtomatis(peta) {
    const k = peta.__lokasi;
    if (!k || !navigator.permissions || !navigator.permissions.query) return;
    navigator.permissions.query({ name: 'geolocation' }).then((s) => { if (s.state === 'granted') k.mulai(false); }).catch(() => {});
  }

  // ---------- Kompas ----------
  // ringkas: hanya piringan kompas, dan baru muncul setelah peta diputar
  // (klik untuk kembali menghadap utara), seperti kompas di Google Maps.
  class KontrolKompas {
    constructor({ ringkas = false } = {}) { this._ringkas = ringkas; }
    onAdd(peta) {
      this._peta = peta;
      const el = (this._el = document.createElement('div'));
      el.className = 'maplibregl-ctrl kompas' + (this._ringkas ? ' kompas--ringkas' : '');
      el.innerHTML = `
        <button type="button" class="kompas__putar" data-putar="45" aria-label="Putar peta ke kiri" title="Putar ke kiri">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.2 6.8A7 7 0 1 1 5.2 13"/><path d="M8.6 2.8v4.4H4.2"/></svg>
        </button>
        <button type="button" class="kompas__piringan" aria-label="Kompas. Klik untuk menghadap utara, seret untuk memutar peta" title="Klik: hadap utara. Seret: putar peta">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g class="kompas__badan">
            <circle class="kompas__bingkai" cx="24" cy="24" r="21.5"/>
            <path class="kompas__garis" d="M3.6 24h2.8M41.6 24h2.8"/>
            <text class="kompas__u" x="24" y="13.4">U</text>
            <text class="kompas__s" x="24" y="41">S</text>
            <path class="kompas__jarum-u" d="M24 15.2l3.3 8.8h-6.6z"/>
            <path class="kompas__jarum-s" d="M24 32.8l-3.3-8.8h6.6z"/>
            <circle class="kompas__poros" cx="24" cy="24" r="1.7"/>
          </g></svg>
        </button>
        <button type="button" class="kompas__putar" data-putar="-45" aria-label="Putar peta ke kanan" title="Putar ke kanan">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.8 6.8A7 7 0 1 0 18.8 13"/><path d="M15.4 2.8v4.4h4.4"/></svg>
        </button>`;
      if (this._ringkas) el.querySelectorAll('.kompas__putar').forEach((b) => b.remove());
      this._badan = el.querySelector('.kompas__badan');
      this._piringan = el.querySelector('.kompas__piringan');
      el.querySelectorAll('[data-putar]').forEach((b) => b.addEventListener('click', () => {
        peta.easeTo({ bearing: peta.getBearing() + Number(b.dataset.putar), duration: GERAK_HALUS ? 350 : 0 });
      }));

      // Klik = kembali ke utara; seret melingkar = putar peta
      let seret = null, abaikanKlik = false;
      this._piringan.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        const r = this._piringan.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        seret = { cx, cy, sudut0: Math.atan2(e.clientY - cy, e.clientX - cx), arah0: peta.getBearing(), x: e.clientX, y: e.clientY, jauh: 0 };
        try { this._piringan.setPointerCapture(e.pointerId); } catch (_) { /* abaikan */ }
      });
      this._piringan.addEventListener('pointermove', (e) => {
        if (!seret) return;
        seret.jauh = Math.max(seret.jauh, Math.hypot(e.clientX - seret.x, e.clientY - seret.y));
        if (seret.jauh < 5) return;
        const sudut = Math.atan2(e.clientY - seret.cy, e.clientX - seret.cx);
        peta.setBearing(seret.arah0 - ((sudut - seret.sudut0) * 180) / Math.PI);
      });
      const lepas = () => {
        if (seret && seret.jauh >= 5) abaikanKlik = true;
        seret = null;
      };
      this._piringan.addEventListener('pointerup', lepas);
      this._piringan.addEventListener('pointercancel', lepas);
      this._piringan.addEventListener('click', () => {
        if (abaikanKlik) { abaikanKlik = false; return; }
        peta.easeTo({ bearing: 0, duration: GERAK_HALUS ? 450 : 0 });
      });
      this._piringan.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        peta.setBearing(peta.getBearing() + (e.key === 'ArrowLeft' ? 15 : -15));
      });

      this._perbarui = () => {
        const b = peta.getBearing();
        this._badan.setAttribute('transform', `rotate(${-b} 24 24)`);
        const miring = Math.abs(((b % 360) + 360) % 360) > 0.5 && Math.abs(((b % 360) + 360) % 360) < 359.5;
        this._el.classList.toggle('kompas--miring', miring);
        this._piringan.setAttribute('aria-label', miring
          ? `Kompas. Peta diputar ${Math.round(((b % 360) + 360) % 360)} derajat. Klik untuk menghadap utara, seret untuk memutar`
          : 'Kompas. Utara di atas. Klik untuk menghadap utara, seret untuk memutar peta');
      };
      peta.on('rotate', this._perbarui);
      this._perbarui();
      return el;
    }
    onRemove() {
      this._peta.off('rotate', this._perbarui);
      this._el.remove();
    }
  }

  // Elemen HTML yang sudah ada (mis. keterangan peta) dipasang sebagai kontrol di dalam peta
  function pasangElemen(peta, el, posisi = 'bottom-left') {
    el.classList.add('maplibregl-ctrl');
    peta.addControl({ onAdd: () => el, onRemove: () => el.remove() }, posisi);
  }

  return { redam, buat, saatSiap, tampilkanGagal, lingkaran, batasTitik, batasLingkaran, aturArea, pasangPenanda, tandaiAktif, offsetPopup, tandaiSaya, lokasiOtomatis, dalamWilayah, svgPenanda, pasangElemen };
})();
