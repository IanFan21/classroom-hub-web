/* ---------- JSONP (pola absensi-pkl) ---------- */

var _cbSeq = 0;

/** Panggil aksi backend. Resolve {ok, data} / {ok:false, error}. Timeout 40 dtk. */
function api(action, payload) {
  return new Promise(function (resolve) {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('GANTI_') === 0) {
      resolve({ ok: false, error: 'APPS_SCRIPT_URL belum diisi di assets/js/core/config.js.' });
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

