/* Fitur dilipat: tiap bagian (judul h3 + isinya) di menu guru menjadi panel yang dibuka dengan klik.
   Berlaku otomatis, termasuk untuk fitur baru. Panel daftar/rekap terbuka dari awal, form dan pengaturan tertutup.
   Pengecualian: elemen dengan atribut data-lipat-akhir, atau yang memuat judul sendiri, menjadi batas bagian. */

(function () {
  var TERBUKA_AWAL = /^(Daftar(?! Kelas)|Rekap|Siswa$|Pengumpulan|Hasil|Rincian)/;
  var IKON_JUDUL = [
    [/^(Tambah|Buat|Generate)/, 'tambah'], [/^Impor/, 'unggah'], [/^(Isi|Edit|Input)/, 'pensil'],
    [/^Hapus/, 'hapus'], [/^Sinkron/, 'segar'], [/^(Ganti|Kode|Reset)/, 'kunci'], [/^Tentang/, 'info'],
    [/^(Daftar|Rekap|Siswa|Pengumpulan|Hasil|Rincian)/, 'daftar'], [/^Soal/, 'tugas']
  ];
  var ingat = {}; /* kunci -> terbuka? (selama halaman belum dimuat ulang) */

  function pilihIkon(judul) {
    for (var i = 0; i < IKON_JUDUL.length; i++) if (IKON_JUDUL[i][0].test(judul)) return IKON_JUDUL[i][1];
    return 'info';
  }
  function batas(el) {
    return el.tagName === 'H3' || el.tagName === 'H2' || el.hasAttribute('data-lipat-akhir') || !!el.querySelector('h3, h2');
  }

  function bungkus(hal) {
    var anak = Array.prototype.slice.call(hal.children);
    var judulH3 = anak.filter(function (e) { return e.tagName === 'H3'; });
    if (!judulH3.length) return;
    var dibuat = [];
    judulH3.forEach(function (h3) {
      var judul = h3.textContent.replace(/\s+/g, ' ').trim();
      var kunci = hal.id + '|' + judul.replace(/\(.*?\)/g, '').trim();
      var d = document.createElement('details');
      d.className = 'lipat';
      d.open = kunci in ingat ? ingat[kunci] : TERBUKA_AWAL.test(judul);
      var s = document.createElement('summary');
      s.innerHTML = '<span class="lipat-ikon">' + ikon(pilihIkon(judul)) + '</span><span class="lipat-judul"></span><span class="lipat-panah">' + ikon('panah') + '</span>';
      s.querySelector('.lipat-judul').textContent = judul;
      var isi = document.createElement('div');
      isi.className = 'lipat-isi';
      var n = h3.nextSibling;
      while (n && !(n.nodeType === 1 && batas(n))) { var sel = n.nextSibling; isi.appendChild(n); n = sel; }
      d.appendChild(s); d.appendChild(isi);
      d.addEventListener('toggle', function () { ingat[kunci] = d.open; });
      hal.replaceChild(d, h3);
      dibuat.push(d);
    });
    if (dibuat.length >= 3) {
      var alat = document.createElement('div');
      alat.className = 'lipat-alat';
      alat.innerHTML = '<button type="button" class="tautan" data-lipat="buka">Buka semua</button><button type="button" class="tautan" data-lipat="tutup">Tutup semua</button>';
      alat.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-lipat]');
        if (!b) return;
        var buka = b.getAttribute('data-lipat') === 'buka';
        hal.querySelectorAll(':scope > details.lipat').forEach(function (x) { x.open = buka; });
      });
      hal.insertBefore(alat, dibuat[0]);
    }
  }

  function pindai() {
    document.querySelectorAll('[id^="hal-guru-"]:not(#hal-guru-dashboard)').forEach(bungkus);
  }

  /* Kode lain yang menggulir/memfokuskan elemen di dalam panel tertutup (mis. "Edit tugas") membukanya dulu. */
  ['scrollIntoView', 'focus'].forEach(function (nama) {
    var asli = Element.prototype[nama];
    Element.prototype[nama] = function () {
      var d = this.closest && this.closest('details.lipat');
      while (d) { if (!d.open) d.open = true; d = d.parentElement && d.parentElement.closest('details.lipat'); }
      return asli.apply(this, arguments);
    };
  });

  var jadwal = 0;
  new MutationObserver(function () {
    if (jadwal) return;
    jadwal = requestAnimationFrame(function () { jadwal = 0; pindai(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
