# Catatan Tahap 4 - Penjualan, Pembatalan, Pengeluaran, Pelanggan & Pemasok

## Tujuan tahap

Menutup alur uang inti: penjualan mengurangi stok dan menambah kas, pembatalan mengembalikan
keduanya lewat transaksi pembalik, dan pengeluaran mengurangi kas. Tahap ini juga mengaktifkan
data relasi (pelanggan dan pemasok) agar nota dan barang masuk terhubung ke kontak yang benar.

## Yang sudah berfungsi

### Penjualan (`/penjualan`)

1. **Daftar nota** dengan filter bulan, pelanggan, status (selesai/dibatalkan), dan pencarian nomor
   nota atau pelanggan.
2. **Transaksi baru** (`/penjualan/baru`): tanggal, pelanggan terdaftar (opsional), metode
   pembayaran, akun kas penerima, baris produk (jumlah, harga jual, diskon baris), diskon nota,
   dan catatan.
3. **Nomor nota otomatis** `INV-YYYYMMDD-NNN` per hari, unik dan tidak dapat diubah pengguna.
4. **Pengurangan stok otomatis** untuk produk barang yang melacak stok, dengan pergerakan
   `penjualan` yang menyimpan saldo sebelum/sesudah. Produk jasa tidak menyentuh stok.
5. **Kas masuk otomatis** ke akun kas yang dipilih, dengan `refType: 'sale'` dan `refId` nota.
6. **Harga dan HPP dibekukan** pada `sale_items` saat transaksi, sehingga perubahan harga produk
   di kemudian hari tidak mengubah laba nota lama.
7. **Pencegahan stok negatif**: jumlah melebihi stok ditolak dengan pesan yang menyebut stok
   tersedia, dan transaksi dibatalkan seluruhnya (tidak ada data setengah jadi).
8. **Detail nota**: item, harga, diskon, HPP per unit, total, laba kotor, margin, akun kas,
   catatan, serta informasi pembatalan.

### Pembatalan penjualan

- Status nota menjadi `dibatalkan`; nota **tidak dihapus**.
- Stok setiap item dikembalikan lewat pergerakan `pembatalan` (bukan menghapus pergerakan lama).
- Uang dikembalikan lewat mutasi kas `keluar` dengan `refType: 'sale_cancel'`.
- Alasan pembatalan wajib (minimal 3 karakter) dan tersimpan di nota serta audit log.
- Pembatalan ganda ditolak ("Penjualan ini sudah dibatalkan").

### Pengeluaran (`/pengeluaran`)

1. **Daftar pengeluaran** dengan filter bulan, kategori, dan pencarian keterangan; total
   pengeluaran aktif ditampilkan.
2. **Catat pengeluaran**: tanggal, nominal, kategori, akun kas sumber dana, keterangan, catatan.
3. **Kas keluar otomatis** dengan `refType: 'expense'`.
4. **Kategori pengeluaran baru** dapat ditambahkan langsung dari formulir (nama unik, audit log).
5. **Pembatalan pengeluaran** menandai status `dibatalkan` dan mencatat kas masuk pembalik
   (`expense_cancel`), bukan menghapus catatan.

### Pelanggan (`/pelanggan`) dan Pemasok (`/pemasok`)

Keduanya memakai satu komponen `ContactsPage` dengan dua jenis data:

| Aspek | Pelanggan | Pemasok |
|---|---|---|
| Tabel | `customers` | `suppliers` |
| Dipakai di | formulir penjualan, filter daftar nota | formulir barang masuk (Persediaan) |
| Kolom ringkasan | jumlah nota & total belanja (nota aktif) | jumlah barang masuk & nilai pembelian |
| Kolom tabel data | `sales.customerId` | `stock_movements.supplierId` |

Fitur yang tersedia:

