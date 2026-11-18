# Catatan Tahap 7 - PWA (Manifest, Service Worker, Offline, Pembaruan)

## Tujuan tahap

Menjadikan UMKM SMART dapat dipasang sebagai aplikasi (PWA) dan tetap bisa dibuka saat tidak ada
internet. Pencatatan usaha tidak boleh bergantung pada jaringan; yang perlu jaringan hanya
aktivasi lisensi dan SMART ADVISOR.

## Yang berfungsi

### Manifest (`/manifest.webmanifest`)

- Dibuat oleh `vite-plugin-pwa` dari `vite.config.js`, bukan file statis terpisah.
- `name`: "UMKM SMART - Manajemen Usaha", `short_name`: "UMKM SMART", `lang`: "id".
- `display: standalone`, `start_url` dan `scope`: `/`, `theme_color: #14532d`,
  `background_color: #f7faf8`.
- Ikon: `icon-192.png`, `icon-512.png` (purpose `any`), dan `icon-maskable-512.png`
  (purpose `maskable`, latar penuh dengan area aman 70%).
- `index.html` memuat `apple-touch-icon` dan meta `apple-mobile-web-app-*` untuk iOS.

### Service worker

- Mode `generateSW` (Workbox) dengan `registerType: 'prompt'`, sehingga versi baru **tidak
  langsung mengambil alih** saat pengguna sedang mencatat transaksi.
- Precache 19 entri (±2,28 MB): HTML, JS, CSS, ikon, dan manifest.
- `navigateFallback: /index.html` agar semua rute React Router tetap terbuka offline.
- `cleanupOutdatedCaches` membuang cache versi lama setelah pembaruan aktif.
- Permintaan lisensi dan proxy AI tidak pernah dicache; hanya aset aplikasi yang masuk precache.
- Service worker hanya dipasang pada hasil build (`npm run build`), tidak pada `npm run dev`.

### Indikator offline (`PwaStatus`)

- Komponen `src/components/pwa/PwaStatus.jsx` dipasang di `App.jsx` sehingga tampil di semua
  halaman, termasuk layar aktivasi.
- Saat browser melaporkan offline: pita "Mode offline. Pencatatan tetap berjalan dan tersimpan di
  perangkat ini." dengan ikon `WifiOff`.
- Saat kembali online, pita hilang otomatis (event `online`/`offline`).
- Setelah aset selesai disimpan, muncul pemberitahuan "Aplikasi siap dipakai offline." yang dapat
  ditutup dan hilang sendiri setelah 6 detik.

### Pemberitahuan pembaruan

- Bila service worker versi baru menunggu, muncul kartu "Versi baru tersedia" dengan penjelasan
  bahwa data usaha tidak terpengaruh.
- Tombol **Muat ulang** mengaktifkan versi baru (`updateServiceWorker(true)`), tombol **Nanti**
  menutup pemberitahuan tanpa memperbarui.
- Pemeriksaan versi baru juga dijalankan otomatis setiap jam selama aplikasi terbuka.

## Cara menguji

```bash
npm run build
npx vite preview --host 127.0.0.1 --port 4173
```

1. Buka `http://127.0.0.1:4173/`, aktifkan mode pengembangan (bila lisensi belum ada).
2. Muat ulang sekali agar service worker mengendalikan halaman.
3. Periksa `navigator.serviceWorker.getRegistration()` dan `caches.keys()` di DevTools.
4. Hentikan server preview, lalu muat ulang halaman: aplikasi harus tetap terbuka dari cache.
5. Buat data baru saat server mati untuk memastikan IndexedDB tetap menulis.
6. Untuk pembaruan: ubah sesuatu di aplikasi, `npm run build` ulang, lalu panggil
   `registration.update()`; kartu pembaruan harus muncul.
7. Untuk pemasangan: gunakan ikon instal di address bar Chrome/Edge (butuh HTTPS atau localhost).

## Hasil pengujian

Pengujian 18 November 2026 pada Chromium desktop, build produksi disajikan `vite preview`
(`http://127.0.0.1:4173`).

| Skenario | Hasil |
|---|---|
| `npm run build` | exit 0; `dist/sw.js`, `dist/workbox-*.js`, `dist/manifest.webmanifest`, 3 ikon PNG |
| Manifest | HTTP 200; `name`, `display: standalone`, ikon 192/512/maskable terbaca |
| Ikon | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` valid (PNG 192/512, RGBA) |
| Registrasi service worker | `activated`, scope `/`, mengendalikan halaman setelah satu muat ulang |
| Precache | 15 entri tersimpan di `workbox-precache-v2-http://127.0.0.1:4173/` (termasuk `/index.html`) |
| Indikator offline | Event `offline` menampilkan pita mode offline; event `online` menghilangkannya |
| Pemakaian offline nyata | Server preview dihentikan, halaman `/pelanggan` dimuat ulang dan tetap tampil lengkap dari cache |
| Menulis data saat offline | Pelanggan "Uji Offline" tersimpan di IndexedDB dan audit log tercatat tanpa server |
| Pemberitahuan pembaruan | Build baru terdeteksi, service worker berstatus `waiting`, kartu "Versi baru tersedia" muncul dengan tombol Muat ulang/Nanti |
| Tombol Nanti | Kartu hilang, versi lama tetap aktif |
| Tombol Muat ulang | Halaman memuat build baru, `waiting` kosong, kartu tidak muncul lagi |
| Pemasangan (install prompt) | Kriteria manifest + service worker terpenuhi, tetapi event `beforeinstallprompt` tidak dipicu di sesi browser otomatis ini; dialog pemasangan belum diuji |
| Data uji | pelanggan, penjualan, stok, kas, audit, cadangan kembali 0 baris |

Catatan pengujian: jaringan tidak dapat dimatikan dari alat browser yang dipakai, sehingga
"offline" diuji dengan menghentikan server lokal (aplikasi tetap berjalan dari cache) dan dengan
mengirim event `offline`/`online` untuk indikator.

## Batasan yang disadari

1. **Pemasangan belum diuji sampai dialog browser.** Event `beforeinstallprompt` tidak muncul
   pada sesi otomasi ini, jadi tombol "Install" di address bar belum diklik. Kriteria teknis
   (manifest, ikon, service worker, localhost/HTTPS) sudah terpenuhi.
2. **Service worker tidak aktif saat `npm run dev`** untuk menghindari cache yang membingungkan
   saat pengembangan. PWA hanya berjalan pada hasil build.
3. **Belum ada backup terjadwal** dan sinkronisasi latar belakang; bagian ini menyusul.
4. Cache hanya berisi aset aplikasi dan **tidak dienkripsi**; data usaha tetap di IndexedDB dan
   tidak ikut dikirim ke mana pun.
5. Pembaruan hanya terdeteksi saat aplikasi dibuka atau selama tab terbuka (cek tiap jam); tidak
   ada pemberitahuan push.
6. Ukuran precache ±2,28 MB karena bundel utama masih satu chunk besar (peringatan >500 kB dari
   Vite tetap muncul). Pemisahan chunk belum dilakukan pada tahap ini.
