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
    '<label>Tenggat<input name="tenggat" type="date" required></label>' +
    '<label>Tanggal mulai (opsional)<input name="tanggal_mulai" type="date"></label></div>' +
    '<label id="label-jenis-tugas">Jenis lampiran<select id="jenis-tugas"><option value="">Tanpa lampiran</option><option value="tautan">Tautan</option><option value="file">File (PDF/DOCX/PPTX/gambar, maks 25 MB)</option></select></label>' +
    '<label id="label-url-tugas" hidden>URL tautan<input name="url" type="url" placeholder="https://…"></label>' +
    '<label id="label-file-tugas" hidden>File<input type="file" id="file-tugas"></label>' +
    '<button type="submit" class="tombol utama" id="btn-simpan-tugas">Tambah Tugas</button> ' +
    '<button type="button" class="tombol kecil" id="btn-batal-edit" hidden>Batal edit</button>' +
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

  $('btn-batal-edit').addEventListener('click', function () { HAL.guru.tugas(); });

  $('form-tambah-tugas').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var btnSimpan = $('btn-simpan-tugas');
    if (btnSimpan.disabled) return; // cegah klik ganda membuat 2 baris tugas yang sama
    btnSimpan.disabled = true;
    tunjukError('error-tugas', null);
    var fd = new FormData(ev.target);
    var dasar = {
      judul: fd.get('judul'), deskripsi: fd.get('deskripsi') || '',
      kelas: fd.get('kelas'), tenggat: fd.get('tenggat'),
      tanggal_mulai: fd.get('tanggal_mulai') || ''
    };
    var editId = ev.target.getAttribute('data-edit-tugas');
    if (editId) {
      // Mode edit: hanya teks (judul/deskripsi/kelas/tanggal) yang berubah;
      // lampiran, tanggal dibuat, dan status arsip tetap.
      var resE = await api('editTugas', guruPayload(Object.assign(dasar, { id_tugas: editId })));
      if (!resE.ok) { tunjukError('error-tugas', resE.error); btnSimpan.disabled = false; return; }
      toast('Tugas diubah.');
      HAL.guru.tugas();
      return;
    }
    var jenis = $('jenis-tugas').value;
    if (jenis === 'tautan') {
      var res = await api('tambahTugas', guruPayload(Object.assign(dasar, { url: fd.get('url') })));
      if (!res.ok) { tunjukError('error-tugas', res.error); btnSimpan.disabled = false; return; }
      toast('Tugas ditambahkan.');
      HAL.guru.tugas();
    } else if (jenis === 'file') {
      var file = $('file-tugas').files[0];
      if (!file) { tunjukError('error-tugas', 'Pilih file dulu.'); btnSimpan.disabled = false; return; }
      var base64 = await fileKeBase64(file);
      var up = await apiUpload('uploadTugas', guruPayload(Object.assign(dasar, {
        namaFile: file.name, mimeType: file.type, size: file.size, base64: base64
      })));
      if (!up.ok) { tunjukError('error-tugas', up.error); btnSimpan.disabled = false; return; }
      toast('File diunggah — memverifikasi…');
      setTimeout(function () { HAL.guru.tugas(); }, 1500);
    } else {
      var res2 = await api('tambahTugas', guruPayload(dasar));
      if (!res2.ok) { tunjukError('error-tugas', res2.error); btnSimpan.disabled = false; return; }
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
    if (!res.data.length) { target.innerHTML = kosongHtml('tugas', 'Belum ada tugas', 'Buat tugas lewat formulir di atas.'); return; }
    var h = '<div class="tabel-wrap"><table><tr><th>Judul</th><th>Kelas</th><th>Tenggat</th><th>Lampiran</th><th></th></tr>';
    var petaTugas = {};
    res.data.forEach(function (t) {
      petaTugas[t.id_tugas] = t;
      h += '<tr><td>' + esc(t.judul) + (t.deskripsi ? '<br><span class="muted">' + esc(t.deskripsi) + '</span>' : '') + '</td>' +
        '<td>' + esc(t.kelas) + '</td><td>' + esc(labelRentang(t.tanggal_mulai, t.tenggat)) + '</td>' +
        '<td>' + (t.link_lampiran ? '<a href="' + esc(t.link_lampiran) + '" target="_blank" rel="noopener">' + esc(t.jenis_lampiran || 'tautan') + '</a>' : '—') + '</td>' +
        '<td><button class="tombol kecil" data-lihat-tugas="' + esc(t.id_tugas) + '">Lihat pengumpulan</button> ' +
        '<button class="tombol kecil" data-soal-tugas="' + esc(t.id_tugas) + '">Soal &amp; Kunci</button> ' +
        '<button class="tombol kecil" data-edit-tugas="' + esc(t.id_tugas) + '">Edit</button> ' +
        '<button class="tombol kecil" data-hapus-tugas="' + esc(t.id_tugas) + '">Hapus</button> ' +
        (t.diarsipkan
          ? '<button class="tombol kecil" data-pulihkan-tugas="' + esc(t.id_tugas) + '">Pulihkan</button>'
          : '<button class="tombol kecil" data-arsip-tugas="' + esc(t.id_tugas) + '">Arsipkan</button>') + '</td></tr>';
    });
    target.innerHTML = h + '</table></div>';
    target.querySelectorAll('[data-lihat-tugas]').forEach(function (b) {
      b.addEventListener('click', function () { lihatPengumpulanGuru(b.getAttribute('data-lihat-tugas')); });
    });
    target.querySelectorAll('[data-soal-tugas]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t2 = petaTugas[b.getAttribute('data-soal-tugas')];
        kelolaSoalGuru(b.getAttribute('data-soal-tugas'), t2 ? t2.judul : '');
      });
    });
    target.querySelectorAll('[data-edit-tugas]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = petaTugas[b.getAttribute('data-edit-tugas')];
        if (!t) return;
        var f = $('form-tambah-tugas');
        f.querySelector('input[name="judul"]').value = t.judul;
        f.querySelector('textarea[name="deskripsi"]').value = t.deskripsi || '';
        f.querySelector('select[name="kelas"]').value = t.kelas;
        f.querySelector('input[name="tenggat"]').value = t.tenggat;
        f.querySelector('input[name="tanggal_mulai"]').value = t.tanggal_mulai || '';
        f.setAttribute('data-edit-tugas', t.id_tugas);
        $('label-jenis-tugas').hidden = true;
        $('label-url-tugas').hidden = true;
        $('label-file-tugas').hidden = true;
        $('btn-simpan-tugas').textContent = 'Simpan perubahan';
        $('btn-batal-edit').hidden = false;
        f.scrollIntoView();
        toast('Mengubah tugas "' + t.judul + '" — lampiran tidak ikut berubah.');
      });
    });
    target.querySelectorAll('[data-hapus-tugas]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.getAttribute('data-hapus-tugas');
        var t = petaTugas[id];
        if (!confirm('Hapus tugas "' + (t ? t.judul : id) + '"? Tugas yang sudah ada pengumpulan/nilai tidak bisa dihapus — arsipkan saja.')) return;
        var r = await api('hapusTugas', guruPayload({ id_tugas: id }));
        if (!r.ok) { toast(r.error); return; }
        toast('Tugas dihapus.');
        muat();
      });
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
  var h = '<h3>Pengumpulan — ' + esc(t.judul) + ' (' + esc(t.kelas) + ', ' + esc(labelRentang(t.tanggal_mulai, t.tenggat)) + ')</h3>';
  if (!list.length) {
    h += kosongHtml('kosong', 'Belum ada yang mengumpulkan', 'Pengumpulan siswa akan muncul di sini.');
  } else {
    h += '<div class="tabel-wrap"><table><tr><th>Siswa</th><th>Status</th><th>Nilai</th><th>Waktu Kumpul</th><th>Tautan</th><th>Nilai / Feedback</th></tr>';
    list.forEach(function (p) {
      h += '<tr><td>' + esc(p.nama_siswa) + '</td><td>' + badgeStatus(p.status) + '</td>' +
        '<td>' + esc(labelNilai(p.nilai)) + (p.jenis === 'otomatis' ? ' <span class="muted">(otomatis)</span>' : '') + '</td><td>' + esc(p.waktu_kumpul) + '</td>' +
        '<td>' + (p.link_file ? '<a href="' + esc(p.link_file) + '" target="_blank" rel="noopener">Buka</a>' : (p.jenis === 'otomatis' ? '<button class="tombol kecil" data-rincian-otomatis="' + esc(p.id_siswa) + '">Rincian cek</button>' : '—')) + '</td>' +
        '<td><form class="form-inline" data-form-nilai="' + esc(p.id_pengumpulan) + '">' +
        '<label>Nilai<input name="nilai" type="number" min="0" max="100" step="1" value="' + (p.nilai === null ? '' : esc(p.nilai)) + '"></label>' +
        '<label>Huruf<select name="huruf">' + opsiHuruf() + '</select></label>' +
        '<label>Feedback<input name="feedback" value="' + esc(p.feedback || '') + '"></label>' +
        '<label>Status<select name="status"><option value="Sudah dinilai"' + (p.status === 'Sudah dinilai' ? ' selected' : '') + '>Sudah dinilai</option><option value="Perlu revisi"' + (p.status === 'Perlu revisi' ? ' selected' : '') + '>Perlu revisi</option></select></label>' +
        '<button type="submit" class="tombol kecil utama">Simpan nilai</button></form></td></tr>';
    });
    h += '</table></div><p class="muted">Nilai 0–100 wajib untuk "Sudah dinilai"; feedback wajib untuk "Perlu revisi" (nilai dikosongkan).</p><div id="rincian-otomatis"></div>';
  }
  target.innerHTML = h;
  target.querySelectorAll('[data-rincian-otomatis]').forEach(function (b) {
    b.addEventListener('click', async function () {
      var wadah = $('rincian-otomatis');
      if (!wadah) return;
      wadah.innerHTML = '<p class="muat">Memuat rincian…</p>';
      var r = await api('listJawaban', guruPayload({ id_tugas: idTugas, id_siswa: b.getAttribute('data-rincian-otomatis') }));
      if (!r.ok) { wadah.innerHTML = '<p class="error">' + esc(r.error) + '</p>'; return; }
      if (!r.data.length) { wadah.innerHTML = '<p class="muted">Belum ada rincian jawaban.</p>'; return; }
      var hh = '<h3>Rincian cek otomatis</h3><div class="tabel-wrap"><table><tr><th>Soal</th><th>Jawaban siswa</th><th>Skor</th><th>Rincian</th></tr>';
      r.data.forEach(function (j) {
        hh += '<tr><td>' + esc(j.no_soal) + '</td><td>' + esc(j.jawaban || '—') + '</td><td>' + esc(j.skor) + '/' + esc(j.bobot) + '</td><td>' + esc(j.rincian) + '</td></tr>';
      });
      wadah.innerHTML = hh + '</table></div>';
    });
  });
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
  if (!res.data.length) { el.innerHTML = '<h2>Tugas Saya</h2>' + kosongHtml('tugas', 'Belum ada tugas untuk kelas Anda', 'Tugas dari guru akan muncul di sini.'); return; }
  var h = '<h2>Tugas Saya</h2><div class="tabel-wrap"><table><tr><th>Judul</th><th>Tenggat</th><th>Lampiran</th><th>Status Saya</th><th></th></tr>';
  res.data.forEach(function (t) {
    h += '<tr><td>' + esc(t.judul) + (t.deskripsi ? '<br><span class="muted">' + esc(t.deskripsi) + '</span>' : '') + '</td>' +
      '<td>' + esc(labelRentang(t.tanggal_mulai, t.tenggat)) + '</td>' +
      '<td>' + (t.link_lampiran ? '<a href="' + esc(t.link_lampiran) + '" target="_blank" rel="noopener">' + esc(t.jenis_lampiran || 'tautan') + '</a>' : '—') + '</td>' +
      '<td id="status-' + esc(t.id_tugas) + '">…</td>' +
      '<td><button class="tombol kecil utama" data-kumpul="' + esc(t.id_tugas) + '">Kumpulkan</button>' +
      (t.jumlah_soal > 0 ? ' <button class="tombol kecil" data-kerjakan="' + esc(t.id_tugas) + '">Kerjakan</button>' : '') + '</td></tr>';
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
    if (p.jenis === 'otomatis') {
      var btnK = el.querySelector('[data-kerjakan="' + t.id_tugas + '"]');
      if (btnK) { btnK.textContent = 'Lihat hasil'; btnK.setAttribute('data-mode', 'hasil'); }
    }
  });

  el.querySelectorAll('[data-kumpul]').forEach(function (b) {
    b.addEventListener('click', function () { tampilFormKumpul(b.getAttribute('data-kumpul')); });
  });
  el.querySelectorAll('[data-kerjakan]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-mode') === 'hasil') tampilHasilKerjakan(b.getAttribute('data-kerjakan'));
      else tampilFormKerjakan(b.getAttribute('data-kerjakan'));
    });
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


