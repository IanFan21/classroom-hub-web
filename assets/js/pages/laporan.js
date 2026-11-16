/* ---------- Laporan ---------- */

function tabelLaporan(data) {
  var h = '<p class="muted">' + esc(data.judul) + ' — dibuat ' + esc(data.dibuatPada) + '</p>';
  if (data.ringkasan && data.ringkasan.length) {
    h += '<div class="stat-grid">' + data.ringkasan.map(function (r) {
      return kartuStat(r.nilai, r.label);
    }).join('') + '</div>';
  }
  if (!data.baris.length) return h + '<p class="muted">Tidak ada baris data (laporan kosong tetap valid).</p>';
  h += '<div class="tabel-wrap"><table><tr>' + data.kolom.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
  data.baris.forEach(function (b) {
    h += '<tr>' + b.map(function (v) { return '<td>' + esc(v === null ? '' : v) + '</td>'; }).join('') + '</tr>';
  });
  return h + '</table></div>';
}

function formLaporanHtml(prefix, denganSimpan) {
  return '<div class="form-inline">' +
    '<label>Jenis laporan<select id="' + prefix + '-jenis"><option value="kehadiran">Kehadiran</option><option value="nilai">Nilai</option><option value="kompetensi">Kompetensi</option><option value="kelompok">Kelompok</option></select></label>' +
    '<label>Kelas<select id="' + prefix + '-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], true) + '</select></label>' +
    '<label id="' + prefix + '-label-bulan">Bulan<input id="' + prefix + '-bulan" type="month" value="' + bulanBerjalan() + '"></label>' +
    '<label>Format<select id="' + prefix + '-format"><option value="json">Pratinjau (di layar)</option><option value="csv">CSV (unduh)</option><option value="xlsx">XLSX (unduh)</option><option value="pdf">PDF (unduh)</option></select></label>' +
    '<button class="tombol utama" id="' + prefix + '-tampil">Tampilkan / Unduh</button>' +
    (denganSimpan ? '<button class="tombol" id="' + prefix + '-simpan">Simpan ke Drive</button>' : '') +
    '</div><div id="' + prefix + '-hasil"></div>';
}

async function jalankanLaporan_(prefix, payloadFn) {
  var jenis = $(prefix + '-jenis').value;
  var format = $(prefix + '-format').value;
  var target = $(prefix + '-hasil');
  target.innerHTML = '<p class="muat">Menyusun laporan… (XLSX/PDF bisa makan waktu)</p>';
  var payload = payloadFn(jenis);
  payload.format = format;
  var res = await api('laporan', payload);
  if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
  if (format === 'json') {
    target.innerHTML = tabelLaporan(res.data);
  } else if (format === 'csv') {
    unduhTeks(res.data.namaFile, res.data.csv, 'text/csv; charset=utf-8');
    target.innerHTML = '<p class="sukses-teks">CSV diunduh: ' + esc(res.data.namaFile) + '</p>';
  } else {
    var mime = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';
    unduhBase64(res.data.namaFile, res.data.base64, mime);
    target.innerHTML = '<p class="sukses-teks">Berkas diunduh: ' + esc(res.data.namaFile) + '</p>';
  }
}

HAL.guru.laporan = async function () {
  var el = $('hal-guru-laporan');
  el.innerHTML = '<h2>Laporan &amp; Ekspor</h2>' +
    '<p class="muted">Semua laporan adalah data apa adanya dari spreadsheet — tidak ada angka yang dikarang. Data kosong tetap menghasilkan berkas valid (header + 0 baris).</p>' +
    formLaporanHtml('lap-guru', true);

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var s = $('lap-guru-kelas');
      if (s) s.innerHTML = opsiKelas(_kelasCache, true);
    }
  }

  $('lap-guru-jenis').addEventListener('change', function () {
    $('lap-guru-label-bulan').style.display = this.value === 'kehadiran' ? '' : 'none';
  });
  $('lap-guru-label-bulan').style.display = '';

  $('lap-guru-tampil').addEventListener('click', function () {
    jalankanLaporan_('lap-guru', function (jenis) {
      return guruPayload({
        jenis: jenis,
        kelas: $('lap-guru-kelas').value || undefined,
        bulan: jenis === 'kehadiran' ? $('lap-guru-bulan').value : undefined
      });
    });
  });

  $('lap-guru-simpan').addEventListener('click', async function () {
    var jenis = $('lap-guru-jenis').value;
    var target = $('lap-guru-hasil');
    target.innerHTML = '<p class="muat">Menyimpan ke Drive…</p>';
    var res = await api('simpanLaporan', guruPayload({
      jenis: jenis,
      kelas: $('lap-guru-kelas').value || undefined,
      bulan: jenis === 'kehadiran' ? $('lap-guru-bulan').value : undefined,
      format: $('lap-guru-format').value === 'json' ? 'xlsx' : $('lap-guru-format').value
    }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    target.innerHTML = '<p class="sukses-teks">Tersimpan di folder Laporan &amp; Ekspor: <a href="' + esc(res.data.webViewLink) + '" target="_blank" rel="noopener">' + esc(res.data.name) + '</a></p>';
  });
};

HAL.siswa.laporan = async function () {
  var el = $('hal-siswa-laporan');
  el.innerHTML = '<h2>Laporan Saya</h2>' +
    '<p class="muted">Hanya baris Anda / kelas Anda yang ditampilkan.</p>' +
    '<div class="form-inline">' +
    '<label>Jenis laporan<select id="lap-siswa-jenis"><option value="kehadiran">Kehadiran</option><option value="nilai">Nilai</option><option value="kompetensi">Kompetensi</option><option value="kelompok">Kelompok</option></select></label>' +
    '<label id="lap-siswa-label-bulan">Bulan<input id="lap-siswa-bulan" type="month" value="' + bulanBerjalan() + '"></label>' +
    '<label>Format<select id="lap-siswa-format"><option value="json">Pratinjau (di layar)</option><option value="csv">CSV (unduh)</option><option value="xlsx">XLSX (unduh)</option><option value="pdf">PDF (unduh)</option></select></label>' +
    '<button class="tombol utama" id="lap-siswa-tampil">Tampilkan / Unduh</button>' +
    '</div><div id="lap-siswa-hasil"></div>';

  $('lap-siswa-jenis').addEventListener('change', function () {
    $('lap-siswa-label-bulan').style.display = this.value === 'kehadiran' ? '' : 'none';
  });
  $('lap-siswa-label-bulan').style.display = '';

  $('lap-siswa-tampil').addEventListener('click', function () {
    jalankanLaporan_('lap-siswa', function (jenis) {
      return siswaPayload({
        jenis: jenis,
        bulan: jenis === 'kehadiran' ? $('lap-siswa-bulan').value : undefined
      });
    });
  });
};

