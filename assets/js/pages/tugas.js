/* ---------- Tugas & Pengumpulan ---------- */

function badgeStatus(status) {
  var cls = '';
  if (status === 'Sudah dinilai' || status === 'Sudah mengumpulkan') cls = 'hijau';
  else if (status === 'Terlambat') cls = 'merah';
  else if (status === 'Perlu revisi') cls = 'kuning';
  return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
}

/** Label jenis kelamin: 'L' -> Laki-laki, 'P' -> Perempuan, else '—'. */
function labelJK(jk) {
  if (jk === 'L') return 'Laki-laki';
  if (jk === 'P') return 'Perempuan';
  return '—';
}

/** Badge penanda siswa pintar (kosong kalau bukan). */
function badgePintar(pintar) {
  return pintar ? '<span class="badge kuning">★ Pintar</span>' : '—';
}

HAL.guru.tugas = async function () {
  var el = $('hal-guru-tugas');
  el.innerHTML = '<h2>Tugas</h2>' +
    '<h3>Tambah Tugas</h3>' +
    '<form id="form-tambah-tugas">' +
    '<label>Judul<input name="judul" required minlength="2" maxlength="150"></label>' +
    '<label>Deskripsi<textarea name="deskripsi" maxlength="1000"></textarea></label>' +
    '<div class="form-inline"><label>Kelas<select name="kelas" required>' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<label>Tenggat<input name="tenggat" type="date" required></label></div>' +
    '<label>Jenis lampiran<select id="jenis-tugas"><option value="">Tanpa lampiran</option><option value="tautan">Tautan</option><option value="file">File (PDF/DOCX/PPTX/gambar, maks 25 MB)</option></select></label>' +
    '<label id="label-url-tugas" hidden>URL tautan<input name="url" type="url" placeholder="https://…"></label>' +
    '<label id="label-file-tugas" hidden>File<input type="file" id="file-tugas"></label>' +
    '<button type="submit" class="tombol utama">Tambah Tugas</button>' +
    '</form><p id="error-tugas" class="error" hidden></p>' +
    '<h3>Daftar Tugas</h3>' +
    '<div class="form-inline"><label>Kelas<select id="filter-tugas-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], true) + '</select></label>' +
    '<label><input type="checkbox" id="filter-tugas-arsip"> Termasuk arsip</label>' +
    '<button class="tombol kecil" id="btn-muat-tugas">Muat</button></div>' +
    '<div id="daftar-tugas"><p class="muat">Memuat…</p></div>' +
    '<div id="detail-tugas"></div>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var sel = el.querySelector('select[name="kelas"]');
      if (sel) sel.innerHTML = opsiKelas(_kelasCache, false);
      var fsel = $('filter-tugas-kelas');
      if (fsel) fsel.innerHTML = opsiKelas(_kelasCache, true);
    }
  }

  $('jenis-tugas').addEventListener('change', function () {
    $('label-url-tugas').hidden = this.value !== 'tautan';
    $('label-file-tugas').hidden = this.value !== 'file';
  });

  $('form-tambah-tugas').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-tugas', null);
    var fd = new FormData(ev.target);
    var dasar = {
      judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '',
      kelas: fd.get('kelas'), tenggat: fd.get('tenggat')
    };
    var jenis = $('jenis-tugas').value;
    if (jenis === 'tautan') {
      var res = await api('tambahTugas', guruPayload(Object.assign(dasar, { url: fd.get('url') })));
      if (!res.ok) { tunjukError('error-tugas', res.error); return; }
      toast('Tugas ditambahkan.');
      HAL.guru.tugas();
    } else if (jenis === 'file') {
      var file = $('file-tugas').files[0];
      if (!file) { tunjukError('error-tugas', 'Pilih file dulu.'); return; }
      var base64 = await fileKeBase64(file);
      var up = await apiUpload('uploadTugas', guruPayload(Object.assign(dasar, {
        namaFile: file.name, mimeType: file.type, size: file.size, base64: base64
      })));
      if (!up.ok) { tunjukError('error-tugas', up.error); return; }
      toast('File diunggah — memverifikasi…');
      setTimeout(function () { HAL.guru.tugas(); }, 1500);
    } else {
      var res2 = await api('tambahTugas', guruPayload(dasar));
      if (!res2.ok) { tunjukError('error-tugas', res2.error); return; }
      toast('Tugas ditambahkan.');
      HAL.guru.tugas();
    }
  });

  var muat = async function () {
    var target = $('daftar-tugas');
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var res = await api('listTugas', guruPayload({
      kelas: $('filter-tugas-kelas').value || undefined,
      termasukArsip: $('filter-tugas-arsip').checked
    }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    if (!res.data.length) { target.innerHTML = '<p class="muted">Belum ada tugas.</p>'; return; }
    var h = '<div class="tabel-wrap"><table><tr><th>Judul</th><th>Kelas</th><th>Tenggat</th><th>Lampiran</th><th></th></tr>';
    res.data.forEach(function (t) {
      h += '<tr><td>' + esc(t.judul) + (t.deskripsi ? '<br><span class="muted">' + esc(t.deskripsi) + '</span>' : '') + '</td>' +
        '<td>' + esc(t.kelas) + '</td><td>' + esc(t.tenggat) + '</td>' +
        '<td>' + (t.link_lampiran ? '<a href="' + esc(t.link_lampiran) + '" target="_blank" rel="noopener">' + esc(t.jenis_lampiran || 'tautan') + '</a>' : '—') + '</td>' +
        '<td><button class="tombol kecil" data-lihat-tugas="' + esc(t.id_tugas) + '">Lihat pengumpulan</button> ' +
        (t.diarsipkan
          ? '<button class="tombol kecil" data-pulihkan-tugas="' + esc(t.id_tugas) + '">Pulihkan</button>'
          : '<button class="tombol kecil" data-arsip-tugas="' + esc(t.id_tugas) + '">Arsipkan</button>') + '</td></tr>';
    });
    target.innerHTML = h + '</table></div>';
    target.querySelectorAll('[data-lihat-tugas]').forEach(function (b) {
      b.addEventListener('click', function () { lihatPengumpulanGuru(b.getAttribute('data-lihat-tugas')); });
    });
    target.querySelectorAll('[data-arsip-tugas]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = await api('arsipTugas', guruPayload({ id_tugas: b.getAttribute('data-arsip-tugas') }));
        if (!r.ok) { toast(r.error); return; }
        toast('Tugas diarsipkan.');
        muat();
      });
    });
    target.querySelectorAll('[data-pulihkan-tugas]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var r = await api('pulihkanTugas', guruPayload({ id_tugas: b.getAttribute('data-pulihkan-tugas') }));
        if (!r.ok) { toast(r.error); return; }
        toast('Tugas dipulihkan.');
        muat();
      });
    });
  };

  $('btn-muat-tugas').addEventListener('click', muat);
  muat();
};

