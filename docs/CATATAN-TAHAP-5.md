# Catatan Tahap 5 - Backup Tervalidasi, Pemeriksaan Data, Kas, dan Laporan

## Tujuan tahap

Menutup dua kebutuhan yang saling terkait:

1. **Perlindungan data**: cadangan tervalidasi, pemulihan yang aman, dan pemeriksaan konsistensi
   sebelum data dipakai untuk keputusan.
2. **Keuangan & laporan**: akun kas, transfer antarakun, riwayat mutasi, serta 9 laporan dengan
   ekspor Excel/PDF.

Backup dan pemeriksaan dikerjakan lebih dulu, diuji, baru modul kas dan laporan dibangun di atas
data yang sudah terlindungi.

## 1. Backup, pemulihan, dan pemeriksaan konsistensi

### Format cadangan

- Satu berkas JSON berisi seluruh tabel data usaha (21 tabel, termasuk `settings`).
- Metadata: `format: 'umkm-smart-backup'`, versi format, versi aplikasi, versi skema, waktu dibuat,
  jumlah baris per tabel, dan **checksum SHA-256** dari isi tabel.
- Pengaturan perangkat (`license.*`, `app.installedAt`) tidak diekspor dan tidak ditimpa saat
  pemulihan, sehingga lisensi perangkat tetap berlaku.
- Berkas **tidak dienkripsi**. Berkas berisi data usaha; simpan di tempat aman dan jangan
  dibagikan. Aplikasi tidak mengklaim enkripsi.

### Validasi sebelum pemulihan

Berkas ditolak bila:

- bukan JSON valid atau bukan cadangan UMKM SMART;
- versi format tidak didukung;
- ada tabel data yang hilang;
- jumlah baris tidak cocok dengan catatan cadangan;
- checksum tidak cocok (berkas rusak atau diubah);
- cadangan dibuat aplikasi dengan skema lebih baru.

Pemulihan hanya berjalan setelah pengguna mengetik **PULIHKAN**. Sebelum menimpa data, aplikasi
otomatis membuat cadangan “sebelum pemulihan” di perangkat. Seluruh tabel ditimpa dalam satu
transaksi Dexie, lalu audit log mencatat pemulihan. Cadangan lokal menyimpan maksimal 2 berkas
terbaru (tanpa enkripsi, di IndexedDB perangkat).

### Pemeriksaan konsistensi (hanya membaca)

Sembilan kelompok pemeriksaan:

1. stok negatif;
2. stok produk vs saldo akhir kartu stok;
3. aritmetika `balanceBefore + change = balanceAfter` setiap pergerakan stok;
4. total nota vs jumlah item (subtotal, diskon, total, HPP);
5. kas penjualan vs nota dan pembaliknya;
6. kas pengeluaran vs catatan dan pembaliknya;
7. data yatim (item tanpa nota, stok tanpa produk, kas tanpa akun, komponen tanpa perhitungan);
8. nomor nota ganda dan SKU ganda;
9. HPP per unit/total vs jumlah komponen biaya.

Hasil ditampilkan sebagai error/peringatan beserta contoh data. Pemeriksaan tidak memperbaiki data
otomatis; pengguna memutuskan sendiri.

### Hasil pengujian backup/restore (18 November 2026)

| Skenario | Hasil |
|---|---|
| Data uji: 1 produk (stok 18), 1 nota Rp40.000, 1 pengeluaran Rp50.000 | Pemeriksaan konsistensi: 0 error, 0 peringatan |
| Unduh cadangan | Berkas 32 baris, 8,2 KB; cadangan lokal “Unduhan manual” terbentuk |
| Simulasi kehilangan data (tabel usaha dikosongkan) | Produk/nota/pengeluaran/kas menjadi 0; cadangan lokal tetap ada |
| Pulihkan dari cadangan lokal lewat UI (konfirmasi PULIHKAN) | Stok 18, nota Rp40.000, pengeluaran Rp50.000, kas -Rp10.000 kembali; cadangan otomatis “sebelum pemulihan” (20 baris) dibuat |
| Pemeriksaan konsistensi setelah pulih | 0 error, 0 peringatan |
| Unggah berkas yang diubah tanpa memperbarui checksum | Ditolak: “Checksum cadangan tidak cocok. Berkas mungkin rusak atau diubah.” |

