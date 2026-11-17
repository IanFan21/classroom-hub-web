/* ---------- Kompetensi ---------- */

function badgeKategori(kategori) {
  var cls = '';
  if (kategori === 'Sangat kompeten' || kategori === 'Kompeten') cls = 'hijau';
  else if (kategori === 'Perlu bimbingan') cls = 'merah';
  else if (kategori === 'Berkembang') cls = 'kuning';
  return '<span class="badge ' + cls + '">' + esc(kategori) + '</span>';
}

function tabelKompetensi(list) {
  if (!list.length) return kosongHtml('kompetensi', 'Belum ada data kompetensi', 'Jalankan "Hitung Kompetensi" dulu.');
  var h = '<div class="tabel-wrap"><table><tr><th>Nama</th><th>Kelas</th><th>Skor</th><th>Kategori</th><th>Rata Nilai</th><th>Tugas Dinilai</th><th>% Hadir</th><th>Hari</th><th>Basis</th><th>Dihitung Pada</th></tr>';
  list.forEach(function (k) {
    h += '<tr><td>' + esc(k.nama_siswa) + '</td><td>' + esc(k.kelas) + '</td>' +
      '<td>' + (k.skor === null ? '—' : esc(k.skor)) + '</td><td>' + badgeKategori(k.kategori) + '</td>' +
      '<td>' + (k.rata_nilai === null ? '—' : esc(labelNilai(k.rata_nilai))) + '</td>' +
      '<td>' + esc(k.jumlah_tugas_dinilai) + '</td>' +
      '<td>' + (k.persen_hadir === null ? '—' : esc(k.persen_hadir) + '%') + '</td>' +
      '<td>' + esc(k.jumlah_hari) + '</td><td>' + esc(k.basis) + '</td><td>' + esc(k.dihitung_pada) + '</td></tr>';
  });
  return h + '</table></div>';
}

HAL.guru.kompetensi = async function () {
  var el = $('hal-guru-kompetensi');
  el.innerHTML = '<h2>Kompetensi</h2>' +
    '<p class="muted">Skor = 70% rata-rata nilai + 30% % hadir. Tanpa nilai, skor = % hadir (ditandai "berdasarkan kehadiran saja"). Tanpa data sama sekali → "Belum ada data", bukan 0. Hitung ulang bersifat idempoten (menimpa baris lama).</p>' +
    '<div class="form-inline"><label>Kelas<select id="filter-komp-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], true) + '</select></label>' +
    '<button class="tombol utama" id="btn-hitung-komp">Hitung Kompetensi</button>' +
    '<button class="tombol kecil" id="btn-muat-komp">Muat</button></div>' +
    '<div id="hasil-hitung-komp"></div>' +
    '<div id="daftar-komp"><p class="muat">Memuat…</p></div>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var s = $('filter-komp-kelas');
      if (s) s.innerHTML = opsiKelas(_kelasCache, true);
    }
  }

  var muat = async function () {
    var target = $('daftar-komp');
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var res = await api('listKompetensi', guruPayload({ kelas: $('filter-komp-kelas').value || undefined }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    target.innerHTML = tabelKompetensi(res.data);
  };

  $('btn-muat-komp').addEventListener('click', muat);
  $('btn-hitung-komp').addEventListener('click', async function () {
    var kelas = $('filter-komp-kelas').value;
    if (!kelas) { toast('Pilih kelas dulu untuk menghitung.'); return; }
    var target = $('hasil-hitung-komp');
    target.innerHTML = '<p class="muat">Menghitung…</p>';
    var res = await api('hitungKompetensi', guruPayload({ kelas: kelas }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var d = res.data;
    target.innerHTML = '<p class="sukses-teks">Dihitung: ' + d.dihitung + ' siswa, ' + d.belumAdaData + ' belum ada data, ' + d.berbasisHadirSaja + ' berbasis hadir saja (dari total ' + d.total + ').</p>';
    muat();
  });
  muat();
};

HAL.siswa.kompetensi = async function () {
  var el = $('hal-siswa-kompetensi');
  el.innerHTML = '<h2>Kompetensi Saya</h2><p class="muat">Memuat…</p>';
  var res = await api('listKompetensi', siswaPayload());
  if (!res.ok) { el.innerHTML = '<h2>Kompetensi</h2><p class="error">' + esc(res.error) + '</p>'; return; }
  el.innerHTML = '<h2>Kompetensi Saya</h2>' +
    '<p class="muted">Skor = 70% rata-rata nilai + 30% % hadir. Tanpa nilai, skor = % hadir saja.</p>' +
    tabelKompetensi(res.data);
};

