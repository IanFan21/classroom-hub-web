/* ---------- Dashboard ---------- */

var HAL = { guru: {}, siswa: {} };

function kartuStat(angka, label) {
  return '<div class="stat"><div class="angka">' + esc(angka) + '</div><div class="label">' + esc(label) + '</div></div>';
}

HAL.guru.dashboard = async function () {
  var el = $('hal-guru-dashboard');
  el.innerHTML = '<h2>Dashboard Guru</h2><p class="muat">Memuat…</p>';
  var res = await api('dashboardGuru', guruPayload());
  if (!res.ok) {
    el.innerHTML = '<h2>Dashboard Guru</h2><p class="error">' + esc(res.error) + '</p>';
    if (res.error.indexOf('login') !== -1) { Sesi.guruToken = null; tunjukLayar('layar-guru'); }
    return;
  }
  var d = res.data;
  var persen = d.persenHadirBulanBerjalan === null ? '—' : d.persenHadirBulanBerjalan + '%';
  var r = d.ringkasanKompetensi || {};
  el.innerHTML =
    '<h2>Dashboard Guru</h2>' +
    '<div class="stat-grid">' +
    kartuStat(d.jumlahKelas, 'Kelas') +
    kartuStat(d.jumlahSiswa, 'Siswa') +
    kartuStat(d.jumlahMateriAktif, 'Materi aktif') +
    kartuStat(d.tugasBelumDinilai, 'Tugas belum dinilai') +
    kartuStat(persen, '% hadir bulan ini') +
    kartuStat(d.berbasisHadirSaja, 'Kompetensi berbasis hadir saja') +
    '</div>' +
    '<h3>Ringkasan Kompetensi</h3>' +
    '<div class="stat-grid">' +
    kartuStat(r['Sangat kompeten'] || 0, 'Sangat kompeten') +
    kartuStat(r['Kompeten'] || 0, 'Kompeten') +
    kartuStat(r['Berkembang'] || 0, 'Berkembang') +
    kartuStat(r['Perlu bimbingan'] || 0, 'Perlu bimbingan') +
    kartuStat(r['Belum ada data'] || 0, 'Belum ada data') +
    '</div>' +
    '<p class="muted">Data diambil dari spreadsheet Classroom Hub — apa adanya, tanpa angka karangan.</p>';
};

HAL.siswa.dashboard = async function () {
  var el = $('hal-siswa-dashboard');
  var s = Sesi.siswa || {};
  el.innerHTML = '<h2>Halo, ' + esc(s.nama || '') + ' (' + esc(s.kelas || '') + ')</h2><p class="muat">Memuat…</p>';
  var res = await api('dashboardSiswa', siswaPayload());
  if (!res.ok) {
    el.innerHTML = '<h2>Dashboard</h2><p class="error">' + esc(res.error) + '</p>';
    if (res.error.indexOf('login') !== -1) { Sesi.siswa = null; tunjukLayar('layar-siswa'); }
    return;
  }
  var d = res.data;
  var persen = d.persenHadirSaya === null ? '—' : d.persenHadirSaya + '%';
  el.innerHTML =
    '<h2>Halo, ' + esc(d.nama) + ' (' + esc(d.kelas) + ')</h2>' +
    '<div class="stat-grid">' +
    kartuStat(d.tugasAktif, 'Tugas aktif') +
    kartuStat(d.tugasSudahDikumpulkan, 'Sudah dikumpulkan') +
    kartuStat(d.tugasTerlambat, 'Terlambat') +
    kartuStat(persen, '% hadir saya') +
    '</div>' +
    '<p class="muted">Lihat materi dan tugas di menu di atas. Kumpulkan tugas sebelum tenggat.</p>';
};

