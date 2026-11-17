/* Classroom Hub — frontend statis (GitHub Pages) + backend Google Apps Script.
 * Pola absensi-pkl: semua aksi lewat JSONP GET; upload file lewat POST no-cors
 * dua fase (upload dulu, lalu verifikasi dengan aksi baca).
 * TIDAK ADA secret di file ini — kode guru & PIN dicek di server.
 */

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbykozMZCJOHdNG7WwgzdpI3Ix8SqWIpLUt2SPyrEKLO9WEa-LDbagX7XD_pr29x5uZj/exec';

var $ = function (id) { return document.getElementById(id); };

/* ---------- Util ---------- */

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(pesan) {
  var t = $('toast');
  t.textContent = pesan;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.hidden = true; }, 3500);
}

function tunjukError(id, pesan) {
  var el = $(id);
  if (!pesan) { el.hidden = true; el.textContent = ''; return; }
  el.textContent = pesan;
  el.hidden = false;
}

function bulanBerjalan() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function hariIni() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- JSONP (pola absensi-pkl) ---------- */

var _cbSeq = 0;

/** Panggil aksi backend. Resolve {ok, data} / {ok:false, error}. Timeout 40 dtk. */
function api(action, payload) {
  return new Promise(function (resolve) {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('GANTI_') === 0) {
      resolve({ ok: false, error: 'APPS_SCRIPT_URL belum diisi di app.js.' });
      return;
    }
    var cb = 'hubCb' + (++_cbSeq) + '_' + Date.now();
    var timer = setTimeout(function () {
      cleanup();
      resolve({ ok: false, error: 'Server tidak merespons (timeout 40 detik). Coba lagi.' });
    }, 40000);
    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      var s = document.getElementById('jsonp-' + cb);
      if (s) s.remove();
    }
    window[cb] = function (res) {
      cleanup();
      resolve(res);
    };
    var url = APPS_SCRIPT_URL +
      '?payload=' + encodeURIComponent(JSON.stringify(Object.assign({}, payload || {}, { action: action }))) +
      '&callback=' + cb;
    var script = document.createElement('script');
    script.id = 'jsonp-' + cb;
    script.src = url;
    script.onerror = function () {
      cleanup();
      resolve({ ok: false, error: 'Gagal terhubung ke server. Cek koneksi internet lalu coba lagi.' });
    };
    document.body.appendChild(script);
  });
}

/** Upload file: POST no-cors fire-and-forget (tidak bisa membaca balasan). */
function apiUpload(action, payload) {
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({}, payload, { action: action }))
  }).then(function () { return { ok: true }; })
    .catch(function () { return { ok: false, error: 'Gagal mengunggah file.' }; });
}