async function lihatPengumpulanGuru(idTugas) {
  var target = $('detail-tugas');
  target.innerHTML = '<p class="muat">Memuat pengumpulan…</p>';
  var res = await api('detailTugas', guruPayload({ id_tugas: idTugas }));
  if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
  var t = res.data.tugas;
  var list = res.data.pengumpulan || [];
  var h = '<h3>Pengumpulan — ' + esc(t.judul) + ' (' + esc(t.kelas) + ', tenggat ' + esc(t.tenggat) + ')</h3>';
  if (!list.length) {
    h += '<p class="muted">Belum ada yang mengumpulkan.</p>';
  } else {
    h += '<div class="tabel-wrap"><table><tr><th>Siswa</th><th>Status</th><th>Nilai</th><th>Waktu Kumpul</th><th>Tautan</th><th>Nilai / Feedback</th></tr>';
    list.forEach(function (p) {
      h += '<tr><td>' + esc(p.nama_siswa) + '</td><td>' + badgeStatus(p.status) + '</td>' +
        '<td>' + esc(labelNilai(p.nilai)) + '</td><td>' + esc(p.waktu_kumpul) + '</td>' +
        '<td>' + (p.link_file ? '<a href="' + esc(p.link_file) + '" target="_blank" rel="noopener">Buka</a>' : '—') + '</td>' +
        '<td><form class="form-inline" data-form-nilai="' + esc(p.id_pengumpulan) + '">' +
        '<label>Nilai<input name="nilai" type="number" min="0" max="100" step="1" value="' + (p.nilai === null ? '' : esc(p.nilai)) + '" style="width:70px"> <span class="huruf-nilai"></span></label>' +
        '<label>Huruf<select name="huruf">' + opsiHuruf() + '</select></label>' +
        '<label>Feedback<input name="feedback" value="' + esc(p.feedback || '') + '"></label>' +
        '<label>Status<select name="status"><option value="Sudah dinilai"' + (p.status === 'Sudah dinilai' ? ' selected' : '') + '>Sudah dinilai</option><option value="Perlu revisi"' + (p.status === 'Perlu revisi' ? ' selected' : '') + '>Perlu revisi</option></select></label>' +
        '<button type="submit" class="tombol kecil utama">Simpan nilai</button></form></td></tr>';
    });
    h += '</table></div><p class="muted">Nilai 0–100 wajib untuk "Sudah dinilai"; feedback wajib untuk "Perlu revisi" (nilai dikosongkan).</p>';
  }
  target.innerHTML = h;
  target.querySelectorAll('[data-form-nilai]').forEach(function (f) {
    pasangPilihHuruf(f);
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var fd = new FormData(f);
      var res2 = await api('nilaiPengumpulan', guruPayload({
        id_pengumpulan: f.getAttribute('data-form-nilai'),
        nilai: fd.get('nilai') === '' ? undefined : Number(fd.get('nilai')),
        feedback: fd.get('feedback'),
        status: fd.get('status')
      }));
      if (!res2.ok) { toast(res2.error); return; }
      toast('Penilaian disimpan.');
      lihatPengumpulanGuru(idTugas);
    });
  });
}

