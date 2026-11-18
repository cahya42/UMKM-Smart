# Catatan Tahap 2 - Produk & Persediaan

## Tujuan tahap

Menyediakan data induk produk (barang dan jasa) beserta kategori/satuan, serta pengelolaan
persediaan yang setiap perubahannya tercatat di kartu stok. Modul ini menjadi dasar Tahap 3
(HPP) dan Tahap 4 (penjualan yang mengurangi stok).

## Yang sudah berfungsi

### Produk (`/produk`)

1. **Daftar produk** dengan pencarian nama/SKU dan filter kategori, jenis, serta status.
2. **Tambah/ubah produk**: nama, SKU (otomatis bila kosong), jenis barang/jasa, kategori,
   satuan, harga beli/biaya dasar, harga jual, HPP, stok awal, stok minimum, opsi lacak
   stok, catatan, dan foto (maks. 400 KB).
3. **Riwayat harga & HPP**: setiap perubahan harga beli, harga jual, atau HPP otomatis
   dicatat ke tabel `product_price_history` dan dapat dilihat di detail produk.
4. **Nonaktifkan/aktifkan produk** (data tetap tersimpan) dan **hapus permanen** hanya bila
   produk belum pernah dipakai transaksi dan belum memiliki pergerakan stok selain stok awal.
   Bila sudah ada barang masuk/keluar/penyesuaian, aplikasi menolak dan menyarankan
   nonaktifkan agar kartu stok tetap utuh. Saat produk hanya punya stok awal, penghapusan
   ikut membersihkan stok awal dan riwayat harganya dalam satu transaksi.
5. **Detail produk**: harga, margin, laba per unit, stok, nilai persediaan, riwayat harga,
   dan pergerakan stok terakhir.
6. **Kategori** dan **satuan** dapat ditambah, diubah, dan dihapus. Penghapusan ditolak bila
   masih dipakai produk (pesan menyebutkan jumlah produk yang memakai).

### Persediaan (`/persediaan`)

1. **Ringkasan stok**: nilai persediaan (stok x HPP atau harga beli), jumlah produk berstok,
   stok menipis, stok habis, pencarian, dan filter "hanya stok menipis/habis".
2. **Barang masuk**: jumlah, tanggal, harga beli per satuan (catatan), nama pemasok, keterangan.
3. **Barang keluar**: jumlah, tanggal, alasan (rusak, kedaluwarsa, hilang, pemakaian internal,
   retur, lainnya), keterangan.
4. **Penyesuaian stok (stock opname)**: memasukkan stok hasil hitung fisik; selisih dicatat.
5. **Kartu stok**: pilih produk dan rentang tanggal, melihat saldo awal periode, total masuk,
   total keluar, saldo akhir, serta rincian pergerakan.
6. **Peringatan stok**: badge "Menipis"/"Habis" pada daftar produk dan ringkasan persediaan.
   Dashboard juga menampilkan daftar stok menipis.

### Aturan data yang diterapkan

- Semua perubahan stok memakai **satu transaksi Dexie** yang menulis `stock_movements` dan
  memperbarui `products.stockQty`, sehingga stok dan kartu stok tidak bisa berbeda.
- **Stok tidak boleh negatif.** Barang keluar melebihi stok ditolak dengan pesan yang
  menyebutkan stok saat ini.
- Setiap pergerakan menyimpan `change` (delta), `balanceBefore`, dan `balanceAfter`, sehingga
  kartu stok dapat ditelusuri tanpa menghitung ulang seluruh riwayat.
- Pergerakan stok **tidak bisa diubah atau dihapus**; koreksi dilakukan dengan penyesuaian baru.
- Stok tidak diubah dari formulir produk (baik saat ubah maupun nonaktifkan). Perubahan stok
  hanya lewat menu Persediaan agar selalu memiliki catatan.
- Produk jasa tidak memiliki stok (`trackStock: false`, stok 0).
- Uang tetap integer rupiah; kuantitas mendukung 2 angka desimal untuk kg/liter.
- Semua perubahan penting (produk, harga, kategori, satuan, pergerakan stok) masuk audit log.
- Skema database naik ke **versi 2** hanya dengan menambah tabel `product_price_history`;
  data versi 1 tidak dihapus dan migrasi berjalan otomatis saat aplikasi dibuka.

