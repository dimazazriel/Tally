// =====================================================================
// Konfigurasi Tally
// supabaseUrl  : Project URL dari Supabase (Connect / Settings → Data API)
// supabaseKey  : Publishable key (sb_publishable_...) — memang aman dipasang
//                di website. JANGAN pernah menaruh secret key di sini.
// Kalau dua isian ini kosong atau database tidak terjangkau, Tally otomatis
// memakai mode cadangan: data proyek dari data/*.json, laporan disimpan di
// browser (localStorage).
// =====================================================================
window.TALLY_CONFIG = {
  supabaseUrl: 'https://cinsafnhgmyiqwqtjhvf.supabase.co',
  supabaseKey: 'sb_publishable_sgTkxNcBM9SddTN8bjsrZA_PXwIEf3J',
  bucketFoto: 'foto-laporan',

  // Tautan pendukung (tampil di halaman Panduan juri bila diisi)
  repoUrl: 'https://github.com/dimazazriel/Tally',
  situsUrl: 'https://tally-depok.vercel.app',
  videoUrl: '',       // isi dengan link YouTube video pitching
  wireframeUrl: 'https://drive.google.com/drive/folders/1bDgpapqF1obCILRsqxQeroLVkDWHJAB3',

  // PIN demo Panel Petugas (sengaja dibagikan ke juri di halaman Panduan)
  pinDemo: '404404',
  batasHariSla: 7
};
