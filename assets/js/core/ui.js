/* Pembantu tampilan: sapaan, keadaan kosong, angka berhitung, aksi cepat. */

function kurangiGerak() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** "Selamat pagi" / siang / sore / malam menurut jam perangkat. */
function sapaan() {
  var j = new Date().getHours();
  return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam';
}

function tanggalPanjang() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Kepala halaman dashboard: sapaan + tanggal. */
function kepalaSapaan(nama, keterangan) {
  return '<div class="sapaan">' +
    '<div><h2>' + sapaan() + (nama ? ', ' + esc(nama) : '') + '</h2>' +
    '<p class="muted">' + esc(tanggalPanjang()) + (keterangan ? ' · ' + esc(keterangan) : '') + '</p></div></div>';
}

/** Keadaan kosong: ikon + apa yang terjadi + apa yang bisa dilakukan. */
function kosongHtml(namaIkon, judul, saran) {
  return '<div class="kosong">' +
    '<span class="kosong-ikon">' + ikon(namaIkon) + '</span>' +
    '<p class="kosong-judul">' + esc(judul) + '</p>' +
    (saran ? '<p class="muted">' + esc(saran) + '</p>' : '') +
    '</div>';
}

/** Tombol pintasan: daftar [ikon, label, 'peran:halaman']. */
function aksiCepat(daftar) {
  return '<div class="aksi-cepat">' + daftar.map(function (a) {
    return '<button type="button" class="aksi" data-ke="' + a[2] + '">' + ikon(a[0]) + '<span>' + esc(a[1]) + '</span></button>';
  }).join('') + '</div>';
}

/** Angka pada .angka berhitung naik dari 0 (dilewati bila pengguna mengurangi gerak). */
function hidupkan(el) {
  if (kurangiGerak()) return;
  el.querySelectorAll('.angka').forEach(function (n) {
    var m = /^(\d+)(%?)$/.exec(n.textContent.trim());
    if (!m) return;
    var target = Number(m[1]), suf = m[2], t0 = performance.now();
    n.textContent = '0' + suf;
    (function langkah(now) {
      var p = Math.min(1, (now - t0) / 700);
      n.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(langkah);
    })(t0);
  });
}

/** Bilah ringkasan: daftar [label, jumlah, kelas-warna]. */
function bilahRingkas(daftar) {
  var total = daftar.reduce(function (s, d) { return s + d[1]; }, 0);
  if (!total) return '';
  return '<div class="bilah" role="img" aria-label="' + esc(daftar.map(function (d) { return d[0] + ' ' + d[1]; }).join(', ')) + '">' +
    daftar.filter(function (d) { return d[1] > 0; }).map(function (d) {
      return '<span class="' + d[2] + '" style="flex:' + d[1] + '" title="' + esc(d[0] + ': ' + d[1]) + '"></span>';
    }).join('') + '</div>';
}