## Langkah pengujian manual

### A. Produk & validasi

1. Buka **Produk** → **Tambah produk**. Simpan dengan nama kosong.
   Hasil: pesan "Nama produk wajib diisi", data tidak tersimpan.
2. Isi nama "Nasi Ayam Geprek", jenis Barang, satuan pcs, harga beli 12000, harga jual 20000,
   HPP 13000, stok awal 20, stok minimum 5, lalu simpan.
   Hasil: toast "Produk berhasil ditambahkan", produk muncul dengan margin 35% dan stok 20 pcs.
3. Buka detail produk (ikon mata). Hasil: riwayat harga berisi satu baris "Harga awal produk"
   dan pergerakan stok "Stok awal +20".
4. Ubah harga jual menjadi 22000, simpan, lalu buka detail lagi.
   Hasil: riwayat harga bertambah dengan catatan "harga jual Rp20.000 -> Rp22.000".
5. Tambahkan produk jasa "Servis Ringan" (jenis Jasa). Hasil: kolom stok bertuliskan
   "Tanpa stok" dan kolom persediaan tidak muncul di formulir.

### B. Kategori & satuan

1. Buka tab **Kategori**, tambah "Makanan". Hasil: kategori muncul, jumlah produk 0.
2. Coba hapus kategori yang sudah dipakai produk. Hasil: pesan penolakan yang menyebut
   jumlah produk yang memakai; kategori tidak terhapus.
3. Buka tab **Satuan**, tambah "dus" dengan keterangan. Hasil: satuan tersedia di formulir
   produk berikutnya.

### C. Persediaan

1. Buka **Persediaan** → **Barang masuk**. Pilih Nasi Ayam Geprek, jumlah 10, keterangan
   "nota 123", simpan.
   Hasil: toast sukses, stok menjadi 30, kartu stok menampilkan +10 dengan saldo 30.
2. Buka **Barang keluar**, masukkan jumlah 100 (melebihi stok).
   Hasil: pesan error "Stok tidak cukup..." dan stok tidak berubah.
3. Catat barang keluar 2 dengan alasan "Rusak". Hasil: stok 28, kartu stok mencatat -2.
4. Buka **Penyesuaian**, masukkan hasil hitung 25. Hasil: tercatat penyesuaian -3, stok 25.
5. Buka **Kartu stok**, pilih produk dan rentang tanggal bulan ini.
   Hasil: saldo awal, total masuk 10, total keluar 5, saldo akhir 25, rincian sesuai langkah.
6. Buka **Ringkasan stok**, centang "Hanya stok menipis atau habis".
   Hasil: hanya produk dengan stok <= minimum yang tampil. Ubah stok minimum produk menjadi
   30, lalu lihat daftar/dashboard: produk muncul sebagai "Menipis".

### D. Aturan hapus

1. Hapus produk yang sudah memiliki pergerakan stok. Hasil: penolakan, sarankan nonaktifkan.
2. Nonaktifkan produk tersebut. Hasil: status berubah Nonaktif, produk hilang dari filter
   "Aktif" tetapi tetap ada saat filter "Semua status", dan datanya masih utuh.

### E. Migrasi data Tahap 1

1. Buka aplikasi yang sebelumnya sudah dipakai pada Tahap 1 (ada profil usaha).
   Hasil: profil dan pengaturan tetap ada, jumlah tabel di Pengaturan menjadi 21, dan menu
   Produk/Persediaan dapat dipakai tanpa menghapus data.

## Pengujian yang sudah dijalankan

### Pengujian browser nyata (17 November 2026)

Alur diuji dengan klik dan isi formulir sungguhan pada aplikasi yang berjalan (Vite dev
server + IndexedDB di browser), bukan hanya build:

