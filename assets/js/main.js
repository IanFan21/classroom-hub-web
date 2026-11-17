/* Titik masuk: jalankan setelah semua modul dimuat. */

/** Isi <span data-ikon="nama"> dengan SVG, dan beri ikon pada tombol menu. */
function pasangIkon(akar) {
  (akar || document).querySelectorAll('[data-ikon]').forEach(function (el) {
    if (!el.firstChild) el.innerHTML = ikon(el.getAttribute('data-ikon'));
  });
}

function hiasiMenu() {
  document.querySelectorAll('.nav button').forEach(function (b) {
    if (b.dataset.sudah) return;
    b.dataset.sudah = '1';
    var nama = b.getAttribute('data-hal') || 'keluar';
    var teks = b.textContent.trim();
    b.innerHTML = ikon(nama) + '<span>' + teks + '</span>';
    b.title = teks;
  });
}

/* Pintasan (data-ke="peran:halaman") berpindah halaman tanpa lewat menu. */
document.addEventListener('click', function (ev) {
  var b = ev.target.closest && ev.target.closest('[data-ke]');
  if (!b) return;
  var p = b.getAttribute('data-ke').split(':');
  tunjukHal(p[0], p[1]);
});

/* Saat halaman berganti: tandai menu aktif untuk pembaca layar dan gulir ke atas. */
(function () {
  var asli = tunjukHal;
  tunjukHal = function (peran, nama) {
    asli(peran, nama);
    document.querySelectorAll('#nav-' + peran + ' button[data-hal]').forEach(function (b) {
      if (b.getAttribute('data-hal') === nama) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: kurangiGerak() ? 'auto' : 'smooth' });
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  pasangIkon();
  hiasiMenu();
  initAuth();
});
