/* ---------- Dashboard ---------- */

var HAL = { guru: {}, siswa: {} };

function kartuStat(angka, label, namaIkon) {
  return '<div class="stat">' + (namaIkon ? '<span class="stat-ikon">' + ikon(namaIkon) + '</span>' : '') +
    '<div class="angka">' + esc(angka) + '</div><div class="label">' + esc(label) + '</div></div>';
}

HAL.guru.dashboard = async function () {
  var el = $('hal-guru-dashboard');
  el.innerHTML = kepalaSapaan('') + '<p class="muat">Memuat ringkasan…</p>';
  var res = await api('dashboardGuru', guruPayload());
  if (!res.ok) {
    el.innerHTML = kepalaSapaan('') + '<p class="error">' + esc(res.error) + '</p>';
    if (res.error.indexOf('login') !== -1) { Sesi.guruToken = null; tunjukLayar('layar-guru'); }
    return;
  }
  var d = res.data;
  var persen = d.persenHadirBulanBerjalan === null ? '—' : d.persenHadirBulanBerjalan + '%';
  var r = d.ringkasanKompetensi || {};
  el.innerHTML =
    kepalaSapaan('', 'Ringkasan kelas Anda') +
    aksiCepat([
      ['tugas', 'Buat tugas', 'guru:tugas'],
      ['kehadiran', 'Catat kehadiran', 'guru:kehadiran'],
      ['unggah', 'Unggah materi', 'guru:materi'],
      ['penilaian', 'Beri nilai', 'guru:penilaian'],
      ['laporan', 'Buat laporan', 'guru:laporan']
    ]) +
    '<div class="stat-grid tiga">' +
    kartuStat(d.jumlahKelas, 'Kelas', 'kelas') +
    kartuStat(d.jumlahSiswa, 'Siswa', 'orang') +
    kartuStat(d.jumlahMateriAktif, 'Materi aktif', 'materi') +
    kartuStat(d.tugasBelumDinilai, 'Tugas belum dinilai', 'pensil') +
    kartuStat(persen, 'Hadir bulan ini', 'persen') +
    kartuStat(d.berbasisHadirSaja, 'Nilai dari kehadiran saja', 'kehadiran') +
    '</div>' +
    '<h3>Ringkasan kompetensi</h3>' +
    bilahRingkas([
      ['Sangat kompeten', r['Sangat kompeten'] || 0, 'b1'],
      ['Kompeten', r['Kompeten'] || 0, 'b2'],
      ['Berkembang', r['Berkembang'] || 0, 'b3'],
      ['Perlu bimbingan', r['Perlu bimbingan'] || 0, 'b4'],
      ['Belum ada data', r['Belum ada data'] || 0, 'b5']
    ]) +
    '<div class="stat-grid kecil">' +
    kartuStat(r['Sangat kompeten'] || 0, 'Sangat kompeten') +
    kartuStat(r['Kompeten'] || 0, 'Kompeten') +
    kartuStat(r['Berkembang'] || 0, 'Berkembang') +
    kartuStat(r['Perlu bimbingan'] || 0, 'Perlu bimbingan') +
    kartuStat(r['Belum ada data'] || 0, 'Belum ada data') +
    '</div>' +
    '<p class="muted">Data diambil dari spreadsheet Classroom Hub, apa adanya.</p>';
  hidupkan(el);
};

HAL.siswa.dashboard = async function () {
  var el = $('hal-siswa-dashboard');
  var s = Sesi.siswa || {};
  el.innerHTML = kepalaSapaan(s.nama || '', s.kelas || '') + '<p class="muat">Memuat ringkasan…</p>';
  var res = await api('dashboardSiswa', siswaPayload());
  if (!res.ok) {
    el.innerHTML = kepalaSapaan(s.nama || '', s.kelas || '') + '<p class="error">' + esc(res.error) + '</p>';
    if (res.error.indexOf('login') !== -1) { Sesi.siswa = null; tunjukLayar('layar-siswa'); }
    return;
  }
  var d = res.data;
  var persen = d.persenHadirSaya === null ? '—' : d.persenHadirSaya + '%';
  el.innerHTML =
    kepalaSapaan(d.nama, d.kelas) +
    aksiCepat([
      ['tugas', 'Kumpulkan tugas', 'siswa:tugas'],
      ['materi', 'Buka materi', 'siswa:materi'],
      ['kehadiran', 'Lihat kehadiran', 'siswa:kehadiran']
    ]) +
    '<div class="stat-grid">' +
    kartuStat(d.tugasAktif, 'Tugas aktif', 'tugas') +
    kartuStat(d.tugasSudahDikumpulkan, 'Sudah dikumpulkan', 'centang') +
    kartuStat(d.tugasTerlambat, 'Terlambat', 'jam') +
    kartuStat(persen, 'Kehadiran saya', 'persen') +
    '</div>' +
    '<p class="muted">Kumpulkan tugas sebelum tenggat. Materi dan nilai ada di menu samping.</p>';
  hidupkan(el);
};
