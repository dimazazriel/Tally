// Lacak laporan: resi, batas waktu (SLA), linimasa, foto sebelum/sesudah
(function () {
  const wadah = $('#hasil-lacak');

  async function tampilkan(kode) {
    const k = String(kode || '').trim().toUpperCase();
    if (!k) return;
    $('#kode').value = k;
    history.replaceState(null, '', 'lacak.html?kode=' + encodeURIComponent(k));
    wadah.innerHTML = '<div class="kerangka" style="height:320px;max-width:760px"></div>';
    let h;
    try {
      h = await Data.lacak(k);
    } catch (e) {
      wadah.innerHTML = `<p class="galat">${ikon('peringatan')}Gagal menghubungi database: ${esc(e.message)}</p>`;
      return;
    }
    if (!h) {
      wadah.innerHTML = `<div class="kosong" style="max-width:760px">
        <h2 style="font-size:var(--t-xl)">Kode ${esc(k)} tidak ditemukan</h2>
        <p>Periksa lagi penulisannya: TLY- lalu 4 huruf/angka. Kalau laporan dikirim saat mode cadangan, kodenya hanya bisa dilacak dari perangkat yang sama.</p>
        <a class="tombol tombol--garis" href="panduan.html#kode-contoh">Lihat contoh kode yang bisa dilacak</a>
      </div>`;
      return;
    }

    const kasus = h.kasus, lap = h.laporan, p = h.proyek || {};
    const riw = h.riwayat || [];
    const sla = infoSla(kasus, riw);
    const ditolak = kasus.status === 'Ditolak';
    const tahap = ditolak ? ['Diterima', 'Ditolak'] : ALUR_STATUS;
    const indeksSekarang = tahap.indexOf(kasus.status);

    const linimasa = tahap.map((t, i) => {
      const r = [...riw].reverse().find((x) => x.status === t);
      const selesai = i <= indeksSekarang;
      return `<li class="${t === 'Ditolak' ? 'ditolak' : selesai ? 'selesai' : 'menunggu'}">
        <span class="linimasa__titik">${ikon(t === 'Ditolak' ? 'silang' : selesai ? 'centang' : 'jam')}</span>
        <div><b>${esc(t)}</b><small>${r ? tanggal(r.waktu) + ' · ' : ''}${esc(KET_STATUS[t])}</small>${r && r.catatan && !/^Laporan masuk$/.test(r.catatan) ? `<q>${esc(r.catatan)}</q>` : ''}</div>
      </li>`;
    }).join('');

    const pctSla = sla.selesai ? 100 : Math.min(100, (sla.hari / sla.batas) * 100);
    const teksSla = sla.selesai
      ? `${ditolak ? 'Ditutup' : 'Selesai'} dalam ${sla.hari} hari (batas ${sla.batas} hari).`
      : sla.lewat ? `Lewat ${sla.hari - sla.batas} hari dari batas ${sla.batas} hari. Kasus ini ditandai merah di Papan Skor.`
        : `Hari ke-${sla.hari} dari ${sla.batas}. Sisa ${sla.batas - sla.hari} hari sebelum dinyatakan terlambat.`;

    wadah.innerHTML = `
      <div class="dua-kolom">
        <div class="kertas-bayang resi" style="position:relative">
          <article class="struk">
            <p class="struk__judul">RESI LAPORAN</p>
            <p class="struk__sub">${esc(p.dinas || '')}</p>
            <p class="resi__kode">${esc(lap.kode)}</p>
            <dl>
              <div class="struk__baris"><dt>Proyek</dt><dd>${esc(p.id || '')}</dd></div>
              <div class="struk__baris"><dt>Kondisi</dt><dd>${esc(lap.kondisi)}</dd></div>
              <div class="struk__baris"><dt>Dikirim</dt><dd>${tanggal(lap.dibuatPada)}</dd></div>
              <div class="struk__baris"><dt>Cek GPS</dt><dd>${lap.jarakMeter == null ? 'tanpa lokasi' : (lap.terverifikasi ? 'lolos, ' : 'di luar radius, ') + jarakTeks(lap.jarakMeter)}</dd></div>
              ${lap.indukKode ? `<div class="struk__baris"><dt>Kasus induk</dt><dd>${esc(lap.indukKode)}</dd></div>` : ''}
              <div class="struk__baris struk__baris--tebal"><dt>STATUS</dt><dd>${esc(kasus.status)}</dd></div>
            </dl>
            <p class="struk__catatan">${esc(p.nama || '')}</p>
          </article>
          ${kasus.status === 'Selesai' ? '<span class="stempel stempel--cocok stempel--hentak" style="position:absolute;right:-6px;bottom:70px">Selesai<small>ditangani</small></span>'
            : ditolak ? '<span class="stempel stempel--tidak stempel--hentak" style="position:absolute;right:-6px;bottom:70px">Ditolak<small>lihat catatan</small></span>' : ''}
        </div>
        <div class="tumpuk">
          ${lap.indukKode ? `<p class="sinyal sinyal--info">${ikon('warga')}<span>Laporanmu digabung ke kasus <b>${esc(lap.indukKode)}</b> bersama ${h.anggota} laporan lain dan ${Math.max(0, kasus.jumlahDukungan - h.anggota)} dukungan warga. Status di bawah adalah status kasus itu.</span></p>`
            : (kasus.jumlahDukungan ? `<p class="sinyal sinyal--info">${ikon('warga')}<span>${kasus.jumlahDukungan} warga lain ikut menguatkan kasus ini.</span></p>` : '')}
          <div class="panel">
            <p class="panel__judul">Batas tanggapan</p>
            <div class="sla ${sla.selesai ? 'sla--selesai' : sla.lewat ? 'sla--lewat' : ''}">
              <div class="meter__jalur" role="img" aria-label="${esc(teksSla)}"><div class="meter__isi" style="width:${pctSla}%"></div></div>
              <span class="meter__ket">${esc(teksSla)}</span>
            </div>
            <ol class="linimasa" style="margin-top:16px">${linimasa}</ol>
          </div>
          <div class="panel">
            <p class="panel__judul">Sebelum dan sesudah</p>
            <div class="sebelum-sesudah">
              <figure>${lap.fotoUrl ? `<img src="${esc(lap.fotoUrl)}" alt="Foto dari pelapor" loading="lazy" width="400" height="300">` : '<div class="foto-kosong">Tanpa foto</div>'}<figcaption>Sebelum (warga)</figcaption></figure>
              <figure>${kasus.fotoSesudahUrl ? `<img src="${esc(kasus.fotoSesudahUrl)}" alt="Foto sesudah dari petugas" loading="lazy" width="400" height="300">` : '<div class="foto-kosong">Foto sesudah muncul saat kasus diselesaikan</div>'}<figcaption>Sesudah (petugas/dinas)</figcaption></figure>
            </div>
            ${kasus.tanggapan ? `<p class="sinyal sinyal--info" style="margin-top:12px">${ikon('pesan')}<span><b>Tanggapan:</b> ${esc(kasus.tanggapan)}</span></p>` : ''}
          </div>
          <div class="baris">
            <a class="tombol tombol--garis" href="detail.html?id=${encodeURIComponent(p.id || '')}">Lihat struk proyek</a>
            <button class="tombol tombol--polos" type="button" id="salin-lacak">${ikon('salin')}Salin kode</button>
          </div>
        </div>
      </div>`;
    $('#salin-lacak').addEventListener('click', () => salin(lap.kode));
  }

  $('#form-lacak').addEventListener('submit', (e) => { e.preventDefault(); tampilkan($('#kode').value); });
  if (param('kode')) tampilkan(param('kode'));
  else $('#kode').focus();
})();
