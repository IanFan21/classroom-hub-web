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

/* Nomor urut pemuatan dropdown login — hasil pemuatan lama (basi)
   dibuang supaya dua pemuatan yang tumpang tindih tidak menumpuk opsi
   yang sama (pola bug yang sama dengan dropdown tugas di Penilaian). */
var _muatKelasSiswaRun = 0;
var _muatNamaSiswaRun = 0;

async function muatKelasSiswa() {
  var run = ++_muatKelasSiswaRun;
  var pilih = $('pilih-kelas-siswa');
  pilih.innerHTML = '<option value="">— Pilih kelas —</option>';
  var res = await api('getKelasList', {});
  if (run !== _muatKelasSiswaRun) return;
  if (!res.ok) { tunjukError('error-siswa', res.error); return; }
  var html = '<option value="">— Pilih kelas —</option>';
  res.data.forEach(function (k) {
    html += '<option value="' + esc(k.nama_kelas) + '">' + esc(k.nama_kelas) + '</option>';
  });
  pilih.innerHTML = html;
}

async function muatNamaSiswa(kelas) {
  var run = ++_muatNamaSiswaRun;
  var pilih = $('pilih-nama-siswa');
  pilih.innerHTML = '<option value="">— Pilih nama —</option>';
  pilih.disabled = true;
  if (!kelas) return;
  var res = await api('getSiswaByKelas', { kelas: kelas });
  if (run !== _muatNamaSiswaRun) return;
  if (!res.ok) { tunjukError('error-siswa', res.error); return; }
  var html = '<option value="">— Pilih nama —</option>';
  res.data.forEach(function (s) {
    html += '<option value="' + esc(s.nama) + '">' + esc(s.nama) + '</option>';
  });
  pilih.innerHTML = html;
  pilih.disabled = false;
}

