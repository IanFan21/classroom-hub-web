/* ---------- Kehadiran ---------- */

function tabelKehadiran(baris) {
  if (!baris.length) return '<p class="muted">Belum ada data kehadiran untuk filter ini.</p>';
  var h = '<div class="tabel-wrap"><table><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Jam</th><th>Sumber</th></tr>';
  baris.forEach(function (r) {
    h += '<tr><td>' + esc(r.tanggal) + '</td><td>' + esc(r.nama) + '</td><td>' + esc(r.kelas) + '</td><td>' + badgeStatus(r.status === 'Hadir' ? 'Sudah mengumpulkan' : r.status) + ' ' + esc(r.status) + '</td><td>' + esc(r.jam) + '</td><td>' + esc(r.sumber_file_id === 'MANUAL' ? 'Input manual' : 'Absensi QR') + '</td></tr>';
  });
  return h + '</table></div>';
}

function csvDariRekap(rekap) {
  var escCsv = function (v) {
    v = String(v === undefined || v === null ? '' : v);
    return (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  var lines = ['Tanggal,Nama,Kelas,Status,Jam,Sumber'];
  rekap.baris.forEach(function (r) {
    lines.push([r.tanggal, r.nama, r.kelas, r.status, r.jam, r.sumber_file_id === 'MANUAL' ? 'Input manual' : 'Absensi QR'].map(escCsv).join(','));
  });
  return lines.join('\n') + '\n';
}

HAL.guru.kehadiran = async function () {
  var el = $('hal-guru-kehadiran');
  var bulanDefault = bulanBerjalan();
  el.innerHTML = '<h2>Kehadiran</h2>' +
    '<h3>Rekap Kehadiran</h3>' +
    '<p class="muted">Isi tanggal untuk rekap satu hari tertentu; kosongkan tanggal untuk rekap sebulan penuh.</p>' +
    '<div class="form-inline"><label>Kelas<select id="rekap-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], true) + '</select></label>' +
    '<label>Bulan<input id="rekap-bulan" type="month" value="' + bulanDefault + '"></label>' +
    '<label>Tanggal<input id="rekap-tanggal" type="date"></label>' +
    '<button class="tombol kecil" id="btn-rekap">Tampilkan</button>' +
    '<button class="tombol kecil" id="btn-rekap-csv">Unduh CSV</button></div>' +
    '<div id="hasil-rekap"><p class="muat">Memuat…</p></div>' +
    '<h3>Sinkron dari Absensi QR</h3>' +
    '<p class="muted">Membaca file sumber Absensi QR per bulan (dipilih berdasarkan ID, bukan nama). Tab "tes kelas" dikecualikan. Nama yang belum terdaftar di tab Siswa masuk daftar Verifikasi. Sinkron idempoten — dijalankan ulang tidak menggandakan baris; Hadir selalu menang atas Alpha.</p>' +
    '<div class="form-inline"><label>Bulan<select id="sinkron-bulan"><option value="2026-08">Agustus 2026</option><option value="2026-09">September 2026</option><option value="2026-10">Oktober 2026</option><option value="2026-11" selected>November 2026</option></select></label>' +
    '<button class="tombol utama" id="btn-sinkron">Sinkronkan</button></div>' +
    '<div id="hasil-sinkron"></div>' +
    '<h3>Input Manual</h3>' +
    '<form id="form-input-manual" class="form-inline">' +
    '<label>Tanggal<input name="tanggal" type="date" required value="' + hariIni() + '"></label>' +
    '<label>Nama<input name="nama" required minlength="2" maxlength="100"></label>' +
    '<label>Kelas<select name="kelas" required>' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<label>Status<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option><option>Terlambat</option></select></label>' +
    '<label>Jam<input name="jam" type="time"></label>' +
    '<button type="submit" class="tombol utama">Catat</button>' +
    '</form><p id="error-manual" class="error" hidden></p>' +
    '<h3>Daftar Kehadiran</h3>' +
    '<div class="form-inline"><label>Kelas<select id="filter-hadir-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], true) + '</select></label>' +
    '<label>Tanggal<input id="filter-hadir-tanggal" type="date"></label>' +
    '<label>Nama<input id="filter-hadir-nama" placeholder="cari nama"></label>' +
    '<label>Bulan<input id="filter-hadir-bulan" type="month"></label>' +
    '<button class="tombol kecil" id="btn-muat-hadir">Muat</button></div>' +
    '<div id="daftar-hadir"></div>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      ['rekap-kelas', 'filter-hadir-kelas'].forEach(function (id) {
        var s = $(id);
        if (s) s.innerHTML = opsiKelas(_kelasCache, true);
      });
      var sk = el.querySelector('select[name="kelas"]');
      if (sk) sk.innerHTML = opsiKelas(_kelasCache, false);
    }
  }

  var muatRekap = async function () {
    var target = $('hasil-rekap');
    target.innerHTML = '<p class="muat">Memuat rekap…</p>';
    var tanggal = $('rekap-tanggal').value || undefined;
    var res = await api('rekapKehadiran', guruPayload({
      kelas: $('rekap-kelas').value || undefined,
      bulan: $('rekap-bulan').value,
      tanggal: tanggal
    }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var r = res.data;
    var persen = r.persenHadir === null ? '—' : r.persenHadir + '%';
    var cakupan = tanggal ? 'Rekap tanggal ' + tanggal : 'Rekap bulan ' + $('rekap-bulan').value;
    target.innerHTML =
      '<p class="muted">' + esc(cakupan) + ' — ' + r.total + ' baris.</p>' +
      '<div class="stat-grid">' +
      kartuStat(r.total, 'Total (siswa × hari)') +
      kartuStat(r.jumlah.Hadir, 'Hadir') +
      kartuStat(r.jumlah.Izin, 'Izin') +
      kartuStat(r.jumlah.Sakit, 'Sakit') +
      kartuStat(r.jumlah.Alpa, 'Alpa') +
      kartuStat(r.jumlah.Terlambat, 'Terlambat') +
      kartuStat(persen, '% hadir') +
      '</div>' + tabelKehadiran(r.baris);
    target._rekap = r;
  };

  $('btn-rekap').addEventListener('click', muatRekap);
  $('rekap-tanggal').addEventListener('change', function () {
    if (this.value) $('rekap-bulan').value = this.value.slice(0, 7);
  });
  $('btn-rekap-csv').addEventListener('click', function () {
    var r = $('hasil-rekap')._rekap;
    if (!r) { toast('Tampilkan rekap dulu.'); return; }
    var kelas = $('rekap-kelas').value || 'semua-kelas';
    var tanggal = $('rekap-tanggal').value;
    var namaBerkas = tanggal
      ? 'rekap-kehadiran-' + kelas.replace(/\s+/g, '-') + '-' + tanggal + '.csv'
      : 'rekap-kehadiran-' + kelas.replace(/\s+/g, '-') + '-' + $('rekap-bulan').value + '.csv';
    unduhTeks(namaBerkas, csvDariRekap(r), 'text/csv; charset=utf-8');
  });

  $('btn-sinkron').addEventListener('click', async function () {
    var target = $('hasil-sinkron');
    target.innerHTML = '<p class="muat">Menyinkronkan… (bisa makan waktu sampai 1 menit)</p>';
    var res = await api('sinkronAbsensi', guruPayload({ bulan: $('sinkron-bulan').value }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var s = res.data;
    var h = '<p class="sukses-teks">Sinkron ' + esc(s.labelFile) + ' selesai: ' + s.dibaca + ' baris dibaca → ' + s.didedup + ' setelah dedup → ' + s.ditulis + ' ditulis, ' + s.diperbarui + ' diperbarui (Alpa→Hadir), ' + s.sudahAda + ' sudah ada.</p>';
    h += '<p class="muted">Tab dibaca: ' + esc(s.tabDibaca.join(', ') || '—') + '. Tab dilewati: ' + (s.tabDilewati.length ? s.tabDilewati.map(function (t) { return esc(t.tab) + ' (' + esc(t.alasan) + ')'; }).join('; ') : '—') + '.</p>';
    if (s.masukVerifikasi.length) {
      h += '<p><strong>' + s.masukVerifikasi.length + ' nama masuk Verifikasi:</strong></p><div class="tabel-wrap"><table><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Alasan</th></tr>';
      s.masukVerifikasi.forEach(function (v) {
        h += '<tr><td>' + esc(v.tanggal) + '</td><td>' + esc(v.nama) + '</td><td>' + esc(v.kelas) + '</td><td>' + esc(v.alasan) + '</td></tr>';
      });
      h += '</table></div>';
    }
    target.innerHTML = h;
    muatRekap();
  });

  $('form-input-manual').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-manual', null);
    var fd = new FormData(ev.target);
    var res = await api('inputManualKehadiran', guruPayload({
      tanggal: fd.get('tanggal'), nama: fd.get('nama'), kelas: fd.get('kelas'),
      status: fd.get('status'), jam: fd.get('jam') || undefined
    }));
    if (!res.ok) { tunjukError('error-manual', res.error); return; }
    toast(res.data.diperbarui ? 'Kehadiran manual diperbarui.' : 'Kehadiran manual dicatat.');
    muatRekap();
  });

  var muatDaftar = async function () {
    var target = $('daftar-hadir');
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var res = await api('listKehadiran', guruPayload({
      kelas: $('filter-hadir-kelas').value || undefined,
      tanggal: $('filter-hadir-tanggal').value || undefined,
      nama: $('filter-hadir-nama').value || undefined,
      bulan: $('filter-hadir-bulan').value || undefined
    }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    target.innerHTML = tabelKehadiran(res.data);
  };
  $('btn-muat-hadir').addEventListener('click', muatDaftar);

  muatRekap();
};

HAL.siswa.kehadiran = async function () {
  var el = $('hal-siswa-kehadiran');
  el.innerHTML = '<h2>Kehadiran Saya</h2>' +
    '<p class="muted">Isi tanggal untuk melihat satu hari tertentu; kosongkan untuk sebulan penuh.</p>' +
    '<div class="form-inline"><label>Bulan<input id="rekap-siswa-bulan" type="month" value="' + bulanBerjalan() + '"></label>' +
    '<label>Tanggal<input id="rekap-siswa-tanggal" type="date"></label>' +
    '<button class="tombol kecil" id="btn-rekap-siswa">Tampilkan</button></div>' +
    '<div id="hasil-rekap-siswa"><p class="muat">Memuat…</p></div>';
  var muat = async function () {
    var target = $('hasil-rekap-siswa');
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var res = await api('rekapKehadiran', siswaPayload({
      bulan: $('rekap-siswa-bulan').value,
      tanggal: $('rekap-siswa-tanggal').value || undefined
    }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var r = res.data;
    var persen = r.persenHadir === null ? '—' : r.persenHadir + '%';
    target.innerHTML =
      '<div class="stat-grid">' +
      kartuStat(r.total, 'Total hari tercatat') +
      kartuStat(r.jumlah.Hadir, 'Hadir') +
      kartuStat(r.jumlah.Izin, 'Izin') +
      kartuStat(r.jumlah.Sakit, 'Sakit') +
      kartuStat(r.jumlah.Alpa, 'Alpa') +
      kartuStat(r.jumlah.Terlambat, 'Terlambat') +
      kartuStat(persen, '% hadir') +
      '</div>' + tabelKehadiran(r.baris);
  };
  $('btn-rekap-siswa').addEventListener('click', muat);
  $('rekap-siswa-tanggal').addEventListener('change', function () {
    if (this.value) $('rekap-siswa-bulan').value = this.value.slice(0, 7);
  });
  muat();
};

