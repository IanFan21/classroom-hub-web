# Classroom Hub — Frontend (GitHub Pages)

Frontend statis untuk Classroom Hub. Tanpa build, tanpa server, tanpa
secret — hanya HTML + CSS + JavaScript biasa.

**Struktur (sejak frontend v9, 17 Nov 2026):** `index.html` + `assets/css/`
(tema 3 warna: `tokens.css`, `base.css`, `layout.css`,
`komponen.css`) + `assets/js/` — satu-satunya logika yang live:
`main.js` (titik masuk) + `core/` (`config.js`, `api.js`, `sesi.js`,
`util.js`, `nilai.js` = skala huruf A+ s.d. E) + `pages/` (satu file
per halaman: `auth`, `dashboard`, `kelas`, `materi`, `tugas`,
`penilaian`, `kehadiran`, `kompetensi`, `kelompok`, `laporan`,
`verifikasi`, `atur`). `app.js` root dan `style.css` root SUDAH
DIHAPUS dari repo (digantikan modul) — jangan dibuat/push lagi.
Skrip dimuat berurutan di akhir `index.html`; `dashboard.js`
(mendefinisikan `HAL`) harus pertama di antara file `pages/`.

## Cara pakai

1. Isi `APPS_SCRIPT_URL` di `assets/js/core/config.js` dengan URL Web App Apps Script
   (berakhiran `/exec`).
2. Push repo ini ke GitHub (publik) dan aktifkan GitHub Pages
   (Settings → Pages → Deploy from branch → `main` → `/ (root)`).
3. Buka `https://<username>.github.io/classroom-hub-web/`.

## Cara kerja

- Semua aksi ke backend lewat **JSONP GET** (`?payload={...}&callback=...`,
  timeout 40 detik) — pola yang sama dengan absensi-pkl.
- Upload file lewat **POST `no-cors`** (fire-and-forget, dua fase:
  upload dulu, lalu verifikasi dengan aksi baca).
- Sesi disimpan di `sessionStorage` (hilang saat tab ditutup):
  kode akses pintu depan, token guru, dan `{idSiswa, pin}` siswa.
- Tidak ada secret di repo ini. Dua kode dicek di server (Script
  Properties): `GURU_KODE` (login guru saja — rahasia, jangan pernah
  dibagikan ke siswa) dan `KODE_AKSES` (pintu depan, dibagikan ke
  siswa; diatur guru dari halaman Atur, harus beda dari kode guru).
  PIN siswa dicek di server (kolom `Token` tab Siswa).

## Layar

- Pintu depan (kode akses) → pilih peran → login guru (kode) /
  login siswa (kelas → nama → PIN).
- Guru: Dashboard, Kelas & Siswa (tambah/edit/hapus, buat PIN, impor CSV,
  hapus massal kelas lulus — kolom Pintar dan Jenis_Kelamin opsional), Materi, Tugas (tambah/edit/hapus, arsip; tanggal mulai opsional — tampil sebagai rentang "Mulai s.d. Tenggat"; nilai 0–100 / revisi), Penilaian (nilai langsung tanpa pengumpulan — mis. praktek; angka 0–100 atau huruf A+ s.d. E; form Buat Praktek di halaman yang sama — judul + Mulai–Sampai, langsung bisa dinilai), Kehadiran (rekap per tanggal atau sebulan, sinkron
  Absensi QR, input manual), Kompetensi, Kelompok (heterogen/homogen/acak
  menyeimbangkan gender L/P dan siswa pintar; manual), Laporan
  (pratinjau + unduh CSV/XLSX/PDF + simpan ke Drive), Verifikasi, Atur.
- Siswa: Dashboard, Materi, Tugas (kumpul tautan/file), Kehadiran,
  Kompetensi, Kelompok, Laporan (hanya datanya sendiri).

## Batas yang perlu diketahui

- JSONP GET punya batas panjang URL — impor siswa dikirim per chunk
  ±20 baris; laporan besar sebaiknya diunduh sebagai berkas, bukan
  pratinjau JSON.
- File maksimal 25 MB (PDF, DOCX, PPTX, PNG/JPG/GIF/WebP).
- Sesi guru berlaku 6 jam (CacheService); sesudah itu login ulang.
