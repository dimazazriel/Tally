// Tentang: statistik tender dihitung langsung dari data mentah LPSE
fetch('data/lpse-depok-tender-2025-2026.json').then((r) => r.json()).then((d) => {
  const gagal = d.filter((x) => x.tahap === 'Tender Gagal').length;
  const ulang = d.filter((x) => (x.label || []).includes('Tender Ulang')).length;
  const batal = d.filter((x) => /Batal/.test(x.tahap)).length;
  const per = (ta) => d.filter((x) => x.ta === ta).length;
  $('#statistik-lpse').classList.remove('pudar');
  $('#statistik-lpse').innerHTML = `Dari <strong>${d.length} paket tender</strong> konstruksi dan konsultansi Pemkot Depok tahun anggaran 2025 (${per(2025)} paket) dan 2026 (${per(2026)} paket), <strong>${gagal} tender gagal</strong>, <strong>${ulang} diulang</strong>, dan ${batal} dibatalkan. Angka ini dihitung otomatis dari data mentah LPSE yang kami kumpulkan, <a href="data/lpse-depok-tender-2025-2026.json">unduh di sini</a>.`;
}).catch(() => { $('#statistik-lpse').textContent = ''; });