/** Baca file jadi base64 (tanpa prefix data:). */
function fileKeBase64(file) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () {
      var s = String(r.result);
      resolve(s.indexOf(',') !== -1 ? s.split(',')[1] : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Unduh teks sebagai file (untuk CSV). */
function unduhTeks(namaFile, teks, mime) {
  var blob = new Blob([teks], { type: mime || 'text/plain;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Unduh base64 sebagai file (untuk XLSX/PDF). */
function unduhBase64(namaFile, base64, mime) {
  var bin = atob(base64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var blob = new Blob([bytes], { type: mime });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- Sesi (sessionStorage — hilang saat tab ditutup) ---------- */

var Sesi = {
  get guruToken() { return sessionStorage.getItem('hubGuruToken'); },
  set guruToken(v) { if (v) sessionStorage.setItem('hubGuruToken', v); else sessionStorage.removeItem('hubGuruToken'); },
  get siswa() {
    try { return JSON.parse(sessionStorage.getItem('hubSiswa') || 'null'); } catch (e) { return null; }
  },
  set siswa(v) {
    if (v) sessionStorage.setItem('hubSiswa', JSON.stringify(v));
    else sessionStorage.removeItem('hubSiswa');
  },
  get aksesTerbuka() { return sessionStorage.getItem('hubAksesTerbuka') === '1'; },
  set aksesTerbuka(v) { if (v) sessionStorage.setItem('hubAksesTerbuka', '1'); else sessionStorage.removeItem('hubAksesTerbuka'); }
};

function guruPayload(tambahan) {
  return Object.assign({ token: Sesi.guruToken }, tambahan || {});
}
function siswaPayload(tambahan) {
  var s = Sesi.siswa || {};
  return Object.assign({ idSiswa: s.id_siswa, pin: s.pin }, tambahan || {});
}

/* ---------- Navigasi layar ---------- */

var LAYAR = ['layar-kode', 'layar-peran', 'layar-guru', 'layar-siswa', 'layar-guru-app', 'layar-siswa-app'];

function tunjukLayar(id) {
  LAYAR.forEach(function (l) { $(l).hidden = (l !== id); });
  window.scrollTo(0, 0);
}

function tunjukHal(peran, nama) {
  var prefix = peran === 'guru' ? 'hal-guru-' : 'hal-siswa-';
  document.querySelectorAll('#layar-' + peran + '-app .hal').forEach(function (el) {
    el.hidden = (el.id !== prefix + nama);
  });
  document.querySelectorAll('#nav-' + peran + ' button[data-hal]').forEach(function (b) {
    b.classList.toggle('aktif', b.getAttribute('data-hal') === nama);
  });
  var pemuat = HAL[peran] && HAL[peran][nama];
  if (pemuat) pemuat();
}

/* ---------- Auth ---------- */

async function initAuth() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('GANTI_') === 0) {
    $('peringatan-url').hidden = false;
  }

  $('form-kode').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-kode', null);
    var kode = $('input-kode').value.trim();
    var res = await api('cekKodeAkses', { kode: kode });
    if (!res.ok) { tunjukError('error-kode', res.error); return; }
    if (!res.data.terbuka) { tunjukError('error-kode', 'Kode akses salah.'); return; }
    Sesi.aksesTerbuka = true;
    tunjukLayar('layar-peran');
  });

  $('btn-peran-guru').addEventListener('click', function () { tunjukLayar('layar-guru'); });
  $('btn-peran-siswa').addEventListener('click', function () {
    muatKelasSiswa();
    tunjukLayar('layar-siswa');
  });
  $('btn-keluar-peran').addEventListener('click', function () {
    Sesi.aksesTerbuka = false;
    tunjukLayar('layar-kode');
  });
  $('btn-kembali-guru').addEventListener('click', function () { tunjukLayar('layar-peran'); });
  $('btn-kembali-siswa').addEventListener('click', function () { tunjukLayar('layar-peran'); });

  $('form-guru').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-guru', null);
    var res = await api('guruLogin', { kode: $('input-kode-guru').value.trim() });
    if (!res.ok) { tunjukError('error-guru', res.error); return; }
    Sesi.guruToken = res.data.token;
    masukGuru();
  });

  $('pilih-kelas-siswa').addEventListener('change', function () {
    muatNamaSiswa(this.value);
  });

  $('form-siswa').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-siswa', null);
    var kelas = $('pilih-kelas-siswa').value;
    var nama = $('pilih-nama-siswa').value;
    var pin = $('input-pin-siswa').value.trim();
    var res = await api('loginSiswa', { kelas: kelas, nama: nama, pin: pin });
    if (!res.ok) { tunjukError('error-siswa', res.error); return; }
    Sesi.siswa = { id_siswa: res.data.id_siswa, nama: res.data.nama, kelas: res.data.kelas, pin: pin };
    masukSiswa();
  });

  $('btn-keluar-guru').addEventListener('click', function () {
    Sesi.guruToken = null;
    tunjukLayar('layar-peran');
  });
  $('btn-keluar-siswa').addEventListener('click', function () {
    Sesi.siswa = null;
    tunjukLayar('layar-peran');
  });

  document.querySelectorAll('#nav-guru button[data-hal]').forEach(function (b) {
    b.addEventListener('click', function () { tunjukHal('guru', b.getAttribute('data-hal')); });
  });
  document.querySelectorAll('#nav-siswa button[data-hal]').forEach(function (b) {
    b.addEventListener('click', function () { tunjukHal('siswa', b.getAttribute('data-hal')); });
  });

  // Pulihkan sesi (dalam satu sesi browser).
  if (Sesi.guruToken) { masukGuru(); return; }
  if (Sesi.siswa) { masukSiswa(); return; }
  if (Sesi.aksesTerbuka) { tunjukLayar('layar-peran'); return; }
  // Kalau pintu depan belum diaktifkan guru (KODE_AKSES kosong),
  // lewati layar kode langsung ke pilih peran.
  var cek = await api('cekKodeAkses', { kode: '' });
  if (cek.ok && cek.data.terbuka && cek.data.perluKode === false) {
    Sesi.aksesTerbuka = true;
    tunjukLayar('layar-peran');
    return;
  }
  tunjukLayar('layar-kode');
}

function masukGuru() {
  tunjukLayar('layar-guru-app');
  tunjukHal('guru', 'dashboard');
}

function masukSiswa() {
  tunjukLayar('layar-siswa-app');
  tunjukHal('siswa', 'dashboard');
}

async function muatKelasSiswa() {
  var pilih = $('pilih-kelas-siswa');
  pilih.innerHTML = '<option value="">— Pilih kelas —</option>';
  var res = await api('getKelasList', {});
  if (!res.ok) { tunjukError('error-siswa', res.error); return; }
  res.data.forEach(function (k) {
    var o = document.createElement('option');
    o.value = k.nama_kelas;
    o.textContent = k.nama_kelas;
    pilih.appendChild(o);
  });
}