/* ---------- Soal & Kunci (guru) + Kerjakan (siswa) ---------- */

/* Urai textarea kata kunci uraian: satu per baris "kata kunci = poin".
   Mengembalikan { ok, kataKunci: [{teks, bobot}], error? } */
function uraiKataKunci(teks) {
  var baris = String(teks || '').split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
  var hasil = [];
  for (var i = 0; i < baris.length; i++) {
    var m = baris[i].match(/^(.*)=\s*([0-9]+(?:[.,][0-9]+)?)\s*$/);
    if (!m) return { ok: false, error: 'Baris kata kunci ke-' + (i + 1) + ' harus berformat "kata kunci = poin", mis. "bridge = 10".' };
    var poin = Number(m[2].replace(',', '.'));
    if (!(poin > 0)) return { ok: false, error: 'Poin kata kunci "' + m[1].trim() + '" harus lebih dari 0.' };
    hasil.push({ teks: m[1].trim(), bobot: poin });
  }
  if (!hasil.length) return { ok: false, error: 'Isi minimal 1 kata kunci (format: kata kunci = poin).' };
  return { ok: true, kataKunci: hasil };
}

async function kelolaSoalGuru(idTugas, judulTugas) {
  var target = $('detail-tugas');
  target.innerHTML = '<p class="muat">Memuat soal…</p>';
  var res = await api('listKunci', guruPayload({ id_tugas: idTugas }));
  if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
  var soal = res.data;
  var h = '<h3>Soal &amp; Kunci — ' + esc(judulTugas || idTugas) + '</h3>' +
    '<p class="muted">Kunci jawaban untuk cek otomatis (bukan AI). Pilihan ganda dicocokkan persis ke kunci; uraian dinilai dari kata kunci yang ketemu. Nilai otomatis langsung final dan terhitung di Kompetensi — guru tetap bisa mengubahnya di Lihat pengumpulan.</p>';
  if (!soal.length) {
    h += kosongHtml('soal', 'Belum ada soal', 'Tambah soal di bawah. Tugas tanpa soal tetap dinilai manual seperti biasa.');
  } else {
    h += '<div class="tabel-wrap"><table><tr><th>No</th><th>Jenis</th><th>Pertanyaan</th><th>Kunci</th><th>Bobot</th><th></th></tr>';
    soal.forEach(function (s) {
      var kunciTxt;
      if (s.jenis === 'PG') {
        kunciTxt = 'Kunci: ' + esc(s.kunci) + '<br><span class="muted">' + s.pilihan.map(function (pil, i) { return 'ABCDE'.charAt(i) + '. ' + esc(pil); }).join('<br>') + '</span>';
      } else {
        kunciTxt = s.kata_kunci.map(function (kk) { return esc(kk.teks) + ' = ' + esc(kk.bobot); }).join('; ') +
          (s.kunci ? '<br><span class="muted">Model: ' + esc(s.kunci) + '</span>' : '');
      }
      h += '<tr><td>' + esc(s.no_soal) + '</td><td>' + esc(s.jenis) + '</td><td>' + esc(s.pertanyaan) + '</td><td>' + kunciTxt + '</td><td>' + esc(s.bobot) + '</td>' +
        '<td><button class="tombol kecil bahaya" data-hapus-soal="' + esc(s.id_kunci) + '">Hapus</button></td></tr>';
    });
    h += '</table></div>';
  }
  h += '<h3>Tambah Soal</h3>' +
    '<form id="form-tambah-soal">' +
    '<label>Jenis soal<select id="jenis-soal"><option value="PG">Pilihan ganda</option><option value="Uraian">Uraian</option></select></label>' +
    '<label>Pertanyaan<textarea id="tanya-soal" required minlength="2"></textarea></label>' +
    '<div id="bidang-pg">' +
    '<div class="form-inline"><label>Pilihan A<input id="pil-a" required></label>' +
    '<label>Pilihan B<input id="pil-b" required></label>' +
    '<label>Pilihan C<input id="pil-c" required></label>' +
    '<label>Pilihan D<input id="pil-d" required></label></div>' +
    '<div class="form-inline"><label>Kunci jawaban<select id="kunci-pg"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></label>' +
    '<label>Bobot<input id="bobot-pg" type="number" min="1" value="10"></label></div>' +
    '</div>' +
    '<div id="bidang-uraian" hidden>' +
    '<label>Jawaban model (opsional, untuk referensi guru)<textarea id="model-uraian"></textarea></label>' +
    '<label>Kata kunci (satu per baris, format: kata kunci = poin)<textarea id="katakunci-uraian" rows="4" placeholder="bridge = 10&#10;ether2 = 10"></textarea></label>' +
    '<p class="muted">Bobot soal uraian = jumlah poin kata kunci. Alternatif sinonim ditulis pakai |, mis. "bridge|jembatan = 10".</p>' +
    '</div>' +
    '<button type="submit" class="tombol utama" id="btn-simpan-soal">Tambah Soal</button></form>' +
    '<p id="error-soal" class="error" hidden></p>';
  target.innerHTML = h;
  target.querySelectorAll('[data-hapus-soal]').forEach(function (b) {
    b.addEventListener('click', async function () {
      if (!confirm('Hapus soal ini? Soal yang sudah dijawab siswa tidak bisa dihapus.')) return;
      var r = await api('hapusKunci', guruPayload({ id_kunci: b.getAttribute('data-hapus-soal') }));
      if (!r.ok) { toast(r.error); return; }
      toast('Soal dihapus.');
      kelolaSoalGuru(idTugas, judulTugas);
    });
  });
  $('jenis-soal').addEventListener('change', function () {
    var uraian = this.value === 'Uraian';
    $('bidang-pg').hidden = uraian;
    $('bidang-uraian').hidden = !uraian;
    ['pil-a', 'pil-b', 'pil-c', 'pil-d'].forEach(function (id) { $(id).required = !uraian; });
  });
  $('form-tambah-soal').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var btn = $('btn-simpan-soal');
    if (btn.disabled) return;
    tunjukError('error-soal', null);
    var jenis = $('jenis-soal').value;
    var dasar = { id_tugas: idTugas, jenis: jenis, pertanyaan: $('tanya-soal').value };
    var payload;
    if (jenis === 'PG') {
      payload = Object.assign(dasar, {
        pilihan: [$('pil-a').value, $('pil-b').value, $('pil-c').value, $('pil-d').value],
        kunci: $('kunci-pg').value, bobot: Number($('bobot-pg').value) || 10
      });
    } else {
      var urai = uraiKataKunci($('katakunci-uraian').value);
      if (!urai.ok) { tunjukError('error-soal', urai.error); return; }
      payload = Object.assign(dasar, { kunci: $('model-uraian').value, kata_kunci: urai.kataKunci });
    }
    btn.disabled = true;
    var r = await api('tambahKunci', guruPayload(payload));
    btn.disabled = false;
    if (!r.ok) { tunjukError('error-soal', r.error); return; }
    toast('Soal nomor ' + r.data.no_soal + ' ditambahkan.');
    kelolaSoalGuru(idTugas, judulTugas);
  });
}