1. **Daftar kontak** dengan pencarian nama/telepon/email dan filter status aktif/nonaktif.
2. **Tambah/ubah kontak**: nama (wajib, unik), telepon, email, alamat, catatan.
3. **Nonaktifkan** kontak agar tidak muncul di pilihan transaksi baru; riwayatnya tetap utuh.
4. **Hapus permanen** hanya untuk kontak yang belum dipakai transaksi. Kontak yang sudah dipakai
   ditolak dengan pesan yang menyebut jumlah transaksinya.
5. **Pembuatan cepat dari transaksi**: tombol "Baru" pada formulir penjualan dan barang masuk
   membuka dialog kontak yang sama, lalu langsung memilih kontak yang baru dibuat.
6. **Audit log** mencatat tambah, ubah, aktif/nonaktif, dan hapus kontak.
7. Nama kontak **disalin ke nota/pergerakan stok** (`customerName`, `supplierName`) agar riwayat
   lama tidak berubah bila kontak kelak diganti namanya.

### Aturan data yang diterapkan

- Semua operasi menulis header, detail, stok, kas, dan audit log dalam **satu transaksi Dexie**.
- Uang tetap integer rupiah; kuantitas 2 angka desimal.
- Satu produk hanya boleh muncul satu kali per nota (mencegah baris ganda yang membingungkan).
- Diskon baris maupun diskon nota tidak boleh melebihi subtotal.
- Akun kas dan kategori wajib dipilih; akun atau kategori yang hilang ditolak dengan pesan.
- Pelanggan/pemasok nonaktif ditolak saat dipakai pada transaksi baru.
- Pembatalan selalu memakai transaksi pembalik; tidak ada penghapusan riwayat penjualan,
  pengeluaran, mutasi kas, atau pergerakan stok.
- Tidak ada perubahan skema: seluruh tabel (`sales`, `sale_items`, `expenses`,
  `cash_transactions`, `stock_movements`, `customers`, `suppliers`) sudah ada sejak v1.
- Dashboard dan laporan memakai data yang sama: omzet, HPP, laba kotor, pengeluaran, saldo kas,
  dan transaksi terbaru langsung terisi.

## Langkah pengujian manual

### A. Penjualan mengurangi stok dan menambah kas

1. Buat produk barang dengan stok 20 dan HPP 13.000, harga jual 20.000.
2. Buka **Penjualan** → **Transaksi baru**, pilih produk, jumlah 2, simpan.
3. Hasil: nota `INV-...-001`, total Rp40.000; stok produk menjadi 18; kartu stok mencatat
   "Penjualan -2"; saldo kas bertambah Rp40.000; dashboard omzet dan laba kotor terisi.
4. Coba jual jumlah melebihi stok. Hasil: ditolak dengan pesan stok tersedia; stok dan kas
   tidak berubah.

### B. Pembatalan aman

1. Batalkan nota pada langkah A dengan alasan "salah input".
2. Hasil: status nota "Dibatalkan", alasan tampil di detail; stok kembali 20; kartu stok
   mencatat "Pembatalan penjualan +2"; kas berkurang Rp40.000; nota dan item tetap ada.
3. Coba batalkan lagi. Hasil: ditolak.

### C. Pengeluaran

1. Buka **Pengeluaran** → **Catat pengeluaran**, isi sewa Rp50.000 dari Kas Tunai.
2. Hasil: daftar menampilkan catatan, total pengeluaran bertambah, saldo kas berkurang.
3. Batalkan pengeluaran dengan alasan. Hasil: status "Dibatalkan", saldo kas kembali, catatan
   tetap ada.

### D. Pelanggan terhubung ke nota

1. Buka **Pelanggan** → **Tambah pelanggan**, isi nama "Bu Sari" dan nomor telepon, simpan.
2. Hasil: pelanggan tampil di daftar dengan status Aktif dan kolom Nota 0.
3. Buka **Penjualan** → **Transaksi baru**; pilihan pelanggan memuat "Bu Sari".
   Tombol **Baru** di sebelahnya membuka dialog pelanggan yang sama dan hasilnya langsung terpilih.
