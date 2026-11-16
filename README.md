# Classroom Hub — Frontend (GitHub Pages)

Frontend statis untuk Classroom Hub. Tanpa build, tanpa server, tanpa
secret — hanya HTML + CSS + JavaScript biasa.

## Cara pakai

1. Isi `APPS_SCRIPT_URL` di `app.js` dengan URL Web App Apps Script
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
- Guru: Dashboard, Kelas & Siswa (tambah/hapus, buat PIN, impor CSV),
  Materi, Tugas (nilai 0–100 / revisi), Kehadiran (rekap, sinkron
  Absensi QR, input manual), Kompetensi, Kelompok, Laporan
  (pratinjau + unduh CSV/XLSX/PDF + simpan ke Drive), Verifikasi, Atur.
- Siswa: Dashboard, Materi, Tugas (kumpul tautan/file), Kehadiran,
  Kompetensi, Kelompok, Laporan (hanya datanya sendiri).

## Batas yang perlu diketahui

- JSONP GET punya batas panjang URL — impor siswa dikirim per chunk
  ±20 baris; laporan besar sebaiknya diunduh sebagai berkas, bukan
  pratinjau JSON.
- File maksimal 25 MB (PDF, DOCX, PPTX, PNG/JPG/GIF/WebP).
- Sesi guru berlaku 6 jam (CacheService); sesudah itu login ulang.
