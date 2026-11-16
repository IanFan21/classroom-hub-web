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