## 2. Kas & rekening (`/kas`)

- **Akun kas**: tunai, rekening bank, e-wallet; nama unik; saldo awal; catatan; aktif/nonaktif.
- **Saldo** dihitung dari saldo awal + seluruh mutasi akun (bukan saldo tersimpan yang bisa
  menyimpang).
- **Ubah akun**: nama, jenis, saldo awal, catatan. Perubahan saldo awal menggeser saldo dan dicatat
  di audit log; riwayat mutasi tidak diubah.
- **Nonaktifkan akun** hanya boleh jika saldo nol dan masih ada akun aktif lain. Akun tidak
  dihapus agar riwayat tetap utuh; akun dapat diaktifkan kembali.
- **Transfer antarakun** menulis dua mutasi dalam satu transaksi: keluar dari akun asal dan masuk ke
  akun tujuan, dengan `refType: 'transfer'` dan `refId` yang sama. Transfer bukan pendapatan atau
  biaya. Saldo akun asal tidak boleh negatif karena transfer.
- **Mutasi kas**: filter bulan, akun, dan jenis (masuk/keluar), dengan total masuk, keluar, dan
  selisih. Sumber mutasi: penjualan, pembatalan, pengeluaran, pembatalan pengeluaran, transfer.
- Saldo kas boleh negatif akibat penjualan/pengeluaran (bukan transfer); nilai ditampilkan apa
  adanya agar masalah data terlihat.

### Hasil pengujian kas

| Skenario | Hasil |
|---|---|
| Tambah “Bank Uji” (bank, saldo awal Rp100.000) | Akun aktif; total saldo Rp90.000 (bank 100.000 + kas -10.000) |
| Transfer Rp50.000 dari Bank Uji ke Kas Tunai | Bank Rp50.000; Kas Tunai Rp40.000; total tetap Rp90.000; 2 mutasi transfer tercatat |
| Transfer Rp60.000 dari Bank Uji (saldo Rp50.000) | Ditolak: “Saldo Bank Uji tidak cukup. Tersedia Rp50000, diminta Rp60000.”; tidak ada mutasi baru |
| Nonaktifkan Bank Uji yang bersaldo Rp50.000 | Ditolak: “Saldo Bank Uji masih Rp50000. Pindahkan saldonya lewat transfer…” |
| Daftar mutasi | 4 mutasi bulan ini: penjualan +40.000, pengeluaran -50.000, transfer keluar -50.000, transfer masuk +50.000; total masuk 90.000, keluar 100.000 |

## 3. Laporan usaha (`/laporan`)

Sembilan laporan, semua dihitung lokal dari data pada periode yang dipilih (hari ini, minggu,
bulan, tahun, atau rentang khusus):

1. **Laba rugi**: omzet, diskon, HPP, laba kotor, biaya operasional per kategori, laba bersih.
2. **Penjualan**: daftar nota, pelanggan, metode, qty, total, status.
3. **Pengeluaran**: kategori, keterangan, akun kas, nominal, status.
4. **Arus kas**: seluruh mutasi kas periode dengan kolom masuk/keluar dan arus kas bersih.
5. **Saldo akun kas**: saldo awal, masuk/keluar periode, saldo akhir per akun.
6. **Persediaan**: stok, satuan, HPP/unit, nilai stok, status menipis.
7. **Riwayat HPP**: perhitungan HPP per produk, harga jual, margin, target margin.
8. **Produk terlaris**: qty, omzet, HPP, laba kotor per produk.
9. **Mutasi stok**: kartu stok gabungan seluruh produk pada periode.

