/* ---------- Kelas & Siswa (guru) ---------- */

var _kelasCache = [];

function opsiKelas(list, pilihSemua) {
  var html = pilihSemua ? '<option value="">Semua kelas</option>' : '<option value="">— Pilih kelas —</option>';
  list.forEach(function (k) {
    html += '<option value="' + esc(k.nama_kelas) + '">' + esc(k.nama_kelas) + '</option>';
  });
  return html;
}

/* Ambil ID spreadsheet dari link lengkap (/d/<id>/) atau ID mentah. */
function ambilIdSpreadsheetForm(teks) {
  teks = String(teks || '').trim();
  var m = teks.match(/\/d\/([A-Za-z0-9-_]+)/);
  return m ? m[1] : teks;
}

/* Tebak kolom Form dari judulnya — dipakai mengisi awal dropdown pemetaan
   (guru tetap bisa mengubahnya sebelum impor). */
function tebakKolomForm(header, kunci) {
  var h = header.map(function (x) { return String(x || '').trim().toLowerCase(); });
  for (var i = 0; i < h.length; i++) {
    for (var k = 0; k < kunci.length; k++) {
      if (h[i].indexOf(kunci[k]) !== -1) return i;
    }
  }
  return -1;
}

HAL.guru.kelas = async function () {
  var el = $('hal-guru-kelas');
  el.innerHTML = '<h2>Kelas &amp; Siswa</h2><p class="muat">Memuat…</p>';
  var resKelas = await api('listKelas', guruPayload());
  if (!resKelas.ok) { el.innerHTML = '<h2>Kelas &amp; Siswa</h2><p class="error">' + esc(resKelas.error) + '</p>'; return; }
  _kelasCache = resKelas.data;
  var resSiswa = await api('listSiswa', guruPayload());
  var siswa = resSiswa.ok ? resSiswa.data : [];

  var html = '<h2>Kelas &amp; Siswa</h2>';

  html += '<h3>Tambah Kelas</h3>' +
    '<form id="form-tambah-kelas" class="form-inline">' +
    '<label>Nama kelas<input name="nama_kelas" required minlength="2" maxlength="100" placeholder="XI TKJ A"></label>' +
    '<label>Mata pelajaran<input name="mata_pelajaran" required minlength="2" maxlength="100" placeholder="TJKT"></label>' +
    '<label>Tahun ajaran<input name="tahun_ajaran" required pattern="\\d{4}/\\d{4}" placeholder="2025/2026"></label>' +
    '<button type="submit" class="tombol utama">Tambah Kelas</button>' +
    '</form><p id="error-kelas" class="error" hidden></p>';

  html += '<h3>Daftar Kelas (' + _kelasCache.length + ')</h3><div class="tabel-wrap"><table>' +
    '<tr><th>Nama Kelas</th><th>Mata Pelajaran</th><th>Tahun Ajaran</th><th>Guru</th><th>Dibuat</th><th></th></tr>';
  _kelasCache.forEach(function (k) {
    html += '<tr><td>' + esc(k.nama_kelas) + '</td><td>' + esc(k.mata_pelajaran) + '</td><td>' + esc(k.tahun_ajaran) + '</td><td>' + esc(k.guru) + '</td><td>' + esc(k.dibuat_pada) + '</td>' +
      '<td><button class="tombol kecil bahaya" data-hapus-kelas="' + esc(k.id_kelas) + '" data-nama="' + esc(k.nama_kelas) + '">Hapus</button></td></tr>';
  });
  html += '</table></div>';

  html += '<h3>Siswa</h3>' +
    '<div class="form-inline"><label>Filter kelas<select id="filter-siswa-kelas">' + opsiKelas(_kelasCache, true) + '</select></label>' +
    '<button class="tombol kecil" id="btn-muat-siswa">Muat</button></div>' +
    '<div id="daftar-siswa"></div>' +
    '<h3>Tambah Siswa</h3>' +
    '<form id="form-tambah-siswa" class="form-inline">' +
    '<label>Nama<input name="nama" required minlength="2" maxlength="100"></label>' +
    '<label>Kelas<select name="kelas" required>' + opsiKelas(_kelasCache, false) + '</select></label>' +
    '<label>Email (opsional)<input name="email" type="email"></label>' +
    '<label>Jenis kelamin<select name="jenis_kelamin"><option value="">—</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>' +
    '<label><input name="pintar" type="checkbox"> Siswa pintar</label>' +
    '<button type="submit" class="tombol utama">Tambah Siswa</button>' +
    '</form><p id="error-siswa-tambah" class="error" hidden></p>' +
    '<div id="panel-edit-siswa" hidden><h3>Edit Siswa</h3>' +
    '<form id="form-edit-siswa" class="form-inline">' +
    '<input type="hidden" name="id_siswa">' +
    '<label>Nama<input name="nama" required minlength="2" maxlength="100"></label>' +
    '<label>Kelas<select name="kelas" required>' + opsiKelas(_kelasCache, false) + '</select></label>' +
    '<label>Email (opsional)<input name="email" type="email"></label>' +
    '<label>Jenis kelamin<select name="jenis_kelamin"><option value="">—</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>' +
    '<label><input name="pintar" type="checkbox"> Siswa pintar</label>' +
    '<label>Status<select name="status_aktif"><option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option></select></label>' +
    '<button type="submit" class="tombol utama">Simpan Perubahan</button> ' +
    '<button type="button" class="tombol" id="btn-batal-edit">Batal</button>' +
    '</form><p id="error-siswa-edit" class="error" hidden></p></div>' +
    '<h3>Impor Siswa (CSV)</h3>' +
    '<p class="muted">File CSV dengan kolom Nama, Kelas, Email (opsional), Pintar (opsional: Ya/Tidak), Jenis_Kelamin (opsional: L/P). Baris meragukan masuk daftar Verifikasi, bukan ke data siswa. File .xlsx dikonversi ke CSV dulu (mis. lewat spreadsheet).</p>' +
    '<input type="file" id="file-impor-siswa" accept=".csv,text/csv">' +
    '<button class="tombol" id="btn-impor-siswa">Impor</button>' +
    '<div id="hasil-impor"></div>' +
    '<h3>Impor dari Google Form</h3>' +
    '<p class="muted">Siswa mengisi Google Form (Nama, Kelas, Jenis Kelamin, …), jawabannya otomatis masuk ke spreadsheet. Tempel link spreadsheet hasil Form di bawah, pilih kolomnya, lalu impor — sama seperti impor CSV: duplikat dilewati, yang meragukan masuk Verifikasi.</p>' +
    '<div class="form-inline"><label>Link / ID spreadsheet hasil Form<input id="input-form-sheet" placeholder="https://docs.google.com/spreadsheets/d/…"></label>' +
    '<button type="button" class="tombol" id="btn-baca-form">Baca kolom</button></div>' +
    '<div id="panel-peta-form" hidden>' +
    '<div class="form-inline"><label>Tab spreadsheet<select id="pilih-sheet-form"></select></label></div>' +
    '<div class="form-inline"><label>Nama *<select id="peta-nama"></select></label>' +
    '<label>Kelas *<select id="peta-kelas"></select></label>' +
    '<label>Email<select id="peta-email"></select></label>' +
    '<label>Pintar<select id="peta-pintar"></select></label>' +
    '<label>Jenis kelamin<select id="peta-jk"></select></label></div>' +
    '<p class="muted">Kolom bertanda * wajib dipilih. Kolom Timestamp jawaban Form tidak perlu dipetakan — diabaikan.</p>' +
    '<button type="button" class="tombol utama" id="btn-impor-form">Impor dari Form</button></div>' +
    '<div id="hasil-impor-form"></div>' +
    '<h3>Hapus Massal (Lulus)</h3>' +
    '<p class="muted">Untuk kelas yang sudah lulus: hapus SEKALIGUS semua siswa di kelas itu. Hanya data siswa di tab Siswa yang dihapus — riwayat kehadiran, kompetensi, dan pengumpulan tetap tersimpan. <strong>Tidak bisa dibatalkan.</strong></p>' +
    '<div class="form-inline"><label>Kelas<select id="hapus-massal-kelas">' + opsiKelas(_kelasCache, false) + '</select></label>' +
    '<button class="tombol bahaya" id="btn-hapus-massal">Hapus Semua Siswa Kelas Ini</button></div>' +
    '<p id="info-hapus-massal" class="muted"></p>';

  el.innerHTML = html;

  $('form-tambah-kelas').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var fd = new FormData(ev.target);
    var res = await api('tambahKelas', guruPayload({
      nama_kelas: fd.get('nama_kelas'), mata_pelajaran: fd.get('mata_pelajaran'), tahun_ajaran: fd.get('tahun_ajaran')
    }));
    if (!res.ok) { tunjukError('error-kelas', res.error); return; }
    toast('Kelas ditambahkan.');
    HAL.guru.kelas();
  });

  el.querySelectorAll('[data-hapus-kelas]').forEach(function (b) {
    b.addEventListener('click', async function () {
      if (!confirm('Hapus kelas "' + b.getAttribute('data-nama') + '"? Kelas yang masih berisi siswa tidak bisa dihapus.')) return;
      var res = await api('hapusKelas', guruPayload({ id_kelas: b.getAttribute('data-hapus-kelas') }));
      if (!res.ok) { toast(res.error); return; }
      toast('Kelas dihapus.');
      HAL.guru.kelas();
    });
  });

  var muatSiswa = async function (kelasFilter) {
    var target = $('daftar-siswa');
    target.innerHTML = '<p class="muat">Memuat siswa…</p>';
    var res = await api('listSiswa', guruPayload(kelasFilter ? { kelas: kelasFilter } : {}));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var daftar = res.data;
    var t = '<div class="tabel-wrap"><table><tr><th>Nama</th><th>Kelas</th><th>Email</th><th>Status</th><th>Jenis Kelamin</th><th>Pintar</th><th>PIN</th><th></th></tr>';
    daftar.forEach(function (s) {
      t += '<tr><td>' + esc(s.nama) + '</td><td>' + esc(s.kelas) + '</td><td>' + esc(s.email) + '</td><td>' + esc(s.status_aktif) + '</td>' +
        '<td>' + esc(labelJK(s.jenis_kelamin)) + '</td><td>' + badgePintar(s.pintar) + '</td>' +
        '<td><button class="tombol kecil" data-buat-pin="' + esc(s.id_siswa) + '" data-nama="' + esc(s.nama) + '">Buat PIN</button> <span id="pin-' + esc(s.id_siswa) + '"></span></td>' +
        '<td><button class="tombol kecil" data-edit-siswa="' + esc(s.id_siswa) + '">Edit</button> ' +
        '<button class="tombol kecil bahaya" data-hapus-siswa="' + esc(s.id_siswa) + '" data-nama="' + esc(s.nama) + '">Hapus</button></td></tr>';
    });
    t += '</table></div><p class="muted">Total: ' + daftar.length + ' siswa. PIN hanya tampil sekali — sampaikan ke siswa, lalu simpan di tempat aman.</p>';
    target.innerHTML = t;
    target.querySelectorAll('[data-buat-pin]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res2 = await api('buatTokenSiswa', guruPayload({ idSiswa: b.getAttribute('data-buat-pin') }));
        if (!res2.ok) { toast(res2.error); return; }
        var span = $('pin-' + b.getAttribute('data-buat-pin'));
        if (span) span.innerHTML = '<strong>PIN: ' + esc(res2.data.pin) + '</strong>';
      });
    });
    target.querySelectorAll('[data-hapus-siswa]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Hapus siswa "' + b.getAttribute('data-nama') + '"?')) return;
        var res3 = await api('hapusSiswa', guruPayload({ id_siswa: b.getAttribute('data-hapus-siswa') }));
        if (!res3.ok) { toast(res3.error); return; }
        toast('Siswa dihapus.');
        muatSiswa($('filter-siswa-kelas').value);
      });
    });
    target.querySelectorAll('[data-edit-siswa]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-edit-siswa');
        var s = null;
        for (var i = 0; i < daftar.length; i++) {
          if (daftar[i].id_siswa === id) { s = daftar[i]; break; }
        }
        if (!s) return;
        var f = $('form-edit-siswa');
        f.id_siswa.value = s.id_siswa;
        f.nama.value = s.nama;
        f.kelas.value = s.kelas;
        f.email.value = s.email || '';
        f.jenis_kelamin.value = s.jenis_kelamin || '';
        f.pintar.checked = !!s.pintar;
        f.status_aktif.value = s.status_aktif || 'Aktif';
        $('panel-edit-siswa').hidden = false;
        $('panel-edit-siswa').scrollIntoView();
      });
    });
  };

  $('btn-muat-siswa').addEventListener('click', function () { muatSiswa($('filter-siswa-kelas').value); });
  $('filter-siswa-kelas').addEventListener('change', function () { muatSiswa(this.value); });

  $('form-tambah-siswa').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var fd = new FormData(ev.target);
    var res = await api('tambahSiswa', guruPayload({
      nama: fd.get('nama'), kelas: fd.get('kelas'), email: fd.get('email'),
      jenis_kelamin: fd.get('jenis_kelamin') || '', pintar: fd.get('pintar') === 'on'
    }));
    if (!res.ok) { tunjukError('error-siswa-tambah', res.error); return; }
    toast('Siswa ditambahkan.');
    HAL.guru.kelas();
  });

  $('form-edit-siswa').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-siswa-edit', null);
    var fd = new FormData(ev.target);
    var res = await api('editSiswa', guruPayload({
      id_siswa: fd.get('id_siswa'), nama: fd.get('nama'), kelas: fd.get('kelas'),
      email: fd.get('email'), status_aktif: fd.get('status_aktif'),
      jenis_kelamin: fd.get('jenis_kelamin') || '', pintar: fd.get('pintar') === 'on'
    }));
    if (!res.ok) { tunjukError('error-siswa-edit', res.error); return; }
    toast('Data siswa diperbarui.');
    HAL.guru.kelas();
  });

  $('btn-batal-edit').addEventListener('click', function () {
    $('panel-edit-siswa').hidden = true;
  });

  $('btn-impor-siswa').addEventListener('click', async function () {
    var file = $('file-impor-siswa').files[0];
    if (!file) { toast('Pilih file CSV dulu.'); return; }
    var teks = await file.text();
    var rows = parseCsvJs(teks);
    if (rows.length < 2) { toast('File kosong atau tanpa baris data.'); return; }
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var iNama = header.indexOf('nama');
    var iKelas = header.indexOf('kelas');
    var iEmail = header.indexOf('email');
    var iPintar = header.indexOf('pintar');
    var iJk = header.indexOf('jenis_kelamin');
    if (iJk === -1) iJk = header.indexOf('jenis kelamin');
    if (iJk === -1) iJk = header.indexOf('jk');
    if (iNama === -1 || iKelas === -1) { toast('Header harus punya kolom Nama dan Kelas.'); return; }
    var data = rows.slice(1).map(function (r) {
      var pintarRaw = iPintar === -1 ? '' : (r[iPintar] || '').trim().toLowerCase();
      return {
        nama: (r[iNama] || '').trim(), kelas: (r[iKelas] || '').trim(),
        email: iEmail === -1 ? '' : (r[iEmail] || '').trim(),
        pintar: pintarRaw === 'ya' || pintarRaw === '1' || pintarRaw === 'true',
        jenis_kelamin: iJk === -1 ? '' : (r[iJk] || '').trim()
      };
    }).filter(function (r) { return r.nama || r.kelas; });
    var hasil = { diimpor: 0, dilewatiDuplikat: 0, masukVerifikasi: [], diimporNama: [] };
    var target = $('hasil-impor');
    target.innerHTML = '<p class="muat">Mengimpor ' + data.length + ' baris…</p>';
    for (var c = 0; c < data.length; c += 20) {
      var res = await api('importSiswa', guruPayload({ rows: data.slice(c, c + 20) }));
      if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
      hasil.diimpor += res.data.diimpor;
      hasil.dilewatiDuplikat += res.data.dilewatiDuplikat;
      hasil.masukVerifikasi = hasil.masukVerifikasi.concat(res.data.masukVerifikasi);
      hasil.diimporNama = hasil.diimporNama.concat(res.data.diimporNama);
    }
    var h = '<p class="sukses-teks">Impor selesai: ' + hasil.diimpor + ' diimpor, ' + hasil.dilewatiDuplikat + ' duplikat dilewati, ' + hasil.masukVerifikasi.length + ' masuk verifikasi.</p>';
    if (hasil.masukVerifikasi.length) {
      h += '<div class="tabel-wrap"><table><tr><th>Baris</th><th>Nama</th><th>Kelas</th><th>Alasan</th></tr>';
      hasil.masukVerifikasi.forEach(function (v) {
        h += '<tr><td>' + esc(v.baris) + '</td><td>' + esc(v.nama) + '</td><td>' + esc(v.kelas) + '</td><td>' + esc(v.alasan) + '</td></tr>';
      });
      h += '</table></div>';
    }
    target.innerHTML = h;
    muatSiswa($('filter-siswa-kelas').value);
  });

  /* ---------- Impor dari Google Form ---------- */

  var isiOpsiKolom = function (sel, header, kosongLabel) {
    var html = '<option value="">' + esc(kosongLabel) + '</option>';
    header.forEach(function (h, i) {
      html += '<option value="' + i + '">' + esc(h || ('Kolom ' + (i + 1))) + '</option>';
    });
    sel.innerHTML = html;
  };

  var terapkanTebakanKolom = function (header) {
    var pasang = function (id, kunci) {
      var t = tebakKolomForm(header, kunci);
      $(id).value = t === -1 ? '' : String(t);
    };
    pasang('peta-nama', ['nama']);
    pasang('peta-kelas', ['kelas']);
    pasang('peta-email', ['email']);
    pasang('peta-pintar', ['pintar']);
    pasang('peta-jk', ['jenis kelamin', 'jenis_kelamin', 'kelamin']);
  };

  var bacaForm = async function (sheet) {
    var id = ambilIdSpreadsheetForm($('input-form-sheet').value);
    if (!id) { toast('Tempel dulu link atau ID spreadsheet hasil Form.'); return; }
    var btn = $('btn-baca-form');
    if (btn.disabled) return;
    btn.disabled = true;
    var res = await api('bacaHeaderForm', guruPayload({ spreadsheetId: id, sheet: sheet || '' }));
    btn.disabled = false;
    if (!res.ok) { toast(res.error); return; }
    var d = res.data;
    $('input-form-sheet').dataset.spreadsheetId = d.spreadsheetId;
    $('panel-peta-form').hidden = false;
    $('pilih-sheet-form').innerHTML = d.sheets.map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === d.sheet ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
    isiOpsiKolom($('peta-nama'), d.header, '— pilih kolom Nama —');
    isiOpsiKolom($('peta-kelas'), d.header, '— pilih kolom Kelas —');
    isiOpsiKolom($('peta-email'), d.header, '— tidak dipakai —');
    isiOpsiKolom($('peta-pintar'), d.header, '— tidak dipakai —');
    isiOpsiKolom($('peta-jk'), d.header, '— tidak dipakai —');
    terapkanTebakanKolom(d.header);
    toast('Ditemukan ' + d.jumlahBaris + ' jawaban di tab "' + d.sheet + '".');
  };

  $('btn-baca-form').addEventListener('click', function () { bacaForm(''); });
  $('pilih-sheet-form').addEventListener('change', function () { bacaForm($('pilih-sheet-form').value); });

  $('btn-impor-form').addEventListener('click', async function () {
    var btn = $('btn-impor-form');
    if (btn.disabled) return;
    var id = $('input-form-sheet').dataset.spreadsheetId || ambilIdSpreadsheetForm($('input-form-sheet').value);
    var ambilIdx = function (idSel) {
      var v = $(idSel).value;
      return v === '' ? null : Number(v);
    };
    var pemetaan = {
      nama: ambilIdx('peta-nama'), kelas: ambilIdx('peta-kelas'),
      email: ambilIdx('peta-email'), pintar: ambilIdx('peta-pintar'),
      jenis_kelamin: ambilIdx('peta-jk')
    };
    if (pemetaan.nama === null || pemetaan.kelas === null) { toast('Pilih dulu kolom Nama dan kolom Kelas.'); return; }
    btn.disabled = true;
    var target = $('hasil-impor-form');
    target.innerHTML = '<p class="muat">Mengimpor jawaban Form…</p>';
    var res = await api('importDariForm', guruPayload({ spreadsheetId: id, sheet: $('pilih-sheet-form').value, pemetaan: pemetaan }));
    btn.disabled = false;
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var hasil = res.data;
    var h = '<p class="sukses-teks">Impor selesai: ' + hasil.diimpor + ' diimpor, ' + hasil.dilewatiDuplikat + ' duplikat dilewati, ' + hasil.masukVerifikasi.length + ' masuk verifikasi.</p>';
    if (hasil.masukVerifikasi.length) {
      h += '<div class="tabel-wrap"><table><tr><th>Baris</th><th>Nama</th><th>Kelas</th><th>Alasan</th></tr>';
      hasil.masukVerifikasi.forEach(function (v) {
        h += '<tr><td>' + esc(v.baris) + '</td><td>' + esc(v.nama) + '</td><td>' + esc(v.kelas) + '</td><td>' + esc(v.alasan) + '</td></tr>';
      });
      h += '</table></div>';
    }
    target.innerHTML = h;
    muatSiswa($('filter-siswa-kelas').value);
  });

  var muatInfoHapusMassal = async function () {
    var kelas = $('hapus-massal-kelas').value;
    var target = $('info-hapus-massal');
    if (!kelas) { target.textContent = ''; return; }
    target.textContent = 'Menghitung…';
    var res = await api('listSiswa', guruPayload({ kelas: kelas }));
    if (!res.ok) { target.textContent = ''; return; }
    target.textContent = 'Kelas ' + kelas + ': ' + res.data.length + ' siswa akan dihapus.';
    target.dataset.jumlah = String(res.data.length);
  };
  $('hapus-massal-kelas').addEventListener('change', muatInfoHapusMassal);

  $('btn-hapus-massal').addEventListener('click', async function () {
    var kelas = $('hapus-massal-kelas').value;
    if (!kelas) { toast('Pilih kelas dulu.'); return; }
    var jumlah = $('info-hapus-massal').dataset.jumlah;
    if (jumlah === undefined) { await muatInfoHapusMassal(); jumlah = $('info-hapus-massal').dataset.jumlah; }
    if (!jumlah || Number(jumlah) === 0) { toast('Tidak ada siswa di kelas "' + kelas + '".'); return; }
    if (!confirm('Hapus ' + jumlah + ' siswa kelas "' + kelas + '" SEKALIGUS?\n\nHanya data siswa kelas ini yang dihapus. Riwayat kehadiran, kompetensi, dan pengumpulan tetap tersimpan. Tindakan ini TIDAK BISA DIBATALKAN.')) return;
    var res = await api('hapusSiswaMassal', guruPayload({ kelas: kelas }));
    if (!res.ok) { toast(res.error); return; }
    toast(res.data.dihapus + ' siswa kelas "' + res.data.kelas + '" dihapus.');
    HAL.guru.kelas();
  });

  muatSiswa('');
};

/** Parser CSV sederhana (koma + kutip ganda) untuk impor di browser. */
function parseCsvJs(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r') { /* abaikan */ }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (c) { return c.trim() !== ''; }); });
}

