# Classroom Hub — Frontend (GitHub Pages)

Frontend statis untuk Classroom Hub. Tanpa build, tanpa server, tanpa
secret — hanya HTML + CSS + JavaScript biasa.

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
  hapus massal kelas lulus — kolom Pintar dan Jenis_Kelamin opsional), Materi, Tugas (nilai 0–100 / revisi), Kehadiran (rekap per tanggal atau sebulan, sinkron
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

## Struktur folder

```
index.html
assets/
  css/
    tokens.css      warna & ukuran (tema sekolah: biru tua, emas, putih)
    base.css        reset, tipografi, fokus
    layout.css      kepala, navigasi, kartu, halaman, toast, responsif
    komponen.css    form, tombol, kartu statistik, tabel, badge
  js/
    core/           config (URL Apps Script), util, api (JSONP), sesi
    pages/          satu file per layar: auth, dashboard, kelas, materi,
                    tugas, kehadiran, kompetensi, kelompok, laporan,
                    verifikasi, atur
    main.js         titik masuk (dimuat paling akhir)
```

Urutan `<script>` di `index.html` penting: `core/*` dulu, lalu `pages/*`,
terakhir `main.js`. Semua berkas memakai skrip biasa (tanpa build).

## Tema

Hanya tiga warna: **biru tua** (identitas), **emas** (aksen), **putih/netral**
(latar dan teks). Ubah di `assets/css/tokens.css`. Satu-satunya warna di luar
itu adalah merah untuk pesan error dan tombol hapus.
