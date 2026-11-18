# Catatan Tahap 4 - Penjualan, Pembatalan, dan Pengeluaran

## Tujuan tahap

Menutup alur uang inti: penjualan mengurangi stok dan menambah kas, pembatalan mengembalikan
keduanya lewat transaksi pembalik, dan pengeluaran mengurangi kas. Setelah tahap ini dashboard,
kartu stok, dan laporan memiliki data nyata.

## Yang sudah berfungsi

### Penjualan (`/penjualan`)

1. **Daftar nota** dengan filter bulan, status (selesai/dibatalkan), dan pencarian nomor nota
   atau pelanggan.
2. **Transaksi baru** (`/penjualan/baru`): tanggal, pelanggan (opsional), metode pembayaran,
   akun kas penerima, baris produk (jumlah, harga jual, diskon baris), diskon nota, dan catatan.
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

### Aturan data yang diterapkan

- Semua operasi menulis header, detail, stok, kas, dan audit log dalam **satu transaksi Dexie**.
- Uang tetap integer rupiah; kuantitas 2 angka desimal.
- Satu produk hanya boleh muncul satu kali per nota (mencegah baris ganda yang membingungkan).
- Diskon baris maupun diskon nota tidak boleh melebihi subtotal.
- Akun kas dan kategori wajib dipilih; akun atau kategori yang hilang ditolak dengan pesan.
- Pembatalan selalu memakai transaksi pembalik; tidak ada penghapusan riwayat penjualan,
  pengeluaran, mutasi kas, atau pergerakan stok.
- Tidak ada perubahan skema: seluruh tabel (`sales`, `sale_items`, `expenses`,
  `cash_transactions`, `stock_movements`) sudah ada sejak v1.
- Dashboard memakai data yang sama: omzet, HPP, laba kotor, pengeluaran, saldo kas, dan
  transaksi terbaru langsung terisi.

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

### D. Integrasi dashboard

- Omzet, HPP, laba kotor, pengeluaran, saldo kas, transaksi terbaru, dan kartu stok harus
  konsisten dengan transaksi yang baru dicatat dan dibatalkan.

## Hasil pengujian

Pengujian browser nyata (18 November 2026, Vite dev server + IndexedDB):

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

Bug yang ditemukan dan diperbaiki saat pengujian:

1. **Pengeluaran yang dibatalkan ikut dihitung di dashboard.** Ringkasan menampilkan Rp60.000
   (50.000 batal + 10.000 aktif); seharusnya Rp10.000. `summarizeExpenses`, grafik periode, dan
   transaksi terbaru kini mengabaikan pengeluaran berstatus `dibatalkan` dan menandainya di
   daftar aktivitas.

Catatan: data uji dihapus dari browser setelah pengujian agar tidak tampil sebagai transaksi nyata.

## Batasan yang disadari

1. **Pelanggan dan pemasok** masih berupa halaman "belum aktif"; nota memakai nama pelanggan
   teks bebas, belum terhubung ke tabel `customers`.
2. **Belum ada penjualan kredit/piutang**; semua nota dianggap dibayar penuh ke akun kas.
3. **Belum ada pengelolaan akun kas** (Tahap 5); akun "Kas Tunai" berasal dari data awal.
4. **Belum ada cetak/struk** dan ekspor nota.
5. **Belum ada nomor nota yang dapat diubah** atau seri faktur pajak.
6. Pembatalan memakai tanggal hari ini untuk mutasi pembalik, bukan tanggal nota asli.
7. Belum ada penguncian antartab; Dexie menyerialkan transaksi tulis, tetapi dua tab yang
   menekan simpan bersamaan tetap perlu diuji terpisah.
8. **Saldo kas dapat menjadi negatif** karena saldo awal akun kas baru dapat diatur pada
   Tahap 5. Saldo negatif ditampilkan apa adanya agar tidak menyembunyikan masalah data.
9. Grafik/dashboard memakai tanggal transaksi pembalik (hari ini), bukan tanggal nota asli,
   sehingga pembatalan nota lama terlihat pada periode berjalan.
