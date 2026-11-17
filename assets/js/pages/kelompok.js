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
  if (!list.length) return kosongHtml('kelompok', 'Belum ada kelompok', 'Buat kelompok otomatis atau manual, hasilnya tampil di sini.');
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
  if (!res.data.length) h += kosongHtml('kelompok', 'Belum ada kelompok untuk kelas Anda', 'Guru akan membagi kelompok, lalu muncul di sini.');
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

