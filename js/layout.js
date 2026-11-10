// =====================================================================
// layout.js — ikon, filter tinta stempel, status database, banner mode
// Dimuat di semua halaman setelah data.js.
// =====================================================================
(function () {
  const IKON = {
    peta: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    kamera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    unggah: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    cari: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    centang: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    silang: '<path d="M6 6l12 12M18 6 6 18"/>',
    peringatan: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    tanya: '<path d="M9 9a3 3 0 1 1 4.2 2.7c-.7.3-1.2 1-1.2 1.8v.5M12 18v.01"/>',
    jam: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bagikan: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
    mata: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    dokumen: '<path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    warga: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    tautan: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
    salin: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    lokasi: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    kanan: '<path d="m9 6 6 6-6 6"/>',
    kiri: '<path d="m15 6-6 6 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    kunci: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    sampah: '<path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"/>',
    keluar: '<path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9"/>',
    perisai: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3Z"/>',
    struk: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z"/><path d="M9 8h6M9 12h6"/>',
    grafik: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    pesan: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
    tambah: '<path d="M12 5v14M5 12h14"/>',
    unduh: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>'
  };

  // Sprite ikon + filter tinta untuk efek cap basah
  const simbol = Object.entries(IKON).map(([nama, isi]) =>
    `<symbol id="i-${nama}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${isi}</symbol>`
  ).join('');
  const sprite = document.createElement('div');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  sprite.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${simbol}
    <filter id="tinta" x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="bising"/>
      <feDisplacementMap in="SourceGraphic" in2="bising" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="geser"/>
      <feComponentTransfer in="bising" result="bintik"><feFuncA type="discrete" tableValues="1 1 1 1 .35 1 1"/></feComponentTransfer>
      <feComposite in="geser" in2="bintik" operator="in"/>
    </filter></svg>`;
  document.body.prepend(sprite);

  // Status database di kaki halaman + banner bila mode cadangan
  Data.siap().then((mode) => {
    $$('.status-db').forEach((el) => {
      el.dataset.mode = mode;
      el.textContent = mode === 'online' ? 'Database terhubung (Supabase)' : 'Mode cadangan: data lokal';
    });
    if (mode === 'cadangan') {
      const b = document.createElement('div');
      b.className = 'banner';
      b.setAttribute('role', 'status');
      b.innerHTML = `${ikon('info')}<div class="wadah" style="width:auto;margin:0">` +
        (Data.adaDb
          ? '<b>Database sedang tidak terjangkau.</b> Tally memakai mode cadangan: data proyek tetap tampil, laporan baru tersimpan di perangkat ini saja.'
          : '<b>Mode cadangan.</b> Database belum diatur, jadi laporan baru tersimpan di perangkat ini saja.') + '</div>';
      const kepala = $('.kepala');
      (kepala ? kepala.after(b) : document.body.prepend(b));
    }
  }).catch((e) => console.error('[Tally] Gagal menyiapkan data:', e));

  // Tautan ke bagian halaman (mis. index.html#cara-kerja) tetap tepat walau
  // konten di atasnya baru selesai dimuat belakangan. Berhenti begitu pengguna
  // menggulir sendiri, atau setelah 4 detik.
  (function jagaJangkar() {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    if (!el || !('ResizeObserver' in window)) return;
    let aktif = true;
    const ro = new ResizeObserver(() => { if (aktif) el.scrollIntoView({ block: 'start', behavior: 'instant' }); });
    const henti = () => { aktif = false; ro.disconnect(); };
    ro.observe(document.body);
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => window.addEventListener(ev, henti, { once: true, passive: true }));
    setTimeout(henti, 4000);
  })();

  // Form "Lacak" di kepala: normalisasi kode
  $$('.lacak-cepat').forEach((f) => f.addEventListener('submit', (e) => {
    const input = f.querySelector('input');
    const kode = input.value.trim().toUpperCase();
    if (!kode) { e.preventDefault(); input.focus(); return; }
    input.value = kode;
  }));
})();
