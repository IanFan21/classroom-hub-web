/* ---------- Nilai huruf A+ s.d. E ---------- */

/* Skala huruf — CERMIN backend 03_Logic.gs (SKALA_HURUF). Jaga tetap sama.
   Nilai yang tersimpan tetap angka 0–100; huruf hanya cara menampilkan
   dan cara cepat memilih nilai. */
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
 * Pasang pilih-huruf pada satu form nilai.
 * Form harus punya input[name=nilai] dan select[name=huruf]
 * (span.huruf-nilai opsional, bila masih dipakai di tempat lain).
 * Memilih huruf mengisi angka tengah pitanya; mengetik angka
 * memperbarui pilihan huruf — jadi hurufnya selalu terlihat di
 * dropdown, tanpa elemen tambahan yang merusak baris.
 */
function pasangPilihHuruf(form) {
  var inputAngka = form.querySelector('input[name="nilai"]');
  var pilih = form.querySelector('select[name="huruf"]');
  var pratinjau = form.querySelector('.huruf-nilai');
  var perbarui = function () {
    var h = hurufNilai(inputAngka.value);
    if (pratinjau) pratinjau.textContent = h || '';
    if (pilih) pilih.value = h || '';
  };
  if (inputAngka) inputAngka.addEventListener('input', perbarui);
  if (pilih) pilih.addEventListener('change', function () {
    var tengah = nilaiDariHuruf(pilih.value);
    if (tengah !== null && inputAngka) { inputAngka.value = tengah; perbarui(); }
  });
  perbarui();
}