async function tampilFormKerjakan(idTugas) {
  var target = $('form-kumpul');
  target.innerHTML = '<h3>Kerjakan Tugas</h3><p class="muat">Memuat soal…</p>';
  var res = await api('listKunci', siswaPayload({ id_tugas: idTugas }));
  if (!res.ok) { target.innerHTML = '<h3>Kerjakan Tugas</h3><p class="error">' + esc(res.error) + '</p>'; return; }
  var soal = res.data;
  if (!soal.length) {
    target.innerHTML = '<h3>Kerjakan Tugas</h3><p class="muted">Tugas ini belum punya soal untuk dikerjakan di aplikasi — kumpulkan lewat file/tautan.</p>';
    return;
  }
  var h = '<h3>Kerjakan Tugas</h3><form id="form-kerjakan-tugas">';
  soal.forEach(function (s) {
    h += '<div><p><strong>Soal ' + esc(s.no_soal) + '.</strong> ' + esc(s.pertanyaan) + ' <span class="muted">(' + esc(s.bobot) + ' poin)</span></p>';
    if (s.jenis === 'PG') {
      h += '<div class="opsi-pg">';
      s.pilihan.forEach(function (pil, i) {
        var huruf = 'ABCDE'.charAt(i);
        h += '<label><input type="radio" name="soal-' + esc(s.no_soal) + '" value="' + huruf + '"> ' + huruf + '. ' + esc(pil) + '</label>';
      });
      h += '</div>';
    } else {
      h += '<textarea name="soal-' + esc(s.no_soal) + '" rows="3" placeholder="Tulis jawabanmu dengan kata-katamu sendiri"></textarea>';
    }
    h += '</div>';
  });
  h += '<button type="submit" class="tombol utama" id="btn-kirim-jawaban">Kirim jawaban</button></form>' +
    '<p id="error-kerjakan" class="error" hidden></p>' +
    '<p class="muted">Satu kali percobaan — jawaban langsung dicek sistem (pilihan ganda cocok kunci, uraian cek kata kunci) dan nilainya langsung masuk. Periksa dulu sebelum dikirim.</p>' +
    '<div id="hasil-kerjakan"></div>';
  target.innerHTML = h;
  $('form-kerjakan-tugas').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var btn = $('btn-kirim-jawaban');
    if (btn.disabled) return;
    var jawaban = soal.map(function (s) {
      var val = '';
      if (s.jenis === 'PG') {
        var dipilih = ev.target.querySelector('input[name="soal-' + s.no_soal + '"]:checked');
        val = dipilih ? dipilih.value : '';
      } else {
        var ta = ev.target.querySelector('textarea[name="soal-' + s.no_soal + '"]');
        val = ta ? ta.value : '';
      }
      return { no_soal: s.no_soal, jawaban: val };
    });
    btn.disabled = true;
    tunjukError('error-kerjakan', null);
    var r = await api('jawabTugas', siswaPayload({ id_tugas: idTugas, jawaban: jawaban }));
    btn.disabled = false;
    if (!r.ok) { tunjukError('error-kerjakan', r.error); return; }
    var d = r.data;
    var hh = '<h3>Hasil — Nilai: ' + esc(d.nilai) + (d.huruf ? ' (' + esc(d.huruf) + ')' : '') + '</h3>' +
      (d.terlambat ? '<p class="muted">Terlambat — nilai tetap masuk.</p>' : '') +
      '<div class="tabel-wrap"><table><tr><th>Soal</th><th>Jawaban saya</th><th>Skor</th><th>Rincian</th></tr>';
    d.perSoal.forEach(function (ps) {
      var jw = '';
      jawaban.forEach(function (j) { if (j.no_soal === ps.no) jw = j.jawaban; });
      hh += '<tr><td>' + esc(ps.no) + '</td><td>' + esc(jw || '—') + '</td><td>' + esc(ps.didapat) + '/' + esc(ps.bobot) + '</td><td>' + esc(ps.rincian) + '</td></tr>';
    });
    $('hasil-kerjakan').innerHTML = hh + '</table></div><p class="muted">Nilai sudah masuk dan terhitung di Kompetensi. Guru bisa mengubahnya bila perlu.</p>';
    $('form-kerjakan-tugas').hidden = true;
  });
  target.scrollIntoView();
}

