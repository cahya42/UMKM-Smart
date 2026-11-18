# Catatan Tahap 1 - Fondasi Aplikasi

## Tujuan tahap

Menyiapkan fondasi yang bisa dijalankan dan diuji: struktur proyek, database lokal 20 tabel
dengan mekanisme versi, navigasi dan layout, dashboard awal, profil usaha, serta fondasi
sistem lisensi (verifikasi bukti bertanda tangan + masa toleransi offline).

## Yang sudah berfungsi

1. **Aplikasi React + Vite** dengan tema hijau, sidebar responsif (drawer di layar kecil),
   topbar, toast, dialog konfirmasi, dan komponen UI dasar.
2. **Database Dexie `umkm-smart` versi 1** berisi 20 tabel sesuai rancangan (Tahap 2 menambah
   tabel `product_price_history` pada skema versi 2), dengan data
   referensi awal: 10 satuan, 9 kategori pengeluaran, akun "Kas Tunai", dan pengaturan dasar.
   Data referensi hanya dibuat sekali saat database pertama kali dibuat.
3. **Dashboard awal** dengan filter periode (hari ini, minggu ini, bulan ini, tahun ini,
   rentang khusus), kartu omzet/HPP/laba kotor/laba bersih/pengeluaran/saldo kas/produk
   aktif/stok menipis, dua grafik, transaksi terbaru, dan daftar stok menipis. Semua nilai
   dihitung oleh fungsi murni di `src/utils/finance.js`; saat belum ada transaksi, aplikasi
   menampilkan keadaan kosong (bukan angka contoh).
4. **Profil usaha**: nama usaha (wajib), pemilik, jenis usaha, alamat, telepon, email, logo
   (maks. 400 KB), deskripsi, tanggal mulai. Validasi Zod, penyimpanan + audit log dalam
   satu transaksi Dexie.
5. **Fondasi lisensi**:
   - Aktivasi email + token melalui `VITE_LICENSE_API_URL` (HTTPS).
   - Verifikasi bukti aktivasi dengan kunci publik ECDSA P-256 (`VITE_LICENSE_PUBLIC_KEY_JWK`);
     private key tidak ada di frontend.
   - Pemeriksaan kecocokan email dan ID perangkat, pengecekan masa berlaku lisensi.
   - Masa toleransi offline 30 hari (dapat diatur lewat `settings.license.offlineGraceDays`
     atau `payload.offlineGraceDays`).
   - Halaman `/aktivasi` dan panel status lisensi di `/pengaturan`, termasuk pemeriksaan
     ulang online dan penghapusan lisensi dari perangkat.
   - Mode pengembangan yang ditandai jelas (banner di seluruh aplikasi + audit log), untuk
     pengujian sebelum server lisensi siap.
6. **Navigasi modul tahap berikutnya** sudah ada dengan penanda `T2`-`T6`, dan halamannya
   menyatakan terus terang bahwa fitur belum aktif.

## Cara menjalankan

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite (bawaan `http://localhost:3000`).

Untuk build produksi:

```bash
npm run build
npm run preview
```

### Konfigurasi lisensi (opsional untuk pengujian)

Salin `.env.example` menjadi `.env`, lalu isi:

- `VITE_LICENSE_API_URL` - alamat server lisensi, misalnya `https://lisensi.contoh.id`
- `VITE_LICENSE_PUBLIC_KEY_JWK` - JWK kunci publik ECDSA P-256 satu baris

Selama dua nilai itu kosong, aktivasi online tidak dapat dilakukan (aplikasi menjelaskan
hal ini di halaman aktivasi). Gunakan **mode pengembangan** untuk menguji aplikasi.

## Langkah pengujian manual

### 1. Gerbang lisensi

1. Buka aplikasi pertama kali. Anda diarahkan ke halaman **Aktivasi UMKM SMART**.
2. Pastikan muncul pemberitahuan bahwa server lisensi belum dikonfigurasi (jika `.env`
   belum diisi).
3. Klik **Aktifkan mode pengembangan** lalu **Ya, aktifkan**.
4. Hasil yang diharapkan: dashboard terbuka, banner kuning "Mode pengembangan aktif"
   tampil di bagian atas, dan status di sidebar/topbar menunjukkan "Mode uji"/"Mode
   pengembangan".

### 2. Dashboard

1. Pada filter periode, coba setiap tombol: Hari ini, Minggu ini, Bulan ini, Tahun ini,
   Periode khusus (isi tanggal Dari/Sampai).
2. Hasil yang diharapkan: kartu statistik menampilkan Rp0 tanpa data, grafik menampilkan
   keadaan kosong ("Belum ada penjualan/pengeluaran pada periode ini"), dan tanggal
   periode pada strip hijau berubah sesuai filter.
3. Perhatikan definisi: Omzet, Laba kotor, Estimasi laba bersih, dan Saldo kas adalah
   angka yang berbeda dan diberi keterangan masing-masing.

### 3. Profil usaha

