// Sistem desain: tampilkan palet dari token CSS dan hitung kontras WCAG secara langsung
(function () {
  const gaya = getComputedStyle(document.documentElement);
  const token = (n) => gaya.getPropertyValue(n).trim();
  const lum = (hex) => {
    const c = hex.replace('#', '').match(/.{2}/g).map((x) => parseInt(x, 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const kontras = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const WARNA = [
    ['--tinta', 'Tinta', 'teks utama'], ['--tinta-pudar', 'Tinta pudar', 'teks sekunder'],
    ['--cap', 'Cap ungu', 'aksi utama, stempel'], ['--cocok', 'Cocok', 'status baik'],
    ['--tidak', 'Tidak cocok', 'status masalah'], ['--cek', 'Perlu dicek', 'sinyal'],
    ['--belum', 'Belum dicek', 'status netral'], ['--semen', 'Semen', 'latar halaman'],
    ['--kertas', 'Kertas', 'struk dan resi'], ['--putih', 'Putih', 'panel']
  ];
  const semen = token('--semen'), putih = token('--putih');
  $('#contoh-warna').innerHTML = WARNA.map(([n, nama, peran]) => {
    const hex = token(n);
    const latar = ['--semen', '--kertas', '--putih'].includes(n);
    const info = latar ? 'warna latar' : `kontras ${kontras(hex, semen).toFixed(2)} di semen · ${kontras(hex, putih).toFixed(2)} di putih`;
    return `<figure><div style="background:${hex}"></div><figcaption><b>${nama}</b><code>${hex}</code><span class="pudar">${peran}</span><span>${info}</span></figcaption></figure>`;
  }).join('');
  $('#contoh-lencana').innerHTML = [lencanaKondisi('Sesuai'), lencanaKondisi('Terbengkalai'), lencanaStatus('Diterima'), lencanaStatus('Diverifikasi'), lencanaStatus('Selesai'), lencanaStatus('Ditolak'), '<span class="chip">PRJ-014</span>'].join('');
})();