async function muatNamaSiswa(kelas) {
  var pilih = $('pilih-nama-siswa');
  pilih.innerHTML = '<option value="">— Pilih nama —</option>';
  pilih.disabled = true;
  if (!kelas) return;
  var res = await api('getSiswaByKelas', { kelas: kelas });
  if (!res.ok) { tunjukError('error-siswa', res.error); return; }
  res.data.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.nama;
    o.textContent = s.nama;
    pilih.appendChild(o);
  });
  pilih.disabled = false;
}

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

/* ---------- Boot ---------- */

document.addEventListener('DOMContentLoaded', initAuth);

/* ---------- Kelas & Siswa (guru) ---------- */

var _kelasCache = [];

function opsiKelas(list, pilihSemua) {
  var html = pilihSemua ? '<option value="">Semua kelas</option>' : '<option value="">— Pilih kelas —</option>';
  list.forEach(function (k) {
    html += '<option value="' + esc(k.nama_kelas) + '">' + esc(k.nama_kelas) + '</option>';
  });
  return html;
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

/* ---------- Materi ---------- */

function tabelMateri(list, bisaArsip) {
  if (!list.length) return '<p class="muted">Belum ada materi.</p>';
  var h = '<div class="tabel-wrap"><table><tr><th>Judul</th><th>Kelas</th><th>Topik</th><th>Jenis</th><th>Tautan</th><th>Dibuat</th>';
  if (bisaArsip) h += '<th></th>';
  h += '</tr>';
  list.forEach(function (m) {
    h += '<tr><td>' + esc(m.judul) + (m.deskripsi ? '<br><span class="muted">' + esc(m.deskripsi) + '</span>' : '') + '</td>' +
      '<td>' + esc(m.kelas) + '</td><td>' + esc(m.topik) + '</td><td>' + esc(m.jenis) + '</td>' +
      '<td><a href="' + esc(m.link_drive) + '" target="_blank" rel="noopener">Buka</a></td>' +
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
    '<div id="daftar-materi"><p class="muat">Memuat…</p></div>';

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
      var base64 = await fileKeBase64(file);
      var up = await apiUpload('uploadMateri', guruPayload(Object.assign(dasar, {
        namaFile: file.name, mimeType: file.type, size: file.size, base64: base64
      })));
      if (!up.ok) { tunjukError('error-materi', up.error); return; }
      toast('File diunggah — memverifikasi…');
      setTimeout(function () { HAL.guru.materi(); }, 1500);
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
  };

  $('btn-muat-materi').addEventListener('click', muat);
  muat();
};

HAL.siswa.materi = async function () {
  var el = $('hal-siswa-materi');
  el.innerHTML = '<h2>Materi Kelas Saya</h2><p class="muat">Memuat…</p>';
  var res = await api('listMateri', siswaPayload());
  if (!res.ok) { el.innerHTML = '<h2>Materi</h2><p class="error">' + esc(res.error) + '</p>'; return; }
  el.innerHTML = '<h2>Materi Kelas Saya</h2>' + tabelMateri(res.data, false);
};

/* ---------- Tugas & Pengumpulan ---------- */

function badgeStatus(status) {
  var cls = '';
  if (status === 'Sudah dinilai' || status === 'Sudah mengumpulkan') cls = 'hijau';
  else if (status === 'Terlambat') cls = 'merah';
  else if (status === 'Perlu revisi') cls = 'kuning';
  return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
}

/* Skala huruf A+ s.d. E — CERMIN backend 03_Logic.gs (SKALA_HURUF). Jaga tetap sama. */
var SKALA_HURUF = [
  { huruf: 'A+', min: 97 }, { huruf: 'A', min: 93 }, { huruf: 'A-', min: 90 },
  { huruf: 'B+', min: 87 }, { huruf: 'B', min: 83 }, { huruf: 'B-', min: 80 },
  { huruf: 'C+', min: 77 }, { huruf: 'C', min: 73 }, { huruf: 'C-', min: 70 },
  { huruf: 'D+', min: 67 }, { huruf: 'D', min: 63 }, { huruf: 'D-', min: 60 },
  { huruf: 'E', min: 0 }
];

function hurufNilai(nilai) {
  if (nilai === null || nilai === undefined || nilai === '' || !isFinite(nilai)) return null;
  var n = Math.max(0, Math.min(100, Number(nilai)));
  for (var i = 0; i < SKALA_HURUF.length; i++) {
    if (n >= SKALA_HURUF[i].min) return SKALA_HURUF[i].huruf;
  }
  return 'E';
}

function nilaiDariHuruf(huruf) {
  huruf = String(huruf || '').trim().toUpperCase();
  for (var i = 0; i < SKALA_HURUF.length; i++) {
    if (SKALA_HURUF[i].huruf === huruf) {
      var atas = i === 0 ? 100 : SKALA_HURUF[i - 1].min - 1;
      return Math.round((SKALA_HURUF[i].min + atas) / 2);
    }
  }
  return null;
}

/** "85 (B)" untuk tampilan; "—" bila belum ada nilai. */
function labelNilai(nilai) {
  var h = hurufNilai(nilai);
  return h === null ? '—' : nilai + ' (' + h + ')';
}

/** Opsi <select> huruf untuk form nilai. */
function opsiHuruf() {
  var h = '<option value="">Huruf…</option>';
  SKALA_HURUF.forEach(function (s) { h += '<option value="' + s.huruf + '">' + s.huruf + '</option>'; });
  return h;
}

/**
 * Pasang pilih-huruf + pratinjau huruf live pada satu form nilai.
 * Form harus punya input[name=nilai], select[name=huruf] dan
 * span.huruf-nilai. Memilih huruf mengisi angka tengah pitanya;
 * mengetik angka memperbarui pratinjau huruf.
 */
function pasangPilihHuruf(form) {
  var inputAngka = form.querySelector('input[name="nilai"]');
  var pilih = form.querySelector('select[name="huruf"]');
  var pratinjau = form.querySelector('.huruf-nilai');
  var perbarui = function () {
    if (pratinjau) pratinjau.textContent = hurufNilai(inputAngka.value) || '';
  };
  if (inputAngka) inputAngka.addEventListener('input', perbarui);
  if (pilih) pilih.addEventListener('change', function () {
    var tengah = nilaiDariHuruf(pilih.value);
    if (tengah !== null && inputAngka) { inputAngka.value = tengah; perbarui(); }
  });
  perbarui();
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

/* ---------- Penilaian langsung (tanpa pengumpulan) ---------- */

HAL.guru.penilaian = async function () {
  var el = $('hal-guru-penilaian');
  el.innerHTML = '<h2>Penilaian</h2>' +
    '<p class="muted">Nilai langsung tanpa pengumpulan — mis. nilai praktek di lab. Pilih kelas dan tugas/praktek, lalu isi nilai tiap siswa (angka 0–100 atau pilih huruf A+ s.d. E). Nilai di sini sama dengan nilai tugas biasa: langsung terhitung di Kompetensi. Buat tugas/praktek dulu di menu Tugas kalau belum ada.</p>' +
    '<div class="form-inline"><label>Kelas<select id="nilai-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<label>Tugas / Praktek<select id="nilai-tugas"></select></label>' +
    '<button class="tombol kecil" id="btn-muat-nilai">Tampilkan</button></div>' +
    '<div id="daftar-nilai"></div>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var s = $('nilai-kelas');
      if (s) s.innerHTML = opsiKelas(_kelasCache, false);
    }
  }

  var muatTugas = async function () {
    $('daftar-nilai').innerHTML = '';
    var sel = $('nilai-tugas');
    sel.innerHTML = '<option value="">— pilih tugas —</option>';
    var res = await api('listTugas', guruPayload({ kelas: $('nilai-kelas').value }));
    if (!res.ok) { toast(res.error); return; }
    res.data.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id_tugas;
      o.textContent = t.judul + ' (tenggat ' + t.tenggat + ')';
      sel.appendChild(o);
    });
    if (!res.data.length) toast('Belum ada tugas di kelas ini — buat dulu di menu Tugas.');
  };
  $('nilai-kelas').addEventListener('change', muatTugas);
  await muatTugas();

  var muat = async function () {
    var target = $('daftar-nilai');
    var idTugas = $('nilai-tugas').value;
    if (!idTugas) { target.innerHTML = '<p class="muted">Pilih tugas/praktek dulu.</p>'; return; }
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var kelas = $('nilai-kelas').value;
    var rs = await api('getSiswaByKelas', { kelas: kelas });
    if (!rs.ok) { target.innerHTML = '<p class="error">' + esc(rs.error) + '</p>'; return; }
    var rp = await api('listPengumpulan', guruPayload({ id_tugas: idTugas, terbaru: true }));
    if (!rp.ok) { target.innerHTML = '<p class="error">' + esc(rp.error) + '</p>'; return; }
    var peta = {};
    rp.data.forEach(function (p) { peta[p.id_siswa] = p; });
    var siswa = rs.data.filter(function (s) { return s.status_aktif !== 'Nonaktif'; });
    if (!siswa.length) { target.innerHTML = '<p class="muted">Belum ada siswa aktif di kelas ini.</p>'; return; }
    var h = '<div class="tabel-wrap"><table><tr><th>Siswa</th><th>Status</th><th>Nilai saat ini</th><th>Nilai / Feedback</th></tr>';
    siswa.forEach(function (s) {
      var cur = peta[s.id_siswa];
      var status = cur ? cur.status : 'Belum dinilai';
      var nilaiTxt = esc(labelNilai(cur && cur.nilai !== null ? cur.nilai : null));
      if (cur && cur.jenis === 'langsung') nilaiTxt += ' <span class="muted">(langsung)</span>';
      h += '<tr><td>' + esc(s.nama) + '</td><td>' + badgeStatus(status) + '</td><td>' + nilaiTxt + '</td>' +
        '<td><form class="form-inline" data-form-nilai-langsung="' + esc(s.id_siswa) + '">' +
        '<label>Nilai<input name="nilai" type="number" min="0" max="100" step="1" value="' + (cur && cur.nilai !== null ? esc(cur.nilai) : '') + '" style="width:70px"> <span class="huruf-nilai"></span></label>' +
        '<label>Huruf<select name="huruf">' + opsiHuruf() + '</select></label>' +
        '<label>Feedback<input name="feedback" value="' + esc(cur ? (cur.feedback || '') : '') + '"></label>' +
        '<button type="submit" class="tombol kecil utama">Simpan nilai</button></form></td></tr>';
    });
    target.innerHTML = h + '</table></div><p class="muted">Menyimpan nilai langsung menimpa nilai sebelumnya untuk tugas ini (riwayat tersimpan). Nilai 0–100 — pilih huruf untuk mengisi angka tengah pitanya (A+ 99, A 95, A- 91, B+ 88, B 85, B- 81, C+ 78, C 75, C- 71, D+ 68, D 65, D- 61, E 30).</p>';
    target.querySelectorAll('[data-form-nilai-langsung]').forEach(function (f) {
      pasangPilihHuruf(f);
      f.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(f);
        var res2 = await api('nilaiLangsung', guruPayload({
          id_tugas: idTugas,
          id_siswa: f.getAttribute('data-form-nilai-langsung'),
          nilai: fd.get('nilai') === '' ? undefined : Number(fd.get('nilai')),
          feedback: fd.get('feedback')
        }));
        if (!res2.ok) { toast(res2.error); return; }
        toast('Nilai disimpan.');
        muat();
      });
    });
  };
  $('btn-muat-nilai').addEventListener('click', muat);
  $('nilai-tugas').addEventListener('change', muat);
};

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