1. Buka **Profil Usaha**. Coba simpan dengan nama usaha kosong.
2. Hasil yang diharapkan: pesan error "Nama usaha wajib diisi" di bawah kolom, data tidak
   tersimpan.
3. Isi nama usaha dan jenis usaha, lalu simpan.
4. Hasil yang diharapkan: toast "Profil usaha berhasil dibuat", nama usaha muncul di
   sidebar dan topbar, tombol berubah menjadi "Simpan perubahan".
5. Muat ulang halaman (F5). Hasil: data profil tetap ada (tersimpan di IndexedDB).
6. Buka **Pengaturan** dan lihat Audit log: ada catatan "Membuat profil usaha".
7. Coba unggah gambar lebih dari 400 KB. Hasil: pesan error ukuran logo, logo tidak
   berubah.

### 4. Pengaturan & basis data

1. Buka **Pengaturan**. Periksa: versi aplikasi `0.1.0`, nama basis data `umkm-smart`,
   versi skema `v1`, jumlah tabel `20` (pada Tahap 2 menjadi `v2` dengan 21 tabel).
2. Matikan mode pengembangan (sakelar di kartu Mode Pengembangan).
3. Hasil yang diharapkan: aplikasi kembali ke halaman aktivasi karena tidak ada lisensi
   sah. Nyalakan kembali untuk melanjutkan pengujian.

### 5. Modul bertanda tahap

1. Klik menu **Produk**, **Penjualan**, atau **SMART ADVISOR**.
2. Hasil yang diharapkan: halaman "Belum aktif - Tahap N" yang menjelaskan modul dan
   menyatakan tidak ada data palsu. Aplikasi tidak error.

### 6. Responsif

1. Perkecil lebar browser (atau gunakan mode perangkat di DevTools) sampai di bawah 1024 px.
2. Hasil yang diharapkan: sidebar menjadi tombol menu di topbar, kartu statistik
   bertumpuk, formulir profil menjadi satu kolom, dan tabel dapat digeser horizontal.

## Pengujian teknis yang sudah dijalankan

- `npm install` berhasil (109 paket).
- `npm run build` berhasil tanpa error.

Pengujian yang **belum** dilakukan pada tahap ini:

- Pengujian otomatis unit test (belum ada kerangka uji; fungsi keuangan sudah dipisah agar
  mudah diuji pada tahap berikutnya).
- Pengujian aktivasi lisensi dengan server sungguhan (server belum ada; kontraknya
  didokumentasikan di `docs/ARSITEKTUR.md` bagian 6).
- Pengujian PWA/offline (Tahap 7), backup/restore (Tahap 7), dan ekspor laporan (Tahap 5).

## Pekerjaan yang belum selesai / batasan yang disadari

1. **Belum ada backup/restore.** Data hanya ada di IndexedDB perangkat; menghapus data
   browser menghapus data usaha. Dibangun pada Tahap 7. Aplikasi menampilkan peringatan ini
   di halaman Profil dan Pengaturan.
2. **Data lokal belum terenkripsi.** Tidak ada klaim enkripsi di antarmuka.
3. **Server lisensi belum dibuat.** Sisi klien siap (verifikasi kunci publik, toleransi
   offline, audit). Aktivasi online menunggu endpoint `/activate` dan `/verify`.
4. **Mode pengembangan membuka aplikasi tanpa lisensi.** Ini sengaja untuk pengembangan;
   banner dan audit log mencegah penyalahgunaan tanpa penanda.
5. **Dashboard belum bisa diuji dengan data nyata** karena modul penjualan dan pengeluaran
   baru dibuat pada Tahap 4. Perhitungannya sudah memakai struktur data final, sehingga
   tidak perlu diubah saat modul transaksi selesai.
6. **Logo disimpan sebagai data URL di IndexedDB.** Ukuran dibatasi 400 KB; file asli tidak
   disimpan terpisah, sehingga backup tahap 7 tidak perlu mengejar file gambar terpisah.
7. **ID perangkat adalah ID instalasi di IndexedDB**, bukan pengenal perangkat keras yang
   tidak dapat dipalsukan. Perlindungan lisensi bersifat wajar, sesuai master prompt.
8. **Menu modul tahap berikutnya sengaja ditampilkan** agar struktur navigasi final terlihat
   dan pengguna tidak bingung mencari fitur. Semua ditandai `T2`-`T6` dan halaman
   placeholder menjelaskan statusnya.

## Hubungan dengan tahap berikutnya

Struktur tabel, nama kolom, dan fungsi keuangan pada Tahap 1 dipakai langsung oleh Tahap
2-8. Karena itu:

- Jangan mengubah `db.version(1)`; tambahkan versi baru dengan `upgrade()`.
- Jangan mengubah nama tabel/kolom tanpa menyesuaikan repository dan layanan.
- Semua operasi multi-tabel harus memakai `db.transaction('rw', ...)`.
- Nilai uang selalu integer rupiah; gunakan `src/utils/money.js`.