| Skenario | Hasil |
|---|---|
| Aktivasi mode pengembangan | Dashboard terbuka, banner mode pengembangan tampil |
| Tambah produk barang (stok awal 20, minimum 5) | Tersimpan, SKU PRD-0001 otomatis, margin 40% |
| Tambah produk jasa | Tersimpan, kolom stok "Tanpa stok", field stok tidak muncul di formulir |
| Barang masuk 10 | Stok 20 -> 30, kartu stok +10 saldo 30, nilai persediaan Rp270.000 |
| Barang keluar 100 (melebihi stok) | Ditolak "Stok tidak cukup... 30, tidak dapat dikurangi 100", stok tetap 30 |
| Barang keluar 2 (rusak) | Stok 28, alasan tersimpan |
| Penyesuaian menjadi 25 | Selisih -3 tercatat, stok 25 |
| Kartu stok | Saldo awal 0, masuk 30, keluar 5, saldo akhir 25, baris 20/30/28/25 |
| Ubah harga jual 15.000 -> 17.000 | Riwayat harga bertambah, margin 40% -> 47,1% |
| Hapus produk berriwayat stok selain stok awal | Ditolak dengan pesan, dialog tetap terbuka |
| Hapus produk yang hanya punya stok awal | Berhasil; tidak ada pergerakan/riwayat harga yatim |
| Nonaktifkan lalu aktifkan produk | Status berubah, stok dan data tetap |
| Kategori baru dipakai produk | Penghapusan ditolak (dipakai 1 produk) |
| Hapus satuan yang dipakai | Ditolak dengan pesan |
| Stok 6 dengan minimum 10 | Badge "Menipis", dashboard "Stok menipis 1 produk", daftar stok menipis terisi |
| Migrasi database v1 -> v2 dengan data Tahap 1 | Profil tetap, produk lama stok 7 tetap, skema v2/21 tabel, riwayat harga baru bisa ditulis |

Migrasi diuji dengan membuat database **versi 1** (20 tabel, tanpa `product_price_history`)
berisi profil usaha, satuan, akun kas, produk, dan pergerakan stok awal, lalu membuka
apilkasi sehingga Dexie menaikkannya ke versi 2. Tidak ada data yang hilang dan tabel baru
langsung dapat dipakai.

### Bug yang ditemukan dan diperbaiki saat pengujian

1. **`STORES_V1` memuat `product_price_history`.** Tabel v2 sempat ikut dideklarasikan pada
   skema v1, sehingga deklarasi versi 1 tidak lagi sama dengan database Tahap 1 yang asli.
   Diperbaiki: tabel tersebut hanya ada di `STORES_V2`; v1 kembali tepat 20 tabel.
2. **Dialog detail produk tidak tertutup dengan tombol Escape** (dialog formulir dan
   konfirmasi sudah bisa). Ditambahkan penanganan Escape.
3. **Teks konfirmasi hapus tidak sesuai perilaku.** Teks menyatakan semua produk dengan
   riwayat stok tidak dapat dihapus, padahal produk yang hanya memiliki stok awal boleh
   dihapus. Teks diperjelas agar sesuai aturan sebenarnya.

### Pemeriksaan otomatis

- `npm run build` berhasil setelah seluruh perbaikan.
- Pemeriksaan fungsi murni (kartu stok, nilai persediaan, margin, kuantitas, format rupiah)
  dijalankan terpisah dan lulus.

## Batasan yang disadari

1. **Belum ada penjualan.** Pengurangan stok otomatis saat penjualan dan pengembalian stok
   saat pembatalan dikerjakan pada Tahap 4 dengan transaksi pembalik.
2. **HPP masih diisi manual.** Kalkulator HPP (Tahap 3) akan menulis HPP dari komponen biaya
   ke `product_costs` dan memperbarui HPP produk.
3. **Tidak ada impor produk massal** dari Excel; belum diminta pada tahap ini.
4. **Harga beli pada barang masuk hanya catatan**, tidak otomatis mengubah harga produk.
   Perubahan harga sengaja dilakukan di formulir produk agar riwayat harga tetap eksplisit.
5. **Stok dapat berubah menjadi tidak sesuai bila dua tab browser mencatat bersamaan pada
   detik yang sama.** Transaksi Dexie menjaga konsistensi tulis, tetapi belum ada penguncian
   antartab. Untuk pemakaian UMKM biasa (satu perangkat) ini aman.
6. **Foto produk disimpan sebagai data URL di IndexedDB** (maks. 400 KB), sehingga ikut
   terbawa pada backup Tahap 7.
7. **Belum ada satuan konversi** (mis. kg ke gram); satuan masih berupa label.
8. **Peringatan stok belum berupa notifikasi**; baru berupa badge/daftar di dashboard dan
   halaman persediaan.
