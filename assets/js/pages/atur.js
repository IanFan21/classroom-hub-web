/* ---------- Atur (guru) ---------- */

HAL.guru.atur = async function () {
  var el = $('hal-guru-atur');
  el.innerHTML = '<h2>Pengaturan</h2>' +
    '<h3>Ganti Kode Guru</h3>' +
    '<p class="muted">Kode guru HANYA untuk login guru — rahasia, jangan pernah dibagikan ke siswa. Minimal 4 karakter. Setelah diganti, login ulang dengan kode baru.</p>' +
    '<form id="form-ganti-kode" class="form-inline">' +
    '<label>Kode lama<input name="kodeLama" type="password" required></label>' +
    '<label>Kode baru<input name="kodeBaru" type="password" required minlength="4"></label>' +
    '<button type="submit" class="tombol utama">Ganti Kode</button>' +
    '</form><p id="error-ganti-kode" class="error" hidden></p>' +
    '<h3>Kode Akses (Pintu Depan)</h3>' +
    '<p class="muted">Kode ini yang dibagikan ke siswa untuk masuk ke situs. HARUS beda dari kode guru (server menolak kalau sama). Kosongkan untuk menonaktifkan pintu depan.</p>' +
    '<form id="form-ganti-kode-akses" class="form-inline">' +
    '<label>Kode akses baru<input name="kodeBaru" type="text" minlength="4" placeholder="kosongkan = nonaktifkan"></label>' +
    '<button type="submit" class="tombol utama">Simpan Kode Akses</button>' +
    '</form><p id="error-ganti-kode-akses" class="error" hidden></p>' +
    '<h3>Reset PIN Siswa Satu Kelas</h3>' +
    '<p class="muted">Membuat PIN 6 digit baru untuk SEMUA siswa di kelas itu. PIN ditampilkan SEKALI di bawah — sampaikan ke masing-masing siswa.</p>' +
    '<div class="form-inline"><label>Kelas<select id="reset-pin-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<button class="tombol" id="btn-reset-pin">Reset PIN Kelas Ini</button></div>' +
    '<div id="hasil-reset-pin"></div>' +
    '<h3>Tentang</h3>' +
    '<p class="muted">Classroom Hub — versi Apps Script (frontend statis GitHub Pages + backend Google Apps Script). Data: spreadsheet &amp; folder Drive yang sama dengan versi sebelumnya. Tanpa Cloudflare, tanpa redirect URI, tanpa server.</p>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var s = $('reset-pin-kelas');
      if (s) s.innerHTML = opsiKelas(_kelasCache, false);
    }
  }

  $('form-ganti-kode').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-ganti-kode', null);
    var fd = new FormData(ev.target);
    var res = await api('gantiKodeGuru', guruPayload({
      kodeLama: fd.get('kodeLama'), kodeBaru: fd.get('kodeBaru')
    }));
    if (!res.ok) { tunjukError('error-ganti-kode', res.error); return; }
    toast('Kode guru diganti. Silakan login ulang dengan kode baru.');
    Sesi.guruToken = null;
    tunjukLayar('layar-guru');
  });

  $('form-ganti-kode-akses').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    tunjukError('error-ganti-kode-akses', null);
    var fd = new FormData(ev.target);
    var res = await api('gantiKodeAkses', guruPayload({ kodeBaru: fd.get('kodeBaru') }));
    if (!res.ok) { tunjukError('error-ganti-kode-akses', res.error); return; }
    toast(res.data.aktif ? 'Kode akses pintu depan disimpan.' : 'Pintu depan dinonaktifkan.');
  });

  $('btn-reset-pin').addEventListener('click', async function () {
    var kelas = $('reset-pin-kelas').value;
    if (!kelas) { toast('Pilih kelas dulu.'); return; }
    if (!confirm('Reset PIN semua siswa kelas "' + kelas + '"? PIN lama tidak berlaku lagi.')) return;
    var target = $('hasil-reset-pin');
    target.innerHTML = '<p class="muat">Membuat PIN…</p>';
    var res = await api('resetSemuaTokenSiswa', guruPayload({ kelas: kelas }));
    if (!res.ok) { target.innerHTML = '<p class="error">' + esc(res.error) + '</p>'; return; }
    var h = '<p class="sukses-teks">PIN baru untuk ' + res.data.dibuat + ' siswa kelas ' + esc(kelas) + ' (tampil sekali saja):</p>' +
      '<div class="tabel-wrap"><table><tr><th>Nama</th><th>PIN</th></tr>';
    res.data.pin.forEach(function (p) {
      h += '<tr><td>' + esc(p.nama) + '</td><td><strong>' + esc(p.pin) + '</strong></td></tr>';
    });
    target.innerHTML = h + '</table></div>';
  });
};

