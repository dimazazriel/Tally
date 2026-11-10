// Jejak perubahan publik: siapa mengubah apa, lewat jalur mana, dengan alasan apa
(async function () {
  const tbody = $('#isi-jejak');
  let semua = null;
  try {
    semua = await Data.jejak({ batas: 500 });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6"><p class="galat">${ikon('peringatan')}Jejak gagal dimuat: ${esc(e.message)}</p></td></tr>`;
    return;
  }

  // Arti setiap jalur (juga dipakai untuk pilihan saringan)
  $('#arti-jalur').innerHTML = Object.entries(JALUR_JEJAK)
    .map(([k, v]) => `<div><dt>${lencanaJalur(k)}</dt><dd>${esc(v.ket)}</dd></div>`).join('');

  if (semua === null) {
    $$('#ringkas-jejak b').forEach((b) => (b.textContent = '—'));
    tbody.innerHTML = `<tr><td colspan="6"><div class="kosong" style="border:0;background:none">
      <h3>Jejak perubahan belum aktif di database ini</h3>
      <p>Untuk tim: jalankan berkas <code>supabase/schema.sql</code> terbaru di SQL Editor Supabase. Setelah itu setiap perubahan tercatat otomatis.</p></div></td></tr>`;
    return;
  }

  // Satu tindakan bisa mengubah beberapa baris sekaligus (kasus + laporan
  // gabungannya). Baris dengan waktu, jalur, aksi, dan alasan yang sama
  // ditampilkan sebagai satu peristiwa.
  const peristiwa = [];
  semua.forEach((j) => {
    const kunci = [j.waktu, j.objek, j.aksi, j.jalur, j.alasan || ''].join('|');
    const akhir = peristiwa[peristiwa.length - 1];
    if (akhir && akhir.kunciGrup === kunci) akhir.anggota.push(j);
    else peristiwa.push({ kunciGrup: kunci, waktu: j.waktu, objek: j.objek, aksi: j.aksi, jalur: j.jalur, alasan: j.alasan, anggota: [j] });
  });

  const hitung = (f) => angka(peristiwa.filter(f).length);
  const isiRingkas = [
    angka(peristiwa.length),
    hitung((p) => p.jalur === 'petugas'),
    hitung((p) => p.jalur === 'admin' && p.aksi === 'dihapus'),
    hitung((p) => p.jalur === 'dasbor database')
  ];
  $$('#ringkas-jejak b').forEach((b, i) => (b.textContent = isiRingkas[i]));

  // Pilihan saringan jalur: semua jalur yang dikenal + yang muncul di data
  const jalurAda = [...new Set([...Object.keys(JALUR_JEJAK), ...semua.map((j) => j.jalur)])];
  $('#saring-jalur').insertAdjacentHTML('beforeend', jalurAda.map((j) => `<option value="${esc(j)}">${esc(labelJalur(j))}</option>`).join(''));

  function lencanaJalur(jalur) {
    if (jalur === 'dasbor database') return `<span class="lencana lencana--cek">${ikon('database')}${esc(labelJalur(jalur))}</span>`;
    if (jalur === 'admin') return `<span class="lencana lencana--cap">${ikon('kunci')}${esc(labelJalur(jalur))}</span>`;
    if (jalur === 'petugas') return `<span class="lencana">${ikon('perisai')}${esc(labelJalur(jalur))}</span>`;
    return `<span class="chip">${esc(labelJalur(jalur))}</span>`;
  }

  function lencanaAksi(aksi) {
    if (aksi === 'dihapus') return `<span class="lencana lencana--tidak">${ikon('sampah')}dihapus</span>`;
    if (aksi === 'ditambah') return `<span class="lencana lencana--cap">${ikon('tambah')}ditambah</span>`;
    return `<span class="lencana">diubah</span>`;
  }

  const tautanData = (j) => j.objek === 'proyek'
    ? `<a href="detail.html?id=${encodeURIComponent(j.kunci)}"><code>${esc(j.kunci)}</code></a>`
    : `<a href="lacak.html?kode=${encodeURIComponent(j.kunci)}"><code>${esc(j.kunci)}</code></a>`;

  function isiPerubahan(p) {
    const unik = new Map();
    p.anggota.forEach((j) => {
      const baris = ringkasJejak(j);
      const k = baris.join('\n');
      if (!unik.has(k)) unik.set(k, { baris, kunci: [] });
      unik.get(k).kunci.push(j.kunci);
    });
    const kelompok = [...unik.values()];
    const daftar = (baris) => baris.length
      ? `<ul class="jejak-ubah">${baris.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '<span class="pudar">—</span>';
    if (kelompok.length === 1) return daftar(kelompok[0].baris);
    return kelompok.map((g) => `<div class="jejak-ubah__grup"><small>${g.kunci.map(esc).join(', ')}</small>${daftar(g.baris)}</div>`).join('');
  }

  function render() {
    const kata = $('#cari-jejak').value.trim().toUpperCase();
    const aksi = $('#saring-aksi').value;
    const jalur = $('#saring-jalur').value;
    const tampil = peristiwa.filter((p) =>
      (!kata || p.anggota.some((j) => j.kunci.toUpperCase().includes(kata))) &&
      (!aksi || p.aksi === aksi) && (!jalur || p.jalur === jalur));

    tbody.innerHTML = tampil.length ? tampil.map((p) => {
      const kunci = p.anggota.map(tautanData);
      return `<tr>
        <td class="angka" style="white-space:nowrap">${tanggal(p.waktu)}<br><small class="pudar">${esc(sejak(p.waktu))}</small></td>
        <td style="min-width:120px">${kunci.slice(0, 4).join('<br>')}${kunci.length > 4 ? `<br><small class="pudar">+${kunci.length - 4} lainnya</small>` : ''}<br><small class="pudar">${p.objek === 'proyek' ? 'data proyek' : p.anggota.length > 1 ? 'kasus + laporan gabungan' : 'laporan'}</small></td>
        <td>${lencanaAksi(p.aksi)}</td>
        <td>${lencanaJalur(p.jalur)}</td>
        <td style="min-width:240px">${isiPerubahan(p)}</td>
        <td style="min-width:180px">${p.alasan ? esc(p.alasan) : '<span class="pudar">—</span>'}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="6"><div class="kosong" style="border:0;background:none">
        <h3>${peristiwa.length ? 'Tidak ada catatan untuk saringan ini' : 'Belum ada perubahan tercatat'}</h3>
        <p>${peristiwa.length ? 'Coba hapus kata kunci atau ganti saringan.' : 'Begitu petugas mengubah status kasus, admin menghapus laporan, atau seseorang menyunting data langsung di database, catatannya muncul di sini.'}</p></div></td></tr>`;

    $('#info-jejak').textContent = (Data.mode === 'cadangan' ? 'Mode cadangan: jejak di bawah hanya berasal dari perangkat ini. ' : '') +
      `Menampilkan ${angka(tampil.length)} dari ${angka(peristiwa.length)} peristiwa terbaru. Perubahan sebelum fitur ini dipasang tidak tercatat.`;
  }

  if (param('kode')) $('#cari-jejak').value = param('kode').trim().toUpperCase();
  $('#saring-jejak').addEventListener('submit', (e) => e.preventDefault());
  $('#cari-jejak').addEventListener('input', render);
  $('#saring-aksi').addEventListener('change', render);
  $('#saring-jalur').addEventListener('change', render);
  render();
})();