/* ---------- Kompetensi ---------- */

function badgeKategori(kategori) {
  var cls = '';
  if (kategori === 'Sangat kompeten' || kategori === 'Kompeten') cls = 'hijau';
  else if (kategori === 'Perlu bimbingan') cls = 'merah';
  else if (kategori === 'Berkembang') cls = 'kuning';
  return '<span class="badge ' + cls + '">' + esc(kategori) + '</span>';
}

function tabelKompetensi(list) {
  if (!list.length) return '<p class="muted">Belum ada data kompetensi. Jalankan "Hitung Kompetensi" dulu.</p>';
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

/* ---------- Kelompok ---------- */

async function petaNamaSiswa_(kelas) {
  var res = await api('listSiswa', guruPayload(kelas ? { kelas: kelas } : {}));
  var peta = {};
  if (res.ok) {
    res.data.forEach(function (s) { peta[s.id_siswa] = s.nama; });
  }
  return peta;
}

function tabelKelompok(list, petaNama) {
  if (!list.length) return '<p class="muted">Belum ada kelompok.</p>';
  var h = '<div class="tabel-wrap"><table><tr><th>Kelompok</th><th>Kelas</th><th>Mode</th><th>Anggota</th><th>Rata Skor</th><th>Komposisi</th><th>Dibuat</th><th></th></tr>';
  list.forEach(function (k) {
    var nama = k.anggota.map(function (id) { return petaNama[id] || id; }).join('; ');
    h += '<tr><td>' + esc(k.nama_kelompok) + '</td><td>' + esc(k.kelas) + '</td><td>' + esc(k.mode) + '</td>' +
      '<td>' + esc(nama) + '</td>' +
      '<td>' + (k.rata_skor === null ? '—' : esc(k.rata_skor)) + '</td>' +
      '<td>' + esc(k.komposisi) + '</td><td>' + esc(k.dibuat_pada) + '</td>' +
      '<td><button class="tombol kecil bahaya" data-hapus-kelompok="' + esc(k.id_kelompok) + '">Hapus</button></td></tr>';
  });
  return h + '</table></div>';
}

HAL.guru.kelompok = async function () {
  var el = $('hal-guru-kelompok');
  el.innerHTML = '<h2>Kelompok</h2>' +
    '<p class="muted">Heterogen = skor dicampur + gender (L/P) dan siswa pintar disebar rata ke tiap kelompok; homogen = skor selevel + gender diseimbangkan (tukar dengan selisih skor terkecil); acak = diacak tapi tetap seimbang gender/pintar; manual = guru yang memilih anggota. Penomoran kelompok berlanjut dari yang sudah ada. Alasan pembentukan disimpan transparan (rata skor + komposisi, termasuk hitungan L/P dan pintar).</p>' +
    '<h3>Generate Kelompok</h3>' +
    '<div id="info-komposisi-kelas" class="muted"></div>' +
    '<form id="form-generate" class="form-inline">' +
    '<label>Kelas<select name="kelas" required>' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<label>Mode<select name="mode"><option value="heterogen">Heterogen</option><option value="homogen">Homogen</option><option value="acak">Acak</option></select></label>' +
    '<label>Anggota per kelompok<input name="anggotaPerKelompok" type="number" min="2" max="10" value="4"></label>' +
    '<label>atau Jumlah kelompok<input name="jumlahKelompok" type="number" min="1" max="20" placeholder="kosongkan bila pakai anggota/kelompok"></label>' +
    '<button type="submit" class="tombol utama">Generate</button>' +
    '</form><p id="error-kelompok" class="error" hidden></p><div id="hasil-generate"></div>' +
    '<h3>Buat Kelompok Manual</h3>' +
    '<form id="form-manual">' +
    '<div class="form-inline"><label>Kelas<select id="manual-kelas" name="kelas" required>' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<label>Nama kelompok<input name="nama" maxlength="100" placeholder="Kelompok 1"></label></div>' +
    '<label>Anggota (pilih satu atau lebih)<select id="manual-anggota" name="anggota" multiple size="6" style="height:auto"></select></label>' +
    '<button type="submit" class="tombol utama">Buat Kelompok</button>' +
    '</form><p id="error-manual-kel" class="error" hidden></p>' +
    '<h3>Daftar Kelompok</h3>' +
    '<div class="form-inline"><label>Kelas<select id="filter-kelompok-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], true) + '</select></label>' +
    '<button class="tombol kecil" id="btn-muat-kelompok">Muat</button></div>' +
    '<div id="daftar-kelompok"><p class="muat">Memuat…</p></div>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      ['form-generate select[name="kelas"]', '#manual-kelas'].forEach(function (sel) {
        var e2 = el.querySelector(sel);
        if (e2) e2.innerHTML = opsiKelas(_kelasCache, false);
      });
      var fs = $('filter-kelompok-kelas');
      if (fs) fs.innerHTML = opsiKelas(_kelasCache, true);
    }
  }

  var muatAnggotaManual = async function () {
    var kelas = $('manual-kelas').value;
    var sel = $('manual-anggota');
    sel.innerHTML = '';
    if (!kelas) return;
    var res = await api('listSiswa', guruPayload({ kelas: kelas }));
    if (!res.ok) return;
    res.data.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id_siswa;
      var ket = [];
      if (s.jenis_kelamin === 'L' || s.jenis_kelamin === 'P') ket.push(s.jenis_kelamin);
      if (s.pintar) ket.push('Pintar');
      o.textContent = s.nama + (ket.length ? ' (' + ket.join(' • ') + ')' : '');
      sel.appendChild(o);
    });
  };
  $('manual-kelas').addEventListener('change', muatAnggotaManual);
  muatAnggotaManual();

  var muatInfoKomposisi = async function () {
    var kelas = el.querySelector('#form-generate select[name="kelas"]').value;
    var target = $('info-komposisi-kelas');
    if (!kelas) { target.textContent = ''; return; }
    var res = await api('listSiswa', guruPayload({ kelas: kelas }));
    if (!res.ok) { target.textContent = ''; return; }
    var jL = 0, jP = 0, jTdk = 0, jPintar = 0;
    res.data.forEach(function (s) {
      if (s.jenis_kelamin === 'L') jL++;
      else if (s.jenis_kelamin === 'P') jP++;
      else jTdk++;
      if (s.pintar) jPintar++;
    });
    target.textContent = 'Kelas ' + kelas + ': ' + res.data.length + ' siswa — Laki-laki ' + jL + ', Perempuan ' + jP +
      (jTdk ? ', belum isi jenis kelamin ' + jTdk : '') + ', pintar ' + jPintar + '.';
  };
  el.querySelector('#form-generate select[name="kelas"]').addEventListener('change', muatInfoKomposisi);
  muatInfoKomposisi();

  $('form-generate').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-kelompok', null);
    var fd = new FormData(ev.target);
    var payload = {
      kelas: fd.get('kelas'), mode: fd.get('mode'),
      anggotaPerKelompok: fd.get('anggotaPerKelompok') ? Number(fd.get('anggotaPerKelompok')) : undefined,
      jumlahKelompok: fd.get('jumlahKelompok') ? Number(fd.get('jumlahKelompok')) : undefined
    };
    var res = await api('generateKelompok', guruPayload(payload));
    if (!res.ok) { tunjukError('error-kelompok', res.error); return; }
    var target = $('hasil-generate');
    target.innerHTML = '<p class="sukses-teks">Terbentuk ' + res.data.kelompok.length + ' kelompok.' +
      (res.data.tanpaSkor ? ' (Catatan: sebagian/seluruh siswa belum punya skor — pengelompokan memakai urutan tanpa skor.)' : '') + '</p>';
    muatDaftar();
  });

  $('form-manual').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-manual-kel', null);
    var anggota = Array.from($('manual-anggota').selectedOptions).map(function (o) { return o.value; });
    if (!anggota.length) { tunjukError('error-manual-kel', 'Pilih minimal 1 anggota.'); return; }
    var fd = new FormData(ev.target);
    var res = await api('buatKelompokManual', guruPayload({
      kelas: fd.get('kelas'), nama: fd.get('nama'), anggota: anggota
    }));
    if (!res.ok) { tunjukError('error-manual-kel', res.error); return; }
    toast('Kelompok manual dibuat.');
    muatDaftar();
  });

  var muatDaftar = async function () {
    var target = $('daftar-kelompok');
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var kelas = $('filter-kelompok-kelas').value;
    var res = await api('listKelompok', guruPayload(kelas ? { kelas: kelas } : {}));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var peta = await petaNamaSiswa_(kelas || undefined);
    target.innerHTML = tabelKelompok(res.data, peta);
    target.querySelectorAll('[data-hapus-kelompok]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Hapus kelompok ini?')) return;
        var r = await api('hapusKelompok', guruPayload({ id_kelompok: b.getAttribute('data-hapus-kelompok') }));
        if (!r.ok) { toast(r.error); return; }
        toast('Kelompok dihapus.');
        muatDaftar();
      });
    });
  };
  $('btn-muat-kelompok').addEventListener('click', muatDaftar);
  muatDaftar();
};

