# Halaman "typewriter letters"

## Context

Aplikasi saat ini hanya satu halaman: puzzle jigsaw "A little quote for you" yang seluruhnya ada di `src/App.tsx`, di-mount langsung oleh `src/main.tsx`. Belum ada router sama sekali.

Yang diminta: halaman **baru** bergaya dua screenshot referensi (`src/imports/image-4.png`, `image-5.png`) — mesin tik retro menempel di bawah viewport dengan latar kain gingham, dan selembar kertas panjang yang seolah tergulung keluar dari mesin tik ke atas saat halaman di-scroll. Isi kertas: baris pembuka, judul besar dalam tanda kutip, lalu entri bernomor (01, 02) berisi heading mono, paragraf, dan doodle garis. **Dua section dulu.**

Sesuai pilihan: halaman ini jadi **route terpisah** (`/letters`), dengan link kecil dua arah antara halaman puzzle dan halaman surat.

## Rencana

### 1. Pasang routing (react-router, Data mode)

- `pnpm add react-router`.
- Pindahkan seluruh isi `src/App.tsx` yang sekarang ke `src/pages/PuzzlePage.tsx` **apa adanya** (default export, ganti nama komponen jadi `PuzzlePage`). Tidak ada perubahan logika puzzle.
- `src/App.tsx` menjadi tipis: `<RouterProvider router={router} />`.
- `src/routes.tsx`: `createBrowserRouter([{ path: '/', Component: Root, children: [{ index: true, Component: PuzzlePage }, { path: 'letters', Component: LettersPage }, { path: '*', Component: NotFound }] }])`. `Root` cukup `<Outlet />` (tanpa chrome bersama, karena dua halaman punya latar yang sangat berbeda).
- Link navigasi kecil bergaya mono: di halaman puzzle di bawah tombol "main lagi" → `surat untukmu →`; di halaman surat, pojok kiri atas (fixed) → `← puzzle`.

### 2. Font

Tambah di paling atas `src/index.css`, sebelum `@import 'tailwindcss'` (urutan `@import` wajib paling awal):
- **Special Elite** — judul besar dan angka 01/02 (typewriter berkarakter, mirip referensi).
- **Courier Prime** — body dan heading kecil.

DM Sans/DM Mono tetap untuk halaman puzzle. Font surat dipakai lewat class scoped (`.letters` ancestor) supaya tidak bocor ke halaman puzzle.

### 3. `src/pages/LettersPage.tsx` — mekanika gulungan kertas

Model paling sederhana dan mulus, tanpa library animasi:

- **Spacer scroll**: satu `div` kosong setinggi `sheetHeight + 40vh` yang memberi scroll native. Tidak ada scroll-jacking.
- **Lapisan fixed** (semua `position: fixed`, urutan z dari bawah): latar gingham → kertas → mesin tik.
- **Kertas**: satu lembar tinggi berisi seluruh konten dua section, `transform: translate3d(-50%, ${-scrollY}px, 0)`, top awal ± 48px. Jadi kertas benar-benar bergerak naik dan bagian bawahnya lewat **di belakang** mesin tik (z lebih rendah) — persis kesan keluar dari platen. Ujung atas kertas keluar dari viewport secara alami.
- Scroll dibaca lewat listener `scroll` pasif + `requestAnimationFrame`, disimpan di ref dan ditulis langsung ke `style.transform` (menghindari re-render per frame). Tidak ada easing di sini — gerakan terikat scroll harus 1:1.
- Tinggi kertas diukur dengan `ResizeObserver` pada elemen konten, dipakai untuk menentukan tinggi spacer.

### 4. Mesin tik (CSS murni, `src/components/Typewriter.tsx`)

Mengikuti referensi, semua dari elemen + CSS (bukan gambar):
- Badan gelap `#1d1d1f` dengan tekstur titik halus (`radial-gradient` berulang) dan sudut membulat.
- Platen: bar metalik gradien terang di atas badan, dua roller bulat gelap, dua knob putar di kiri-kanan (lingkaran bergaris `repeating-conic-gradient`).
- Tiga baris tombol QWERTY: lingkaran dengan gradien perak, huruf `Courier Prime` kecil, plus spacebar.
- Lebar `min(760px, 96vw)`, tinggi menyesuaikan; menempel `bottom: 0`.
- Sentuhan hidup: satu tombol acak "tertekan" (translateY 1px, bayangan mengecil) selama kertas bergerak — 120ms, `ease-out`, dimatikan saat `prefers-reduced-motion`.

### 5. Isi kertas (dua section)

Struktur meniru referensi, dalam Bahasa Indonesia, nada personal:
1. **Section 01** — baris pembuka kecil ("Mungkin boleh dimulai dari hal-hal kecil."), judul besar dalam tanda kutip (mis. `"HAL-HAL KECIL"`), lalu `01` + heading `SORE YANG BIASA` + paragraf + doodle.
2. **Section 02** — dipisah garis putus-putus (`border-top: dashed`, persis referensi), lalu `02` + heading + paragraf + doodle.

Teks final ditulis saat implementasi dan gampang diganti karena disimpan sebagai satu array `SECTIONS` di atas file.

### 6. Doodle

Dua doodle garis tangan (satu per section) sebagai inline SVG stroke-only, hitam, `stroke-linecap: round` — gaya sama dengan croissant/bagel di referensi. Skill `make:icon-illustration` dipanggil saat menggambarnya. Ditempatkan di `src/components/doodles.tsx`.

### 7. Responsif & aksesibilitas

- Kertas `width: min(560px, 90vw)`; ukuran teks pakai `clamp()`.
- Di bawah 640px mesin tik dikecilkan (skala tombol dan tinggi badan) supaya tidak menelan setengah layar.
- `prefers-reduced-motion`: gerakan kertas tetap (itu murni posisi scroll), animasi tombol dan reveal dimatikan.
- Kontras teks hitam di kertas krem aman; link nav punya focus ring.

## File yang disentuh

- baru: `src/routes.tsx`, `src/pages/PuzzlePage.tsx` (pindahan), `src/pages/LettersPage.tsx`, `src/components/Typewriter.tsx`, `src/components/doodles.tsx`
- diubah: `src/App.tsx` (jadi RouterProvider), `src/index.css` (import font + kelas gingham/kertas), `package.json`
- tidak disentuh: logika puzzle, `src/main.tsx`, `src/imports/*`

## Verifikasi

1. `npx tsc --noEmit` dan `npx vite build` bersih.
2. Buka `/` — puzzle berperilaku persis seperti sebelumnya (glow berurutan, shake, "main lagi"), dan ada link ke `/letters`.
3. Buka `/letters` — scroll dari atas ke bawah: kertas naik mulus tanpa jitter, ujung bawahnya selalu tersembunyi di belakang platen, section 02 muncul setelah 01, dan scroll berhenti tepat setelah baris terakhir lewat di atas mesin tik.
4. Cek di lebar 375px, 768px, dan 1440px: mesin tik tidak menutupi teks, kertas tidak terpotong horizontal.
5. Reload langsung di `/letters` harus tetap render (dev server Vite mendukung SPA fallback).
