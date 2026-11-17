/* ---------- Verifikasi (guru) ---------- */

HAL.guru.verifikasi = async function () {
  var el = $('hal-guru-verifikasi');
  el.innerHTML = '<h2>Daftar Verifikasi</h2>' +
    '<p class="muted">Baris meragukan dari sinkron absensi &amp; impor siswa — TIDAK otomatis masuk data. Periksa satu per satu, lalu perbaiki datanya dari halaman terkait.</p>' +
    '<div id="daftar-verifikasi"><p class="muat">Memuat…</p></div>';
  var res = await api('listVerifikasi', guruPayload({ batas: 200 }));
  if (!res.ok) { $('daftar-verifikasi').innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
  if (!res.data.length) { $('daftar-verifikasi').innerHTML = kosongHtml('verifikasi', 'Tidak ada catatan verifikasi', 'Catatan akan muncul setelah ada data yang perlu dicek.'); return; }
  var h = '<div class="tabel-wrap"><table><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Masalah</th><th>Sumber</th><th>Status</th></tr>';
  res.data.forEach(function (v) {
    h += '<tr><td>' + esc(v.tanggal) + '</td><td>' + esc(v.nama) + '</td><td>' + esc(v.kelas) + '</td><td>' + esc(v.alasan) + '</td><td>' + esc(v.sumber) + '</td><td>' + esc(v.status) + '</td></tr>';
  });
  $('daftar-verifikasi').innerHTML = h + '</table></div><p class="muted">Total: ' + res.data.length + ' catatan (terbaru dulu).</p>';
};