Setiap laporan dapat diunduh sebagai **Excel (.xlsx)** atau **PDF**. Pustaka `xlsx`, `jspdf`, dan
`jspdf-autotable` dimuat dinamis sehingga tidak memperbesar muatan awal aplikasi. Laporan tidak
mengirim data ke internet.

### Hasil pengujian laporan

| Skenario | Hasil |
|---|---|
| Laba rugi bulan ini | Omzet Rp40.000; HPP Rp26.000; laba kotor Rp14.000 (margin 35%); biaya Sewa Rp50.000; laba bersih -Rp36.000 |
| Penjualan | 1 nota INV-20261118-001, Pelanggan umum, tunai, qty 2, Rp40.000, selesai |
| Pengeluaran | 1 catatan Sewa Rp50.000 dari Kas Tunai |
| Arus kas | 4 mutasi: penjualan masuk, pengeluaran keluar, transfer keluar, transfer masuk |
| Saldo akun kas | Bank Uji: awal 100.000, keluar 50.000, akhir 50.000; Kas Tunai: masuk 90.000, keluar 50.000, akhir 40.000 |
| Persediaan | Ayam Geprek Uji, stok 18 pcs, HPP Rp13.000, nilai Rp234.000, status aman |
| Riwayat HPP | Empty state benar (belum ada perhitungan HPP pada data uji ini) |
| Produk terlaris | Ayam Geprek Uji, qty 2, omzet 40.000, HPP 26.000, laba 14.000 |
| Mutasi stok | Stok awal +20, penjualan -2, saldo akhir 18 |
| Ekspor Excel | Berkas terunduh; toast “Laporan Excel diunduh.” |
| Ekspor PDF | Berkas terunduh; toast “Laporan PDF diunduh.” |

## Bug yang ditemukan dan diperbaiki

1. **Judul laporan kosong pada ekspor PDF.** `buildReport` memakai `label`, sedangkan ekspor membaca
   `title`, sehingga `jsPDF.text` menerima `undefined` (“Invalid arguments passed to jsPDF.text”).
   Halaman laporan dan kedua ekspor kini memakai fallback `title ?? label`.
2. **Total omzet produk terlaris** sempat dihitung dengan mencocokkan indeks baris yang sudah
   diurutkan ke map yang belum diurutkan. Kini total dihitung dari nilai agregat sebelum diformat.

## Batasan yang disadari

1. **Backup tidak dienkripsi** dan berisi seluruh data usaha; berkas harus disimpan aman.
2. **Pemulihan bersifat mengganti seluruh data**, bukan menggabungkan; cadangan otomatis sebelum
   pemulihan hanya menyimpan 2 berkas terbaru.
3. **Belum ada backup terjadwal/otomatis** dan belum ada PWA/offline (Tahap 7).
4. Akun kas **tidak dapat dihapus**, hanya dinonaktifkan; akun dengan saldo harus dikosongkan lewat
   transfer terlebih dahulu.
5. **Belum ada mutasi kas manual** (setor/tarik tunai di luar penjualan/pengeluaran/transfer).
6. Laporan memakai **angka terformat** (string) agar tampilan dan ekspor konsisten; analisis numerik
   lanjutan dilakukan di Excel.
7. Pelanggan dan pemasok masih belum aktif; nota memakai nama pelanggan teks bebas.
8. Saldo kas masih dapat negatif akibat penjualan/pengeluaran; aplikasi menampilkannya apa adanya.
9. Laporan HPP kosong jika belum ada perhitungan HPP pada periode tersebut; ini bukan error.

## Langkah berikutnya

Tahap 6 (SMART ADVISOR) memakai ringkasan dari laporan dan perhitungan yang sudah ada, dengan
persetujuan pengguna sebelum data dikirim ke proxy AI. PWA, backup terjadwal, dan finalisasi lisensi
tetap menjadi pekerjaan Tahap 7-8.