4. Simpan nota. Hasil: daftar pelanggan menampilkan Nota 1 dan Total belanja sebesar total nota;
   detail nota menampilkan nama pelanggan.
5. Coba hapus pelanggan tersebut. Hasil: ditolak karena sudah dipakai nota.

### E. Pemasok terhubung ke barang masuk

1. Buka **Pemasok** → **Tambah pemasok**, isi "Toko Beras", simpan.
2. Buka **Persediaan** → **Barang masuk**; pilihan pemasok memuat "Toko Beras".
3. Catat barang masuk 2 pcs dengan harga beli 12.000. Hasil: stok bertambah 2; kartu stok
   menampilkan nama pemasok; daftar pemasok menampilkan Barang masuk 1 dan Nilai pembelian
   Rp24.000.
4. Coba hapus pemasok tersebut. Hasil: ditolak karena sudah dipakai pergerakan stok.

## Hasil pengujian

### Pengujian awal (18 November 2026, penjualan/pengeluaran)

| Skenario | Hasil |
|---|---|
| Aktivasi mode pengembangan | Dashboard terbuka, banner mode pengembangan tampil |
| Produk uji stok 20, HPP 13.000, harga 20.000 | Tersimpan, SKU PRD-0001, margin 35% |
| Penjualan 2 x 20.000 | Nota INV-20261118-001 total Rp40.000; stok 20 -> 18; kas 0 -> 40.000; laba kotor 14.000 |
| Jual 100 unit (melebihi stok 20) | Ditolak: "Stok Ayam Geprek Uji tidak cukup. Tersedia 20, diminta 100."; tidak ada nota baru; stok dan kas tetap |
| Pembatalan nota | Status Dibatalkan; stok 18 -> 20; kas 40.000 -> 0; alasan tersimpan |
| Kartu stok | Awal 20, penjualan -2 (saldo 18), pembatalan +2 (saldo 20); total masuk 22, keluar 2 |
| Pengeluaran Rp50.000 | Tercatat; kas -50.000; total pengeluaran 50.000 |
| Pembatalan pengeluaran | Status Dibatalkan; kas kembali 0; total pengeluaran 0 |
| Penjualan aktif Rp20.000 + pengeluaran Rp10.000 | Dashboard: omzet 20.000, HPP 13.000, laba kotor 7.000, pengeluaran 10.000, laba bersih -3.000, kas 10.000; transaksi terbaru menandai "(dibatalkan)" |

Bug yang ditemukan dan diperbaiki saat pengujian awal:

1. **Pengeluaran yang dibatalkan ikut dihitung di dashboard.** Ringkasan menampilkan Rp60.000
   (50.000 batal + 10.000 aktif); seharusnya Rp10.000. `summarizeExpenses`, grafik periode, dan
   transaksi terbaru kini mengabaikan pengeluaran berstatus `dibatalkan` dan menandainya di
   daftar aktivitas.

### Pengujian pembangunan ulang (18 November 2026, pelanggan & pemasok)

| Skenario | Hasil |
|---|---|
| Tambah pelanggan "Bu Sari Uji" + telepon | Tersimpan; audit log "Menambahkan pelanggan Bu Sari Uji"; status Aktif |
| Pilihan pelanggan di `Penjualan > Transaksi baru` | Berisi "Pelanggan umum" dan "Bu Sari Uji"; tombol Baru membuka dialog kontak |
| Penjualan jasa Rp50.000 untuk Bu Sari Uji | Nota INV-20261118-001 tersimpan dengan `customerId` pelanggan, `customerName` tersalin; kas masuk Rp50.000 |
| Daftar pelanggan setelah nota | Nota 1, Total belanja Rp50.000 |
| Hapus pelanggan yang belum dipakai transaksi | Berhasil; baris hilang dari daftar dan audit log mencatat "Menghapus pelanggan ..." |
| Hapus pelanggan yang sudah dipakai nota | Ditolak dengan pesan jumlah nota; data pelanggan tetap ada |
| Tambah pemasok "Toko Beras Uji" | Tersimpan; audit log "Menambahkan pemasok Toko Beras Uji" |
| Pilihan pemasok di `Persediaan > Barang masuk` | Berisi "Tanpa pemasok" dan "Toko Beras Uji" |
| Barang masuk 2 pcs harga beli Rp12.000 | Stok Beras Uji 15 -> 17; pergerakan menyimpan `supplierId`, nama pemasok, dan harga beli |
| Daftar pemasok setelah barang masuk | Barang masuk 1, Nilai pembelian Rp24.000 |
| Hapus pemasok yang sudah dipakai | Ditolak; data pemasok tetap ada |
| Data uji dibersihkan | semua tabel transaksi/kontak/audit kembali 0 baris |