async function tampilHasilKerjakan(idTugas) {
  var target = $('form-kumpul');
  target.innerHTML = '<h3>Hasil Kerjakan</h3><p class="muat">Memuat…</p>';
  var res = await api('listJawaban', siswaPayload({ id_tugas: idTugas }));
  if (!res.ok) { target.innerHTML = '<h3>Hasil Kerjakan</h3><p class="error">' + esc(res.error) + '</p>'; return; }
  if (!res.data.length) {
    target.innerHTML = '<h3>Hasil Kerjakan</h3><p class="muted">Belum ada jawaban tersimpan.</p>';
    return;
  }
  var d = await api('detailTugas', siswaPayload({ id_tugas: idTugas }));
  var nilai = d.ok && d.data.pengumpulan.length ? d.data.pengumpulan[0].nilai : null;
  var h = '<h3>Hasil Kerjakan' + (nilai !== null ? ' — Nilai: ' + esc(labelNilai(nilai)) : '') + '</h3>' +
    '<div class="tabel-wrap"><table><tr><th>Soal</th><th>Jawaban saya</th><th>Skor</th><th>Rincian</th></tr>';
  res.data.forEach(function (j) {
    h += '<tr><td>' + esc(j.no_soal) + '</td><td>' + esc(j.jawaban || '—') + '</td><td>' + esc(j.skor) + '/' + esc(j.bobot) + '</td><td>' + esc(j.rincian) + '</td></tr>';
  });
  target.innerHTML = h + '</table></div>';
  target.scrollIntoView();
}
