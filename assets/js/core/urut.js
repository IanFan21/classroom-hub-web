/* Urutkan tabel: klik judul kolom (naik → turun → urutan awal).
   Berlaku otomatis untuk semua tabel, termasuk yang digambar ulang. Kolom berisi isian/tombol tidak bisa diurutkan.
   Di HP, tabel penilaian (bentuk kartu) mendapat menu "Urutkan". */

(function () {
  var koltr = (typeof Intl !== 'undefined' && Intl.Collator) ? new Intl.Collator('id', { numeric: true, sensitivity: 'base' }) : null;

  function teks(td) { return (td ? td.textContent : '').replace(/\s+/g, ' ').trim(); }
  function kosongNilai(t) { return t === '' || t === '—' || t === '-'; }
  function angka(t) { var m = /^-?\d+([.,]\d+)?/.exec(t); return m ? parseFloat(m[0].replace(',', '.')) : NaN; }

  function infoTabel(tabel) {
    var baris = Array.prototype.slice.call(tabel.rows);
    var kepala = baris.filter(function (r) { return r.querySelector('th'); })[0];
    if (!kepala) return null;
    var data = baris.filter(function (r) { return r !== kepala && !r.querySelector('th') && r.cells.length === kepala.cells.length; });
    if (data.length < 2) return null;
    return { kepala: kepala, data: data };
  }

  function bisaDiurutkan(data, i) {
    var ada = false;
    for (var k = 0; k < data.length; k++) {
      var td = data[k].cells[i];
      if (!td) return false;
      if (td.querySelector('input:not([type="checkbox"]), select, textarea, button')) return false;
      if (teks(td) !== '') ada = true;
    }
    return ada;
  }

  function urutkan(tabel, info, kolom, arah) {
    var data = info.data.slice();
    if (!arah) {
      data.sort(function (a, b) { return a._awal - b._awal; });
    } else {
      var nilai = data.map(function (r) { return teks(r.cells[kolom]); });
      var banyakAngka = nilai.filter(function (t) { return !kosongNilai(t) && !isNaN(angka(t)); }).length;
      var numerik = banyakAngka >= 0.6 * nilai.filter(function (t) { return !kosongNilai(t); }).length && banyakAngka > 0;
      data.sort(function (a, b) {
        var ta = teks(a.cells[kolom]), tb = teks(b.cells[kolom]);
        var ka = kosongNilai(ta), kb = kosongNilai(tb);
        if (ka || kb) return ka && kb ? a._awal - b._awal : (ka ? 1 : -1); /* kosong selalu di bawah */
        var c;
        if (numerik && !isNaN(angka(ta)) && !isNaN(angka(tb))) c = angka(ta) - angka(tb);
        else c = koltr ? koltr.compare(ta, tb) : (ta < tb ? -1 : ta > tb ? 1 : 0);
        if (c === 0) return a._awal - b._awal;
        return arah === 'desc' ? -c : c;
      });
    }
    var induk = info.data[0].parentNode;
    data.forEach(function (r) { induk.appendChild(r); });
  }

  function tandai(tabel, info, kolomAktif, arah) {
    Array.prototype.forEach.call(info.kepala.cells, function (th, i) {
      if (!th.hasAttribute('data-urut-kolom')) return;
      th.setAttribute('aria-sort', i === kolomAktif && arah ? (arah === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  function pasang(tabel) {
    tabel.setAttribute('data-urut', '1');
    var info = infoTabel(tabel);
    if (!info) return;
    info.data.forEach(function (r, i) { r._awal = i; });
    var kolom = [];
    Array.prototype.forEach.call(info.kepala.cells, function (th, i) {
      if (!bisaDiurutkan(info.data, i)) return;
      th.setAttribute('data-urut-kolom', '1');
      th.setAttribute('tabindex', '0');
      th.setAttribute('aria-sort', 'none');
      th.title = 'Urutkan menurut ' + teks(th).toLowerCase();
      kolom.push({ i: i, nama: teks(th) });
    });
    if (!kolom.length) return;
    var aktif = -1, arah = null;

    function ubah(i, arahBaru) {
      aktif = i; arah = arahBaru;
      urutkan(tabel, info, i, arah);
      tandai(tabel, info, aktif, arah);
      if (menu) menu.value = arah ? i + ':' + arah : '';
    }
    function giliran(i) {
      if (aktif !== i) return 'asc';
      return arah === 'asc' ? 'desc' : arah === 'desc' ? null : 'asc';
    }
    function pada(ev) {
      var th = ev.target.closest && ev.target.closest('th');
      if (!th || !th.hasAttribute('data-urut-kolom')) return;
      if (ev.target.closest('input, select, button, a')) return; /* centang "pilih semua" tetap berfungsi */
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      var i = th.cellIndex;
      ubah(i, giliran(i));
    }
    info.kepala.addEventListener('click', pada);
    info.kepala.addEventListener('keydown', pada);

    /* Menu "Urutkan" untuk tampilan kartu di HP */
    var menu = null;
    if (tabel.classList.contains('tabel-nilai')) {
      var wadah = document.createElement('label');
      wadah.className = 'urut-hp';
      var opsi = '<option value="">Urutan awal</option>';
      kolom.forEach(function (k) {
        opsi += '<option value="' + k.i + ':asc">' + k.nama + ' (naik)</option><option value="' + k.i + ':desc">' + k.nama + ' (turun)</option>';
      });
      wadah.innerHTML = 'Urutkan <select>' + opsi + '</select>';
      menu = wadah.querySelector('select');
      menu.addEventListener('change', function () {
        if (!menu.value) { ubah(-1, null); return; }
        var p = menu.value.split(':');
        ubah(Number(p[0]), p[1]);
      });
      var luar = tabel.closest('.tabel-wrap') || tabel;
      luar.parentNode.insertBefore(wadah, luar);
    }
  }

  function pindai() {
    document.querySelectorAll('table:not([data-urut])').forEach(pasang);
  }

  var jadwal = 0;
  window.pasangUrutTabel = pindai;
  new MutationObserver(function () {
    if (jadwal) return;
    jadwal = requestAnimationFrame(function () { jadwal = 0; pindai(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