HAL.siswa.kelompok = async function () {
  var el = $('hal-siswa-kelompok');
  el.innerHTML = '<h2>Kelompok Saya</h2><p class="muat">Memuat…</p>';
  var res = await api('listKelompok', siswaPayload());
  if (!res.ok) { el.innerHTML = '<h2>Kelompok</h2><p class="error">' + esc(res.error) + '</p>'; return; }
  var s = Sesi.siswa || {};
  var peta = {};
  var rs = await api('getSiswaByKelas', { kelas: s.kelas });
  if (rs.ok) rs.data.forEach(function (x) { peta[x.id_siswa] = x.nama; });
  var h = '<h2>Kelompok Saya</h2>';
  if (!res.data.length) h += '<p class="muted">Belum ada kelompok untuk kelas Anda.</p>';
  else {
    h += '<div class="tabel-wrap"><table><tr><th>Kelompok</th><th>Mode</th><th>Anggota</th><th>Rata Skor</th><th>Komposisi</th></tr>';
    res.data.forEach(function (k) {
      h += '<tr><td>' + esc(k.nama_kelompok) + '</td><td>' + esc(k.mode) + '</td>' +
        '<td>' + esc(k.anggota.map(function (id) { return peta[id] || id; }).join('; ')) + '</td>' +
        '<td>' + (k.rata_skor === null ? '—' : esc(k.rata_skor)) + '</td><td>' + esc(k.komposisi) + '</td></tr>';
    });
    h += '</table></div>';
  }
  el.innerHTML = h;
};

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

