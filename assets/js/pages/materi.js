/* ---------- Materi ---------- */

/* Ambil ID file Drive dari link yang disimpan (format /file/d/<id>/view
   atau /document/d/<id>/edit). Kosong bila bukan link Drive. */
function ambilIdFileDrive(link) {
  var m = String(link || '').match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

/* Tampilkan pratinjau file Drive di dalam aplikasi (iframe). Hanya untuk
   materi jenis file; tautan luar tetap dibuka lewat "Buka". Pratinjau
   memuat dari Drive dengan akun yang membuka — file harus sudah dibagikan
   "siapa saja yang punya link" (aturan v17) supaya siswa bisa melihat. */
function tampilPratinjauMateri(fileId, judul, link) {
  var wadah = $('pratinjau-materi');
  if (!wadah) return;
  wadah.innerHTML = '<div class="pratinjau-materi"><div class="form-inline"><strong>Pratinjau: ' + esc(judul) + '</strong>' +
    '<button class="tombol kecil" id="btn-tutup-pratinjau" type="button">Tutup</button>' +
    '<a class="tombol kecil" href="' + esc(link) + '" target="_blank" rel="noopener">Buka di tab baru</a></div>' +
    '<iframe src="https://drive.google.com/file/d/' + esc(fileId) + '/preview" title="Pratinjau materi"></iframe></div>';
  var tutup = $('btn-tutup-pratinjau');
  if (tutup) tutup.addEventListener('click', function () { wadah.innerHTML = ''; });
  wadah.scrollIntoView();
}

function tabelMateri(list, bisaArsip) {
  if (!list.length) return kosongHtml('materi', 'Belum ada materi', 'Materi yang diunggah akan muncul di sini.');
  var h = '<div class="tabel-wrap"><table><tr><th>Judul</th><th>Kelas</th><th>Topik</th><th>Jenis</th><th>Tautan</th><th>Dibuat</th>';
  if (bisaArsip) h += '<th></th>';
  h += '</tr>';
  list.forEach(function (m) {
    h += '<tr><td>' + esc(m.judul) + (m.deskripsi ? '<br><span class="muted">' + esc(m.deskripsi) + '</span>' : '') + '</td>' +
      '<td>' + esc(m.kelas) + '</td><td>' + esc(m.topik) + '</td><td>' + esc(m.jenis) + '</td>' +
      '<td><a href="' + esc(m.link_drive) + '" target="_blank" rel="noopener">Buka</a>' +
      (m.jenis === 'file' && ambilIdFileDrive(m.link_drive)
        ? ' <button class="tombol kecil" data-lihat-materi="' + esc(ambilIdFileDrive(m.link_drive)) + '" data-judul-materi="' + esc(m.judul) + '" data-link-materi="' + esc(m.link_drive) + '">Lihat</button>'
        : '') + '</td>' +
      '<td>' + esc(m.dibuat_pada) + '</td>';
    if (bisaArsip) {
      h += '<td>' + (m.diarsipkan
        ? '<button class="tombol kecil" data-pulihkan-materi="' + esc(m.id_materi) + '">Pulihkan</button>'
        : '<button class="tombol kecil" data-arsip-materi="' + esc(m.id_materi) + '">Arsipkan</button>') + '</td>';
    }
    h += '</tr>';
  });
  return h + '</table></div>';
}

HAL.guru.materi = async function () {
  var el = $('hal-guru-materi');
  el.innerHTML = '<h2>Materi</h2>' +
    '<h3>Tambah Materi</h3>' +
    '<form id="form-tambah-materi">' +
    '<label>Judul<input name="judul" required minlength="2" maxlength="150"></label>' +
    '<label>Deskripsi<textarea name="deskripsi" maxlength="1000"></textarea></label>' +
    '<div class="form-inline"><label>Kelas<select name="kelas" required>' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<label>Topik<input name="topik" maxlength="100"></label></div>' +
    '<label>Jenis lampiran<select id="jenis-materi"><option value="tautan">Tautan</option><option value="file">File (PDF/DOCX/PPTX/gambar, maks 25 MB)</option></select></label>' +
    '<label id="label-url-materi">URL tautan<input name="url" type="url" placeholder="https://…"></label>' +
    '<label id="label-file-materi" hidden>File<input type="file" id="file-materi"></label>' +
    '<button type="submit" class="tombol utama">Tambah Materi</button>' +
    '</form><p id="error-materi" class="error" hidden></p>' +
    '<h3>Daftar Materi</h3>' +
    '<div class="form-inline"><label>Kelas<select id="filter-materi-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], true) + '</select></label>' +
    '<label>Cari<input id="filter-materi-q" placeholder="judul/deskripsi"></label>' +
    '<label><input type="checkbox" id="filter-materi-arsip"> Termasuk arsip</label>' +
    '<button class="tombol kecil" id="btn-muat-materi">Muat</button></div>' +
    '<div id="daftar-materi"><p class="muat">Memuat…</p></div>' +
    '<div id="pratinjau-materi"></div>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var sel = el.querySelector('select[name="kelas"]');
      if (sel) sel.innerHTML = opsiKelas(_kelasCache, false);
      var fsel = $('filter-materi-kelas');
      if (fsel) fsel.innerHTML = opsiKelas(_kelasCache, true);
    }
  }

  $('jenis-materi').addEventListener('change', function () {
    var isFile = this.value === 'file';
    $('label-url-materi').hidden = isFile;
    $('label-file-materi').hidden = !isFile;
  });

  $('form-tambah-materi').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-materi', null);
    var fd = new FormData(ev.target);
    var dasar = {
      judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '',
      kelas: fd.get('kelas'), topik: fd.get('topik') || ''
    };
    if ($('jenis-materi').value === 'tautan') {
      var res = await api('tambahMateriTautan', guruPayload(Object.assign(dasar, { url: fd.get('url') })));
      if (!res.ok) { tunjukError('error-materi', res.error); return; }
      toast('Materi ditambahkan.');
      HAL.guru.materi();
    } else {
      var file = $('file-materi').files[0];
      if (!file) { tunjukError('error-materi', 'Pilih file dulu.'); return; }
      var tombolMateri = ev.target.querySelector('button[type="submit"]');
      if (tombolMateri) tombolMateri.disabled = true;
      var base64 = await fileKeBase64(file);
      var up = await apiUpload('uploadMateri', guruPayload(Object.assign(dasar, {
        namaFile: file.name, mimeType: file.type, size: file.size, base64: base64
      })));
      if (!up.ok) { tunjukError('error-materi', up.error); if (tombolMateri) tombolMateri.disabled = false; return; }
      // Verifikasi sungguhan (bukan sekadar toast): muat ulang daftar dan
      // pastikan judul yang baru diunggah benar-benar ada. POST no-cors
      // tidak bisa membaca jawaban server, jadi tanpa cek ini kegagalan
      // server akan terlihat seperti berhasil (laporan 21 Nov 2026).
      var cek = await api('listMateri', guruPayload({ kelas: dasar.kelas, termasukArsip: true }));
      if (!cek.ok) {
        // Daftarnya sendiri tidak bisa dimuat — biasanya sesi guru sudah
        // berakhir. Ini penyebab yang berbeda dari "server menolak file",
        // jadi pesannya dibedakan supaya tidak menyesatkan.
        tunjukError('error-materi', 'Tidak bisa memeriksa daftar: ' + cek.error + ' Coba keluar lalu login lagi sebagai guru, lalu upload ulang.');
        if (tombolMateri) tombolMateri.disabled = false;
        return;
      }
      var judulCek = String(dasar.judul).trim().toLowerCase();
      var masuk = cek.data.some(function (m) { return String(m.judul).trim().toLowerCase() === judulCek; });
      if (masuk) { toast('Materi ditambahkan.'); HAL.guru.materi(); }
      else {
        tunjukError('error-materi', 'Upload tidak masuk ke daftar — server menolak file ini. Coba lagi; kalau masih gagal, kirim filenya lewat chat supaya dicek.');
        if (tombolMateri) tombolMateri.disabled = false;
      }
    }
  });

  var muat = async function () {
    var target = $('daftar-materi');
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var res = await api('listMateri', guruPayload({
      kelas: $('filter-materi-kelas').value || undefined,
      q: $('filter-materi-q').value || undefined,
      termasukArsip: $('filter-materi-arsip').checked
    }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    target.innerHTML = tabelMateri(res.data, true);
    target.querySelectorAll('[data-arsip-materi]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = await api('arsipMateri', guruPayload({ id_materi: b.getAttribute('data-arsip-materi') }));
        if (!r.ok) { toast(r.error); return; }
        toast('Materi diarsipkan.');
        muat();
      });
    });
    target.querySelectorAll('[data-pulihkan-materi]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = await api('pulihkanMateri', guruPayload({ id_materi: b.getAttribute('data-pulihkan-materi') }));
        if (!r.ok) { toast(r.error); return; }
        toast('Materi dipulihkan.');
        muat();
      });
    });
    target.querySelectorAll('[data-lihat-materi]').forEach(function (b) {
      b.addEventListener('click', function () {
        tampilPratinjauMateri(b.getAttribute('data-lihat-materi'), b.getAttribute('data-judul-materi'), b.getAttribute('data-link-materi'));
      });
    });
  };

  $('btn-muat-materi').addEventListener('click', muat);
  muat();
};

HAL.siswa.materi = async function () {
  var el = $('hal-siswa-materi');
  el.innerHTML = '<h2>Materi Kelas Saya</h2><p class="muat">Memuat…</p>';
  var res = await api('listMateri', siswaPayload());
  if (!res.ok) { el.innerHTML = '<h2>Materi</h2><p class="error">' + esc(res.error) + '</p>'; return; }
  el.innerHTML = '<h2>Materi Kelas Saya</h2>' + tabelMateri(res.data, false) + '<div id="pratinjau-materi"></div>';
  el.querySelectorAll('[data-lihat-materi]').forEach(function (b) {
    b.addEventListener('click', function () {
      tampilPratinjauMateri(b.getAttribute('data-lihat-materi'), b.getAttribute('data-judul-materi'), b.getAttribute('data-link-materi'));
    });
  });
};

