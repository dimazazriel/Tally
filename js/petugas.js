// Panel petugas: gerbang PIN → antrean kasus → periksa bukti → ubah status
(function () {
  let pin = sessionStorage.getItem('tally_pin') || '';
  let peran = null, proyek = [], laporan = [], riwayat = [], kasus = [], pilihan = null, saringan = 'tindakan';

  const AKSI = {
    'Diterima': [['Diverifikasi', 'Verifikasi bukti', ''], ['Ditolak', 'Tolak', 'bahaya']],
    'Diverifikasi': [['Diteruskan ke dinas', 'Teruskan ke dinas', ''], ['Ditolak', 'Tolak', 'bahaya']],
    'Diteruskan ke dinas': [['Ditindaklanjuti', 'Tandai ditindaklanjuti', '']],
    'Ditindaklanjuti': [['Selesai', 'Selesaikan kasus', 'hijau']],
    'Selesai': [['Ditindaklanjuti', 'Buka lagi', 'garis']],
    'Ditolak': [['Diterima', 'Pulihkan', 'garis']]
  };

  async function masuk(e) {
    if (e) e.preventDefault();
    const nilai = e ? $('#pin').value.trim() : pin;
    if (!nilai) return;
    const tombol = $('#form-pin button');
    tombol.setAttribute('aria-busy', 'true');
    try {
      peran = await Data.cekPin(nilai);
    } catch (err) {
      peran = null;
      $('#galat-pin').innerHTML = `${ikon('peringatan')}Tidak bisa memeriksa PIN: ${esc(err.message)}`;
      $('#galat-pin').hidden = false;
    }
    tombol.removeAttribute('aria-busy');
    if (!peran) {
      if (e && $('#galat-pin').hidden) { $('#galat-pin').innerHTML = `${ikon('peringatan')}PIN salah. Periksa lagi.`; $('#galat-pin').hidden = false; }
      sessionStorage.removeItem('tally_pin');
      return;
    }
    pin = nilai;
    sessionStorage.setItem('tally_pin', pin);
    $('#gerbang').hidden = true;
    $('#ruang').hidden = false;
    $('#panel-admin').hidden = peran !== 'admin';
    perbaruiTombolTim();
    await muat();
  }

  async function muat() {
    try {
      [proyek, laporan, riwayat] = await Promise.all([Data.proyek(), Data.laporan(), Data.riwayat()]);
    } catch (err) {
      $('#antrean').innerHTML = `<tr><td colspan="7"><p class="galat">${ikon('peringatan')}${esc(err.message)}</p></td></tr>`;
      return;
    }
    kasus = kelompokkanKasus(laporan);
    render();
    if (pilihan) bukaDetail(pilihan);
  }

  const namaProyek = (id) => (proyek.find((p) => p.id === id) || {}).nama || id;
  const riwayatKasus = (k) => riwayat.filter((r) => r.kode === k.kode);

  function render() {
    const kata = $('#cari-kasus').value.trim().toLowerCase();
    const daftar = kasus.filter((k) => {
      const sla = infoSla(k, riwayatKasus(k));
      const cocokSaring = saringan === 'semua' || (saringan === 'tindakan' && !statusTutup(k.status)) ||
        (saringan === 'lewat' && sla.lewat) || (saringan === 'tutup' && statusTutup(k.status));
      const cocokKata = !kata || (k.kode + ' ' + k.proyekId + ' ' + namaProyek(k.proyekId)).toLowerCase().includes(kata);
      return cocokSaring && cocokKata;
    }).sort((a, b) => (b.jumlahDukungan - a.jumlahDukungan) || (new Date(a.dibuatPada) - new Date(b.dibuatPada)));

    $('#antrean').innerHTML = daftar.length ? daftar.map((k) => {
      const sla = infoSla(k, riwayatKasus(k));
      const gps = [k, ...k.anggota].some((x) => x.terverifikasi);
      return `<tr class="bisa-klik" tabindex="0" data-kode="${esc(k.kode)}" aria-selected="${k.kode === pilihan}">
        <td><code>${esc(k.kode)}</code>${k.sumber === 'tim' ? ' <span class="chip">tim</span>' : ''}</td>
        <td style="max-width:220px">${esc(namaProyek(k.proyekId))}<br><small class="pudar">${esc(k.proyekId)}</small></td>
        <td>${lencanaKondisi(k.kondisi)}</td>
        <td class="kanan angka">${1 + k.jumlahDukungan}</td>
        <td>${gps ? `<span class="lencana lencana--cocok">${ikon('centang')}lolos</span>` : k.jarakMeter == null ? '<span class="pudar">tanpa lokasi</span>' : `<span class="lencana lencana--cek">${jarakTeks(k.jarakMeter)}</span>`}</td>
        <td class="angka">${sla.lewat ? `<span class="lencana lencana--tidak">${ikon('jam')}hari ${sla.hari}/${sla.batas}</span>` : sla.selesai ? `<span class="pudar">${sla.hari} hari</span>` : `hari ${sla.hari}/${sla.batas}`}</td>
        <td>${lencanaStatus(k.status)}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="7"><div class="kosong" style="border:0;background:none"><h3>Antrean kosong</h3><p>${laporan.length ? 'Tidak ada kasus untuk saringan ini.' : 'Belum ada laporan masuk. Kirim laporan uji dari halaman proyek mana pun, lalu kembali ke sini.'}</p></div></td></tr>`;
  }

  function bukaDetail(kode) {
    pilihan = kode;
    $$('#antrean tr[data-kode]').forEach((tr) => tr.setAttribute('aria-selected', String(tr.dataset.kode === kode)));
    const k = kasus.find((x) => x.kode === kode);
    if (!k) return;
    const semua = [k, ...k.anggota];
    const rk = riwayatKasus(k);
    const aksi = AKSI[k.status] || [];
    $('#detail-kasus').innerHTML = `
      <div class="kasus__kepala" style="margin-bottom:8px"><code style="font-size:var(--t-m)">${esc(k.kode)}</code>${lencanaStatus(k.status)}</div>
      <h2 style="font-size:var(--t-l)">${esc(namaProyek(k.proyekId))}</h2>
      <p class="pudar" style="font-size:var(--t-s);margin:4px 0 12px">${esc(k.proyekId)} · ${lencanaKondisi(k.kondisi)} · ${1 + k.jumlahDukungan} warga</p>
      <div class="kasus__foto" style="margin-bottom:12px">${semua.filter((x) => x.fotoUrl).map((x) => `<a href="${esc(x.fotoUrl)}" target="_blank" rel="noopener"><img src="${esc(x.fotoUrl)}" alt="Bukti ${esc(x.kode)}" width="112" height="84"></a>`).join('') || '<span class="pudar">Tanpa foto</span>'}</div>
      <ul style="margin:0 0 12px;padding-left:1.1em;font-size:var(--t-s);display:grid;gap:4px">
        ${semua.map((x) => `<li><code>${esc(x.kode)}</code> ${x.terverifikasi ? 'lolos cek GPS' : x.jarakMeter == null ? 'tanpa lokasi' : 'di luar radius'}${x.jarakMeter != null ? ' (' + jarakTeks(x.jarakMeter) + ')' : ''}${x.catatan ? ': “' + esc(x.catatan) + '”' : ''}${x.temuan && x.temuan.length ? ' · ' + x.temuan.map(esc).join(', ') : ''}</li>`).join('')}
      </ul>
      <ol class="linimasa">${rk.map((r) => `<li class="${r.status === 'Ditolak' ? 'ditolak' : 'selesai'}"><span class="linimasa__titik">${ikon(r.status === 'Ditolak' ? 'silang' : 'centang')}</span><div><b>${esc(r.status)}</b><small>${tanggal(r.waktu)}</small>${r.catatan && r.catatan !== 'Laporan masuk' ? `<q>${esc(r.catatan)}</q>` : ''}</div></li>`).join('')}</ol>
      <form id="form-aksi" class="tumpuk" style="margin-top:8px">
        <label class="isian"><span>Catatan untuk pelapor <small class="pudar">(wajib untuk Tolak dan Selesai)</small></span>
          <textarea class="kotak" id="catatan-aksi" maxlength="600" style="min-height:80px" placeholder="Contoh: sudah dicek ke lokasi, diteruskan ke DPUPR."></textarea>
        </label>
        <label class="isian" id="isian-sesudah" ${k.status === 'Ditindaklanjuti' ? '' : 'hidden'}><span>Foto sesudah <small class="pudar">(opsional)</small></span>
          <input class="kotak" type="file" id="foto-sesudah" accept="image/*">
        </label>
        <p class="galat" id="galat-aksi" hidden></p>
        <div class="baris">${aksi.map(([s, label, gaya]) => `<button type="button" class="tombol tombol--kecil ${gaya ? 'tombol--' + gaya : ''}" data-status="${esc(s)}">${esc(label)}</button>`).join('')}
          ${peran === 'admin' ? `<button type="button" class="tombol tombol--polos tombol--kecil" id="hapus-kasus">${ikon('sampah')}Hapus</button>` : ''}
        </div>
      </form>`;
  }

  async function jalankanAksi(status) {
    const k = kasus.find((x) => x.kode === pilihan);
    const catatan = $('#catatan-aksi').value.trim();
    const g = $('#galat-aksi');
    g.hidden = true;
    if ((status === 'Ditolak' || status === 'Selesai') && !catatan) {
      g.innerHTML = `${ikon('peringatan')}Tulis catatan untuk pelapor dulu.`;
      g.hidden = false;
      $('#catatan-aksi').focus();
      return;
    }
    $$('#form-aksi button').forEach((b) => (b.disabled = true));
    try {
      let fotoSesudahPath = null;
      const f = $('#foto-sesudah') && $('#foto-sesudah').files[0];
      if (f) fotoSesudahPath = await Data.unggahFoto(await kompresFoto(f), 'sesudah');
      await Data.perbaruiKasus({ kode: k.kode, status, pin, catatan: catatan || null, fotoSesudahPath });
      notif(`${k.kode} → ${status}`);
      await muat();
    } catch (err) {
      g.innerHTML = `${ikon('peringatan')}${esc(err.message)}`;
      g.hidden = false;
      $$('#form-aksi button').forEach((b) => (b.disabled = false));
    }
  }

  // Konfirmasi hapus memakai panel sendiri (tanpa dialog browser)
  function konfirmasiHapus() {
    const k = kasus.find((x) => x.kode === pilihan);
    const lapis = document.createElement('div');
    lapis.className = 'lapisan';
    lapis.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="judul-hapus">
      <h2 id="judul-hapus" class="panel__judul" style="font-size:var(--t-l)">Hapus kasus ${esc(k.kode)}?</h2>
      <p style="font-size:var(--t-s)">${k.anggota.length ? `Kasus ini punya ${k.anggota.length} laporan gabungan yang ikut terhapus. ` : ''}Penghapusan permanen dan tidak bisa dibatalkan. Untuk laporan iseng, "Tolak" biasanya cukup.</p>
      <div class="baris" style="margin-top:16px"><button class="tombol tombol--bahaya" type="button" data-ya>Hapus permanen</button><button class="tombol tombol--garis" type="button" data-batal>Batal</button></div>
    </div>`;
    document.body.appendChild(lapis);
    const tutup = () => lapis.remove();
    lapis.querySelector('[data-batal]').focus();
    lapis.addEventListener('click', async (e) => {
      if (e.target === lapis || e.target.closest('[data-batal]')) return tutup();
      if (e.target.closest('[data-ya]')) {
        try { await Data.hapusLaporan(k.kode, pin); notif(k.kode + ' dihapus'); pilihan = null; $('#detail-kasus').innerHTML = '<p class="pudar">Pilih satu kasus di tabel.</p>'; tutup(); await muat(); }
        catch (err) { notif('Gagal menghapus: ' + err.message); }
      }
    });
    lapis.addEventListener('keydown', (e) => { if (e.key === 'Escape') tutup(); });
  }

  function perbaruiTombolTim() {
    const aktif = (() => { try { return Boolean(localStorage.getItem('tally_kunci_tim')); } catch (e) { return false; } })();
    $('#mode-tim').textContent = aktif ? 'Matikan mode kunjungan tim' : 'Aktifkan mode kunjungan tim';
  }

  // Peristiwa
  $('#form-pin').addEventListener('submit', masuk);
  $('#antrean').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-kode]'); if (tr) bukaDetail(tr.dataset.kode); });
  $('#antrean').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-kode]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); bukaDetail(tr.dataset.kode); } });
  $('#detail-kasus').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (b) jalankanAksi(b.dataset.status);
    if (e.target.closest('#hapus-kasus')) konfirmasiHapus();
  });
  $$('.tab button[data-saring]').forEach((b) => b.addEventListener('click', () => {
    $$('.tab button[data-saring]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    saringan = b.dataset.saring;
    render();
  }));
  $('#cari-kasus').addEventListener('input', render);
  $('#keluar').addEventListener('click', () => { sessionStorage.removeItem('tally_pin'); location.reload(); });
  $('#mode-tim').addEventListener('click', () => {
    try {
      if (localStorage.getItem('tally_kunci_tim')) { localStorage.removeItem('tally_kunci_tim'); notif('Mode kunjungan tim dimatikan di perangkat ini'); }
      else { localStorage.setItem('tally_kunci_tim', pin); notif('Mode kunjungan tim aktif di perangkat ini'); }
    } catch (e) { notif('Browser menolak penyimpanan lokal'); }
    perbaruiTombolTim();
  });
  $('#ekspor').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ diekspor: new Date().toISOString(), laporan, riwayat }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tally-laporan.json';
    a.click();
  });

  if (pin) masuk();
})();