/* ---------- Verifikasi (guru) ---------- */

HAL.guru.verifikasi = async function () {
  var el = $('hal-guru-verifikasi');
  el.innerHTML = '<h2>Daftar Verifikasi</h2>' +
    '<p class="muted">Baris meragukan dari sinkron absensi &amp; impor siswa — TIDAK otomatis masuk data. Periksa satu per satu, lalu perbaiki datanya dari halaman terkait.</p>' +
    '<div id="daftar-verifikasi"><p class="muat">Memuat…</p></div>';
  var res = await api('listVerifikasi', guruPayload({ batas: 200 }));
  if (!res.ok) { $('daftar-verifikasi').innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
  if (!res.data.length) { $('daftar-verifikasi').innerHTML = '<p class="muted">Tidak ada catatan verifikasi.</p>'; return; }
  var h = '<div class="tabel-wrap"><table><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Masalah</th><th>Sumber</th><th>Status</th></tr>';
  res.data.forEach(function (v) {
    h += '<tr><td>' + esc(v.tanggal) + '</td><td>' + esc(v.nama) + '</td><td>' + esc(v.kelas) + '</td><td>' + esc(v.alasan) + '</td><td>' + esc(v.sumber) + '</td><td>' + esc(v.status) + '</td></tr>';
  });
  $('daftar-verifikasi').innerHTML = h + '</table></div><p class="muted">Total: ' + res.data.length + ' catatan (terbaru dulu).</p>';
};

/* ---------- Atur (guru) ---------- */

HAL.guru.atur = async function () {
  var el = $('hal-guru-atur');
  el.innerHTML = '<h2>Pengaturan</h2>' +
    '<h3>Ganti Kode Guru</h3>' +
    '<p class="muted">Kode guru HANYA untuk login guru — rahasia, jangan pernah dibagikan ke siswa. Minimal 4 karakter. Setelah diganti, login ulang dengan kode baru.</p>' +
    '<form id="form-ganti-kode" class="form-inline">' +
    '<label>Kode lama<input name="kodeLama" type="password" required></label>' +
    '<label>Kode baru<input name="kodeBaru" type="password" required minlength="4"></label>' +
    '<button type="submit" class="tombol utama">Ganti Kode</button>' +
    '</form><p id="error-ganti-kode" class="error" hidden></p>' +
    '<h3>Kode Akses (Pintu Depan)</h3>' +
    '<p class="muted">Kode ini yang dibagikan ke siswa untuk masuk ke situs. HARUS beda dari kode guru (server menolak kalau sama). Kosongkan untuk menonaktifkan pintu depan.</p>' +
    '<form id="form-ganti-kode-akses" class="form-inline">' +
    '<label>Kode akses baru<input name="kodeBaru" type="text" minlength="4" placeholder="kosongkan = nonaktifkan"></label>' +
    '<button type="submit" class="tombol utama">Simpan Kode Akses</button>' +
    '</form><p id="error-ganti-kode-akses" class="error" hidden></p>' +
    '<h3>Reset PIN Siswa Satu Kelas</h3>' +
    '<p class="muted">Membuat PIN 6 digit baru untuk SEMUA siswa di kelas itu. PIN ditampilkan SEKALI di bawah — sampaikan ke masing-masing siswa.</p>' +
    '<div class="form-inline"><label>Kelas<select id="reset-pin-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<button class="tombol" id="btn-reset-pin">Reset PIN Kelas Ini</button></div>' +
    '<div id="hasil-reset-pin"></div>' +
    '<h3>Tentang</h3>' +
    '<p class="muted">Classroom Hub — versi Apps Script (frontend statis GitHub Pages + backend Google Apps Script). Data: spreadsheet &amp; folder Drive yang sama dengan versi sebelumnya. Tanpa Cloudflare, tanpa redirect URI, tanpa server.</p>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var s = $('reset-pin-kelas');
      if (s) s.innerHTML = opsiKelas(_kelasCache, false);
    }
  }

  $('form-ganti-kode').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-ganti-kode', null);
    var fd = new FormData(ev.target);
    var res = await api('gantiKodeGuru', guruPayload({
      kodeLama: fd.get('kodeLama'), kodeBaru: fd.get('kodeBaru')
    }));
    if (!res.ok) { tunjukError('error-ganti-kode', res.error); return; }
    toast('Kode guru diganti. Silakan login ulang dengan kode baru.');
    Sesi.guruToken = null;
    tunjukLayar('layar-guru');
  });

  $('form-ganti-kode-akses').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-ganti-kode-akses', null);
    var fd = new FormData(ev.target);
    var res = await api('gantiKodeAkses', guruPayload({ kodeBaru: fd.get('kodeBaru') }));
    if (!res.ok) { tunjukError('error-ganti-kode-akses', res.error); return; }
    toast(res.data.aktif ? 'Kode akses pintu depan disimpan.' : 'Pintu depan dinonaktifkan.');
  });

  $('btn-reset-pin').addEventListener('click', async function () {
    var kelas = $('reset-pin-kelas').value;
    if (!kelas) { toast('Pilih kelas dulu.'); return; }
    if (!confirm('Reset PIN semua siswa kelas "' + kelas + '"? PIN lama tidak berlaku lagi.')) return;
    var target = $('hasil-reset-pin');
    target.innerHTML = '<p class="muat">Membuat PIN…</p>';
    var res = await api('resetSemuaTokenSiswa', guruPayload({ kelas: kelas }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var h = '<p class="sukses-teks">PIN baru untuk ' + res.data.dibuat + ' siswa kelas ' + esc(kelas) + ' (tampil sekali saja):</p>' +
      '<div class="tabel-wrap"><table><tr><th>Nama</th><th>PIN</th></tr>';
    res.data.pin.forEach(function (p) {
      h += '<tr><td>' + esc(p.nama) + '</td><td><strong>' + esc(p.pin) + '</strong></td></tr>';
    });
    target.innerHTML = h + '</table></div>';
  });
};
