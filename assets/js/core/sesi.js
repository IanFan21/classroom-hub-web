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