HAL.siswa.tugas = async function () {
  var el = $('hal-siswa-tugas');
  el.innerHTML = '<h2>Tugas Saya</h2><p class="muat">Memuat…</p>';
  var res = await api('listTugas', siswaPayload());
  if (!res.ok) { el.innerHTML = '<h2>Tugas</h2><p class="error">' + esc(res.error) + '</p>'; return; }
  if (!res.data.length) { el.innerHTML = '<h2>Tugas Saya</h2><p class="muted">Belum ada tugas untuk kelas Anda.</p>'; return; }
  var h = '<h2>Tugas Saya</h2><div class="tabel-wrap"><table><tr><th>Judul</th><th>Tenggat</th><th>Lampiran</th><th>Status Saya</th><th></th></tr>';
  res.data.forEach(function (t) {
    h += '<tr><td>' + esc(t.judul) + (t.deskripsi ? '<br><span class="muted">' + esc(t.deskripsi) + '</span>' : '') + '</td>' +
      '<td>' + esc(t.tenggat) + '</td>' +
      '<td>' + (t.link_lampiran ? '<a href="' + esc(t.link_lampiran) + '" target="_blank" rel="noopener">' + esc(t.jenis_lampiran || 'tautan') + '</a>' : '—') + '</td>' +
      '<td id="status-' + esc(t.id_tugas) + '">…</td>' +
      '<td><button class="tombol kecil utama" data-kumpul="' + esc(t.id_tugas) + '">Kumpulkan</button></td></tr>';
  });
  el.innerHTML = h + '</table></div><div id="form-kumpul"></div>';

  // Status masing-masing tugas (pengumpulan terbaru saya).
  res.data.forEach(async function (t) {
    var r = await api('detailTugas', siswaPayload({ id_tugas: t.id_tugas }));
    var sel = $('status-' + t.id_tugas);
    if (!sel) return;
    if (!r.ok || !r.data.pengumpulan.length) { sel.innerHTML = badgeStatus('Belum mengumpulkan'); return; }
    var p = r.data.pengumpulan[0];
    sel.innerHTML = badgeStatus(p.status) + (p.nilai !== null ? ' · Nilai: ' + esc(labelNilai(p.nilai)) : '') + (p.feedback ? '<br><span class="muted">' + esc(p.feedback) + '</span>' : '');
  });

  el.querySelectorAll('[data-kumpul]').forEach(function (b) {
    b.addEventListener('click', function () { tampilFormKumpul(b.getAttribute('data-kumpul')); });
  });
};

function tampilFormKumpul(idTugas) {
  var target = $('form-kumpul');
  target.innerHTML = '<h3>Kumpulkan Tugas</h3>' +
    '<form id="form-kumpul-tugas">' +
    '<label>Jenis pengumpulan<select id="jenis-kumpul"><option value="tautan">Tautan</option><option value="file">File (PDF/DOCX/PPTX/gambar, maks 25 MB)</option></select></label>' +
    '<label id="label-url-kumpul">URL tautan<input name="url" type="url" placeholder="https://…" required></label>' +
    '<label id="label-file-kumpul" hidden>File<input type="file" id="file-kumpul"></label>' +
    '<button type="submit" class="tombol utama">Kirim Pengumpulan</button>' +
    '</form><p id="error-kumpul" class="error" hidden></p>' +
    '<p class="muted">Pengumpulan tercatat sebagai baris baru (riwayat tersimpan). Tugas yang sudah dinilai tidak bisa dikumpulkan ulang.</p>';
  $('jenis-kumpul').addEventListener('change', function () {
    var isFile = this.value === 'file';
    $('label-url-kumpul').hidden = isFile;
    $('label-file-kumpul').hidden = !isFile;
    var urlInput = document.querySelector('#form-kumpul-tugas input[name="url"]');
    if (urlInput) urlInput.required = !isFile;
  });
  $('form-kumpul-tugas').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-kumpul', null);
    if ($('jenis-kumpul').value === 'tautan') {
      var fd = new FormData(ev.target);
      var res = await api('kumpulTautan', siswaPayload({ id_tugas: idTugas, url: fd.get('url') }));
      if (!res.ok) { tunjukError('error-kumpul', res.error); return; }
      toast('Pengumpulan terkirim (' + res.data.status + ').');
      HAL.siswa.tugas();
    } else {
      var file = $('file-kumpul').files[0];
      if (!file) { tunjukError('error-kumpul', 'Pilih file dulu.'); return; }
      var base64 = await fileKeBase64(file);
      var up = await apiUpload('uploadPengumpulan', siswaPayload({
        id_tugas: idTugas, namaFile: file.name, mimeType: file.type, size: file.size, base64: base64
      }));
      if (!up.ok) { tunjukError('error-kumpul', up.error); return; }
      toast('File diunggah — memverifikasi…');
      setTimeout(function () { HAL.siswa.tugas(); }, 1500);
    }
  });
  target.scrollIntoView();
}

