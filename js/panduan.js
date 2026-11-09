// Panduan juri: angka langsung, kode contoh, dan uji API dari database
(async function () {
  const cfg = window.TALLY_CONFIG || {};
  $('#pin-demo').textContent = cfg.pinDemo || '404404';

  // Tautan opsional dari config (video & wireframe)
  const aset = $('#daftar-aset');
  if (cfg.videoUrl) aset.insertAdjacentHTML('afterbegin', `<li><a href="${esc(cfg.videoUrl)}" target="_blank" rel="noopener">Video pitching dan demo (YouTube)</a></li>`);
  if (cfg.wireframeUrl) aset.insertAdjacentHTML('beforeend', `<li><a href="${esc(cfg.wireframeUrl)}" target="_blank" rel="noopener">Wireframe dan sitemap (Google Drive)</a>: rancangan awal semua halaman.</li>`);

  let proyek = [], laporan = [];
  try {
    [proyek, laporan] = await Promise.all([Data.proyek(), Data.laporan()]);
  } catch (e) {
    $('#kode-terbaru').innerHTML = `<tr><td colspan="5"><p class="galat">${ikon('peringatan')}${esc(e.message)}</p></td></tr>`;
  }
  const online = Data.mode === 'online';
  $('#status-panduan').dataset.mode = Data.mode;
  $('#status-panduan').textContent = online
    ? 'Database terhubung: semua langkah di bawah memakai data bersama.'
    : 'Database sedang tidak terjangkau: website memakai mode cadangan (data lokal).';

  const kasus = kelompokkanKasus(laporan);
  const dukungan = laporan.filter((l) => !l.indukKode).reduce((a, l) => a + l.jumlahDukungan, 0);
  [proyek.length, laporan.length, kasus.length, dukungan].forEach((v, i) => ($$('#angka-langsung b')[i].textContent = angka(v)));

  const nama = (id) => (proyek.find((p) => p.id === id) || {}).nama || id;
  const contoh = [...laporan].sort((a, b) => (b.sumber === 'tim') - (a.sumber === 'tim') || new Date(b.dibuatPada) - new Date(a.dibuatPada)).slice(0, 8);
  $('#kode-terbaru').innerHTML = contoh.length ? contoh.map((l) => `<tr>
      <td><a href="lacak.html?kode=${encodeURIComponent(l.kode)}"><code>${esc(l.kode)}</code></a></td>
      <td><a href="detail.html?id=${encodeURIComponent(l.proyekId)}">${esc(l.proyekId)}</a> <small class="pudar">${esc(nama(l.proyekId))}</small></td>
      <td>${lencanaKondisi(l.kondisi)}</td><td>${lencanaStatus(l.status)}</td>
      <td>${l.sumber === 'tim' ? '<span class="chip">kunjungan tim</span>' : '<span class="pudar">publik</span>'}</td></tr>`).join('')
    : '<tr><td colspan="5" class="redup">Belum ada laporan. Kirim laporan uji di langkah 4, lalu kodenya muncul di sini.</td></tr>';

  // Contoh pemanggilan API
  const url = Data.urlDb || 'https://<project>.supabase.co';
  const kunci = Data.kunciPublik || 'sb_publishable_...';
  $('#contoh-api').textContent =
`# Daftar proyek (JSON)
curl "${url}/rest/v1/proyek?select=id,nama,dinas,nilai_kontrak&order=id" \\
  -H "apikey: ${kunci}"

# Laporan untuk satu proyek beserta jumlah dukungannya
curl "${url}/rest/v1/laporan?proyek_id=eq.PRJ-014&select=kode,kondisi,status,jumlah_dukungan" \\
  -H "apikey: ${kunci}"

# Lacak satu kode
curl -X POST "${url}/rest/v1/rpc/lacak" -H "apikey: ${kunci}" \\
  -H "Content-Type: application/json" -d '{"p_kode":"TLY-XXXX"}'`;

  $('#coba-api').addEventListener('click', async () => {
    const out = $('#hasil-api'), b = $('#coba-api');
    out.hidden = false;
    if (!online) { out.textContent = 'Database sedang tidak terjangkau, jadi API tidak bisa dipanggil sekarang. Data terbuka tetap tersedia di data/proyek.json.'; return; }
    b.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(`${url}/rest/v1/proyek?select=id,nama,dinas,nilai_kontrak&order=id&limit=3`, { headers: { apikey: kunci } });
      out.textContent = `HTTP ${res.status}\n` + JSON.stringify(await res.json(), null, 2);
    } catch (e) {
      out.textContent = 'Gagal: ' + e.message;
    }
    b.removeAttribute('aria-busy');
  });
})();
