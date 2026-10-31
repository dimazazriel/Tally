fetch('data/apbd.json')
  .then((res) => res.json())
  .then((apbd) => {
    // 0. Kepala & kaki struk diambil dari data, bukan diketik manual
    document.getElementById('strukSub').textContent =
      `${apbd.kota.toUpperCase()} · REALISASI ${apbd.tahun}`;
    document.getElementById('strukTotal').innerHTML =
      `<span>TOTAL BELANJA</span><span>${rupiah(apbd.totalBelanja.realisasi)}</span>`;
    const src = document.getElementById('strukSumber');
    src.textContent = 'Sumber: ' + apbd.sumber;
    src.href = apbd.sumberUrl;

    // 1. Tulis tiap jenis belanja sebagai baris struk
    const daftar = document.getElementById('daftarStruk');
    apbd.belanja.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'flex justify-between border-b border-dashed py-1 font-mono text-sm';
      li.innerHTML = `<span>${item.bidang}</span><span>${rupiah(item.nilai)}</span>`;
      daftar.appendChild(li);
    });

    // 2. Gambar grafik batang mendatar
    new Chart(document.getElementById('grafikStruk'), {
      type: 'bar',
      data: {
        labels: apbd.belanja.map((b) => b.bidang),
        datasets: [{ label: 'Belanja (Rp)', data: apbd.belanja.map((b) => b.nilai) }]
      },
      options: { indexAxis: 'y' }
    });
  })
  .catch((err) => console.error('Gagal memuat apbd.json', err));