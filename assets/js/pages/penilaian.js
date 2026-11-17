/* ---------- Penilaian langsung (tanpa pengumpulan) ---------- */

/* Nomor urut pemuatan daftar tugas — hasil pemuatan lama (basi) dibuang
   supaya dua pemuatan yang tumpang tindih tidak menumpuk opsi yang sama
   di dropdown (pernah terjadi: 1 tugas tampil 2x). */
var _muatTugasPenilaianRun = 0;

HAL.guru.penilaian = async function () {
  var el = $('hal-guru-penilaian');
  el.innerHTML = '<h2>Penilaian</h2>' +
    '<p class="muted">Nilai langsung tanpa pengumpulan — mis. nilai praktek di lab. Pilih kelas dan tugas/praktek, lalu isi nilai tiap siswa (angka 0–100 atau pilih huruf A+ s.d. E). Nilai di sini sama dengan nilai tugas biasa: langsung terhitung di Kompetensi. Kalau prakteknya belum ada, buat langsung dari form di bawah — tidak perlu pindah ke menu Tugas.</p>' +
    '<div class="form-inline"><label>Kelas<select id="nilai-kelas">' + opsiKelas(_kelasCache.length ? _kelasCache : [], false) + '</select></label>' +
    '<label>Tugas / Praktek<select id="nilai-tugas"></select></label>' +
    '<button class="tombol kecil" id="btn-muat-nilai">Tampilkan</button></div>' +
    '<h3>Buat Praktek Baru</h3>' +
    '<form id="form-buat-praktek" class="form-inline">' +
    '<label>Judul praktek<input name="judul" required minlength="2" maxlength="150" placeholder="mis. Praktek Crimping Kabel UTP"></label>' +
    '<label>Mulai<input name="tanggal_mulai" type="date" value="' + hariIni() + '"></label>' +
    '<label>Sampai<input name="tenggat" type="date" required value="' + hariIni() + '"></label>' +
    '<button type="submit" class="tombol utama">Buat praktek</button>' +
    '</form><p id="error-praktek" class="error" hidden></p>' +
    '<div id="daftar-nilai"></div>';

  if (!_kelasCache.length) {
    var rk = await api('listKelas', guruPayload());
    if (rk.ok) {
      _kelasCache = rk.data;
      var s = $('nilai-kelas');
      if (s) s.innerHTML = opsiKelas(_kelasCache, false);
    }
  }

  var muatTugas = async function () {
    $('daftar-nilai').innerHTML = '';
    var run = ++_muatTugasPenilaianRun;
    var sel = $('nilai-tugas');
    sel.innerHTML = '<option value="">— pilih tugas —</option>';
    var res = await api('listTugas', guruPayload({ kelas: $('nilai-kelas').value }));
    if (run !== _muatTugasPenilaianRun) return; // ada pemuatan lebih baru — hasil ini basi, jangan digambar
    if (!res.ok) { toast(res.error); return; }
    var html = '<option value="">— pilih tugas —</option>';
    res.data.forEach(function (t) {
      html += '<option value="' + esc(t.id_tugas) + '">' + esc(t.judul + ' (' + labelRentang(t.tanggal_mulai, t.tenggat) + ')') + '</option>';
    });
    sel.innerHTML = html;
    if (!res.data.length) toast('Belum ada tugas di kelas ini — buat dulu di menu Tugas.');
  };
  $('nilai-kelas').addEventListener('change', muatTugas);
  await muatTugas();

  $('form-buat-praktek').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var btnBuat = ev.target.querySelector('button[type="submit"]');
    if (btnBuat.disabled) return; // cegah klik ganda membuat 2 baris tugas yang sama
    btnBuat.disabled = true;
    tunjukError('error-praktek', null);
    var fd = new FormData(ev.target);
    var res = await api('tambahTugas', guruPayload({
      judul: fd.get('judul'), deskripsi: '',
      kelas: $('nilai-kelas').value, tenggat: fd.get('tenggat'),
      tanggal_mulai: fd.get('tanggal_mulai') || ''
    }));
    if (!res.ok) { tunjukError('error-praktek', res.error); btnBuat.disabled = false; return; }
    toast('Praktek dibuat — silakan nilai.');
    ev.target.reset();
    ev.target.querySelector('input[name="tanggal_mulai"]').value = hariIni();
    ev.target.querySelector('input[name="tenggat"]').value = hariIni();
    await muatTugas();
    var baru = res.data && res.data.id_tugas;
    if (baru) { $('nilai-tugas').value = baru; muat(); }
    btnBuat.disabled = false;
  });

  var muat = async function () {
    var target = $('daftar-nilai');
    var idTugas = $('nilai-tugas').value;
    if (!idTugas) { target.innerHTML = '<p class="muted">Pilih tugas/praktek dulu.</p>'; return; }
    target.innerHTML = '<p class="muat">Memuat…</p>';
    var kelas = $('nilai-kelas').value;
    var rs = await api('getSiswaByKelas', { kelas: kelas });
    if (!rs.ok) { target.innerHTML = '<p class="error">' + esc(rs.error) + '</p>'; return; }
    var rp = await api('listPengumpulan', guruPayload({ id_tugas: idTugas, terbaru: true }));
    if (!rp.ok) { target.innerHTML = '<p class="error">' + esc(rp.error) + '</p>'; return; }
    var peta = {};
    rp.data.forEach(function (p) { peta[p.id_siswa] = p; });
    var siswa = rs.data.filter(function (s) { return s.status_aktif !== 'Nonaktif'; });
    if (!siswa.length) { target.innerHTML = kosongHtml('kelas', 'Belum ada siswa aktif di kelas ini', 'Tambahkan siswa di menu Kelas & Siswa.'); return; }
    var h = '<div class="form-inline"><button type="button" class="tombol kecil" id="btn-pilih-semua">Pilih semua</button>' +
      '<button type="button" class="tombol kecil" id="btn-pilih-terisi">Pilih yang terisi nilai</button>' +
      '<button type="button" class="tombol kecil" id="btn-bersihkan-pilihan">Bersihkan pilihan</button>' +
      '<button type="button" class="tombol utama" id="btn-simpan-dipilih" disabled>Simpan nilai yang dipilih (0)</button></div>' +
      '<div id="hasil-simpan-massal"></div>' +
      '<div class="tabel-wrap"><table class="tabel-nilai"><tr><th><input type="checkbox" id="pilih-semua-nilai" title="Pilih semua"> Siswa</th><th>Status</th><th>Nilai saat ini</th><th>Nilai / Feedback</th></tr>';
    siswa.forEach(function (s) {
      var cur = peta[s.id_siswa];
      var status = cur ? cur.status : 'Belum dinilai';
      var nilaiTxt = esc(labelNilai(cur && cur.nilai !== null ? cur.nilai : null));
      if (cur && cur.jenis === 'langsung') nilaiTxt += ' <span class="muted">(langsung)</span>';
      h += '<tr><td><input type="checkbox" class="pilih-nilai" data-id-siswa="' + esc(s.id_siswa) + '"> ' + esc(s.nama) + '</td><td>' + badgeStatus(status) + '</td><td>' + nilaiTxt + '</td>' +
        '<td><form class="form-inline" data-form-nilai-langsung="' + esc(s.id_siswa) + '">' +
        '<label>Nilai<input name="nilai" type="number" min="0" max="100" step="1" value="' + (cur && cur.nilai !== null ? esc(cur.nilai) : '') + '"></label>' +
        '<label>Huruf<select name="huruf">' + opsiHuruf() + '</select></label>' +
        '<label>Feedback<input name="feedback" value="' + esc(cur ? (cur.feedback || '') : '') + '"></label>' +
        '<button type="submit" class="tombol kecil utama">Simpan nilai</button></form></td></tr>';
    });
    target.innerHTML = h + '</table></div><p class="muted">Centang siswa yang mau disimpan sekaligus, lalu klik "Simpan nilai yang dipilih" — satu kali kirim untuk semuanya. Menyimpan nilai langsung menimpa nilai sebelumnya untuk tugas ini (riwayat tersimpan). Nilai 0–100 — pilih huruf untuk mengisi angka tengah pitanya (A+ 99, A 95, A- 91, B+ 88, B 85, B- 81, C+ 78, C 75, C- 71, D+ 68, D 65, D- 61, E 30).</p>';
    var perbaruiJumlahDipilih = function () {
      var n = target.querySelectorAll('.pilih-nilai:checked').length;
      var btn = $('btn-simpan-dipilih');
      btn.textContent = 'Simpan nilai yang dipilih (' + n + ')';
      btn.disabled = n === 0;
      var semua = target.querySelectorAll('.pilih-nilai');
      var master = $('pilih-semua-nilai');
      if (master) master.checked = semua.length > 0 && n === semua.length;
    };
    var aturSemua = function (nyala) {
      target.querySelectorAll('.pilih-nilai').forEach(function (cb) { cb.checked = nyala; });
      perbaruiJumlahDipilih();
    };
    $('pilih-semua-nilai').addEventListener('change', function () { aturSemua(this.checked); });
    target.querySelectorAll('.pilih-nilai').forEach(function (cb) {
      cb.addEventListener('change', perbaruiJumlahDipilih);
    });
    $('btn-pilih-semua').addEventListener('click', function () { aturSemua(true); });
    $('btn-pilih-terisi').addEventListener('click', function () {
      target.querySelectorAll('.pilih-nilai').forEach(function (cb) {
        var f = cb.closest('tr').querySelector('form[data-form-nilai-langsung]');
        cb.checked = !!f && f.querySelector('input[name="nilai"]').value.trim() !== '';
      });
      perbaruiJumlahDipilih();
    });
    $('btn-bersihkan-pilihan').addEventListener('click', function () { aturSemua(false); });
    $('btn-simpan-dipilih').addEventListener('click', async function () {
      var btn = this;
      var daftar = [];
      var kosong = 0;
      target.querySelectorAll('.pilih-nilai:checked').forEach(function (cb) {
        var f = cb.closest('tr').querySelector('form[data-form-nilai-langsung]');
        if (!f) return;
        var fd = new FormData(f);
        var nilai = String(fd.get('nilai') || '').trim();
        if (nilai === '') { kosong++; return; }
        daftar.push({
          id_siswa: cb.getAttribute('data-id-siswa'),
          nilai: Number(nilai),
          feedback: fd.get('feedback')
        });
      });
      if (!daftar.length) { toast(kosong ? 'Siswa yang dicentang belum diisi nilainya.' : 'Centang dulu siswa yang mau disimpan.'); return; }
      btn.disabled = true;
      btn.textContent = 'Menyimpan…';
      var res3 = await api('nilaiLangsungBanyak', guruPayload({ id_tugas: idTugas, nilai: daftar }));
      if (!res3.ok) { toast(res3.error); btn.disabled = false; perbaruiJumlahDipilih(); return; }
      var d = res3.data;
      var pesan = d.disimpan + ' nilai disimpan.';
      if (kosong) pesan += ' ' + kosong + ' dicentang tapi nilainya kosong (dilewati).';
      if (d.gagal && d.gagal.length) {
        pesan += ' Gagal: ' + d.gagal.map(function (g) { return (g.nama || g.id_siswa) + ' — ' + g.error; }).join('; ');
      }
      $('hasil-simpan-massal').innerHTML = '<p class="sukses-teks">' + esc(pesan) + '</p>';
      toast(d.disimpan + ' nilai disimpan.');
      muat();
    });
    target.querySelectorAll('[data-form-nilai-langsung]').forEach(function (f) {
      pasangPilihHuruf(f);
      f.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(f);
        var res2 = await api('nilaiLangsung', guruPayload({
          id_tugas: idTugas,
          id_siswa: f.getAttribute('data-form-nilai-langsung'),
          nilai: fd.get('nilai') === '' ? undefined : Number(fd.get('nilai')),
          feedback: fd.get('feedback')
        }));
        if (!res2.ok) { toast(res2.error); return; }
        toast('Nilai disimpan.');
        muat();
      });
    });
  };
  $('btn-muat-nilai').addEventListener('click', muat);
  $('nilai-tugas').addEventListener('change', muat);
};
