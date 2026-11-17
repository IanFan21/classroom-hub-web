# 🎓 Classroom Hub

Aplikasi manajemen kelas untuk guru SMK — supaya urusan kelas sehari-hari
(absensi, tugas, nilai, sampai laporan) bisa diurus dari satu tempat,
tanpa server, tanpa biaya bulanan.

🌐 **Coba langsung:** https://ianfan21.github.io/classroom-hub-web/

## Kenapa dibuat

Aplikasi ini saya buat untuk kelas saya sendiri (TKJ). Sebelumnya nilai,
absensi, dan daftar siswa tersebar di mana-mana — ada yang di spreadsheet,
ada yang di chat, ada yang di kepala. Classroom Hub mengumpulkan semuanya
jadi satu, dengan satu prinsip: **data harus benar dulu, baru yang lain**.
Kalau seorang siswa hadir hari itu, yang tercatat ya hadir — bukan alpha.

Sengaja dibuat sesederhana mungkin: tidak ada server yang harus dijaga,
tidak ada tagihan, dan tidak ada data yang disimpan di tempat yang
tidak saya kenal. Datanya tinggal di Google Sheets dan Google Drive
milik sendiri.

## Yang bisa dilakukan

**Untuk guru**
- 📋 **Kelas & Siswa** — tambah/edit/hapus siswa, impor dari CSV, buat PIN
  untuk tiap siswa, hapus massal kalau satu kelas sudah lulus.
- 📚 **Materi** — unggah file atau tautan ke Drive, diarsipkan kalau
  sudah tidak dipakai (bukan dihapus).
- 📝 **Tugas** — buat tugas dengan tanggal mulai–selesai, edit atau hapus,
  terima pengumpulan berupa tautan atau file, beri nilai dan revisi.
- ⭐ **Penilaian** — nilai praktek langsung tanpa menunggu pengumpulan,
  pakai angka 0–100 atau huruf A+ sampai E. Bisa pilih beberapa siswa
  lalu simpan nilainya sekaligus.
- 🗓️ **Kehadiran** — rekap per tanggal atau sebulan penuh, sinkron dari
  absensi QR, atau isi manual.
- 📈 **Kompetensi** — skor dihitung otomatis: 70% nilai + 30% kehadiran,
  dengan kategori Perlu bimbingan, Berkembang, Kompeten, Sangat kompeten.
- 👥 **Kelompok** — generator kelompok yang seimbang (campur skor,
  seimbangkan laki-laki/perempuan dan siswa pintar), atau susun manual.
- 📄 **Laporan** — pratinjau di layar, unduh sebagai CSV/XLSX/PDF,
  atau simpan ke Drive.

**Untuk siswa**
- Lihat materi, kumpulkan tugas, cek kehadiran dan kompetensi sendiri,
  dan lihat kelompoknya. Semua pakai PIN masing-masing, jadi tiap siswa
  hanya melihat datanya sendiri.

Semua tabel bisa diurutkan — tinggal klik judul kolomnya.

## Cara kerja

Singkatnya: halaman web statis + Google Apps Script + Google Sheets/Drive.

- **Frontend** (repo ini): HTML + CSS + JavaScript biasa, di-host gratis
  di GitHub Pages. Tanpa proses build, tanpa framework.
- **Backend**: Google Apps Script (Web App) yang membaca dan menulis
  spreadsheet. Semua aturan — dedup kehadiran, hitung kompetensi,
  kelompok — tinggal di sana.
- **Data**: spreadsheet dan folder Drive milik sendiri. Tidak ada
  database pihak ketiga, tidak ada secret yang tersimpan di repo ini.

Login guru pakai kode rahasia, siswa pakai PIN. Ada juga kode akses pintu
depan yang bisa dibagikan ke siswa — semuanya dicek di server, bukan di
browser. Sesi guru berlaku 6 jam, setelah itu login ulang.

## Kalau mau pasang sendiri

1. Siapkan backend-nya dulu: sebuah project Google Apps Script (Web App)
   yang terhubung ke spreadsheet Classroom Hub, lalu salin URL-nya
   (yang berakhiran `/exec`).
2. Isi URL itu di `assets/js/core/config.js` pada `APPS_SCRIPT_URL`.
3. Push repo ini ke GitHub dan aktifkan GitHub Pages
   (Settings → Pages → Deploy from branch → `main` → `/ (root)`).
4. Buka `https://<username>.github.io/classroom-hub-web/`.

## Struktur proyek

```
index.html
assets/
  css/   tokens.css, base.css, layout.css, komponen.css (tema 3 warna)
  js/
    main.js            titik masuk
    core/              config.js, api.js, sesi.js, util.js, nilai.js, urut.js, ikon.js, ui.js
    pages/             satu file per halaman (auth, dashboard, kelas, materi,
                       tugas, penilaian, kehadiran, kompetensi, kelompok,
                       laporan, verifikasi, atur)
```

Skrip dimuat berurutan di akhir `index.html`. Catatan buat yang mau
ikut utak-atik: `app.js` dan `style.css` di root sudah dihapus dan
digantikan modul di atas — jangan dibuat lagi.

## Batasan yang perlu diketahui

- Komunikasi ke backend pakai JSONP, jadi ada batas panjang URL — impor
  siswa besar dikirim per chunk ±20 baris, dan laporan besar sebaiknya
  diunduh sebagai berkas, bukan dibuka sebagai pratinjau.
- File yang diunggah maksimal 25 MB (PDF, DOCX, PPTX, PNG/JPG/GIF/WebP).
- Sesi guru berlaku 6 jam (CacheService); sesudah itu login ulang.

## Catatan

Dibuat untuk dipakai di kelas sendiri — kalau mau dipakai atau diubah
untuk sekolahmu, silakan. Kalau menemukan yang aneh atau ada ide,
buka saja issue di repo ini.