Bug yang ditemukan dan diperbaiki saat pengujian ulang:

1. **`supplierId` hilang dari payload barang masuk.** Skema Zod `stockMovementSchema` membuang
   kunci yang tidak dideklarasikan, sehingga pergerakan stok menyimpan nama pemasok kosong.
   Kunci `supplierId` ditambahkan ke skema dan tautan pemasok kini tersimpan.
2. **Rantai validasi email kontak salah urutan.** `.refine()` diikuti `.max()` membuat modul
   validasi gagal dimuat di browser. `.max()` dipindah sebelum `.refine()`.
3. **Hapus kontak kosong gagal karena tabel pemeriksaan tidak dibuka.** `deleteContact` membaca
   `sales` dan `stock_movements` di dalam transaksi yang hanya membuka tabel kontak dan audit log,
   sehingga Dexie melempar `NotFoundError` bahkan untuk kontak yang belum dipakai. Kedua tabel
   kini ikut dibuka di transaksi yang sama.
4. **Sisa `supplierName` pada formulir barang masuk.** Setelah pemasok dipilih lewat daftar,
   field teks lama dihapus dari state, payload, dan skema validasi; nama pemasok tetap disalin ke
   pergerakan stok sebagai arsip.

Penyederhanaan setelah tinjauan ulang:

- Pemeriksaan pemakaian kontak disatukan lewat konfigurasi (`usageTable`, `usageField`,
  `usageLabel`), sehingga hapus pelanggan dan pemasok memakai satu jalur kode dan hanya membuka
  tabel yang benar-benar diperiksa.
- Pemeriksaan nama ganda dipakai bersama oleh tambah dan ubah kontak.
- Parameter `status` pada `listContacts` dan fungsi `getContact` yang tidak dipakai dihapus;
  penyaringan status dilakukan di halaman.
- Halaman kontak memakai satu state dialog (`undefined` tertutup, `null` baru, objek = ubah) dan
  konfigurasi tanpa label ganda; dialog kontak memakai satu label untuk semua teks.

## Batasan yang disadari

1. **Belum ada penjualan kredit/piutang**; semua nota dianggap dibayar penuh ke akun kas.
2. **Pelanggan/pemasok belum punya saldo, piutang, utang, atau limit kredit**; hanya data kontak
   dan rekap transaksi.
3. **Pemasok belum terhubung ke pembelian tunai** di luar pergerakan stok (belum ada modul
   pembelian dengan nomor nota pembelian).
4. **Belum ada pengelolaan akun kas** (Tahap 5); akun "Kas Tunai" berasal dari data awal.
5. **Belum ada cetak/struk** dan ekspor nota.
6. **Belum ada nomor nota yang dapat diubah** atau seri faktur pajak.
7. Pembatalan memakai tanggal hari ini untuk mutasi pembalik, bukan tanggal nota asli.
8. Belum ada penguncian antartab; Dexie menyerialkan transaksi tulis, tetapi dua tab yang
   menekan simpan bersamaan tetap perlu diuji terpisah.
9. Grafik/dashboard memakai tanggal transaksi pembalik (hari ini), bukan tanggal nota asli,
   sehingga pembatalan nota lama terlihat pada periode berjalan.
