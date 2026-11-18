# Catatan Tahap 3 - Kalkulator HPP

## Tujuan tahap

Menyediakan cara menghitung HPP (harga pokok penjualan) per unit dari komponen biaya nyata,
menyimpan setiap perhitungan sebagai riwayat yang dapat diaudit, dan menerapkan hasilnya ke
produk. Modul ini menjadi dasar harga jual dan laba kotor pada Tahap 4 (penjualan).

## Yang sudah berfungsi

### Kalkulator HPP (`/hpp`)

1. **Pilih produk** yang akan dihitung, jenis usaha (mengikuti jenis pada profil usaha),
   tanggal berlaku HPP, dan **jumlah unit per batch**.
2. **Komponen biaya** per baris: jenis (bahan baku, tenaga kerja, overhead, lainnya), nama,
   jumlah, satuan, dan harga satuan. Subtotal dihitung otomatis (jumlah x harga satuan) dan
   total batch ditampilkan di bawah tabel.
3. **Isi cepat harga beli**: satu tombol menambahkan komponen "Harga beli produk" (atau
   "Biaya dasar jasa") dari data produk, sehingga usaha perdagangan tidak perlu mengetik ulang.
4. **HPP per unit** = total biaya batch dibagi jumlah unit, dibulatkan ke rupiah terdekat.
5. **Simulasi harga jual & margin**: harga jual simulasi (tidak mengubah produk), margin kotor,
   markup, laba per unit, serta **harga jual rekomendasi** untuk target margin yang diisi.
   Tombol "Pakai harga rekomendasi" mengisi harga simulasi.
6. **Perbandingan HPP**: HPP produk saat ini, HPP hasil perhitungan, selisih (naik/turun), dan
   peringatan bila harga jual simulasi lebih rendah dari HPP.
7. **Simpan perhitungan** ke tabel `product_costs` beserta `cost_components`. Opsi
   "Terapkan HPP ke produk" (bawaan aktif) memperbarui `products.hpp` dan menambah baris
   riwayat harga dengan sumber `hpp_calculator`. Bila HPP tidak berubah, riwayat harga tidak
   ditambah agar tidak ada catatan palsu.

### Riwayat HPP (tab pada halaman yang sama)

1. Daftar seluruh perhitungan: tanggal berlaku, produk, jenis usaha, jumlah unit batch, total
   biaya, HPP per unit, harga jual simulasi, margin, dan status diterapkan.
2. Filter per produk.
3. **Detail perhitungan**: seluruh komponen beserta subtotal, total, HPP lama vs baru, catatan,
   dan waktu pencatatan.
4. Riwayat **tidak dapat diubah atau dihapus**; koreksi dilakukan dengan perhitungan baru.
   Produk yang dihapus permanen (hanya boleh bila belum ada transaksi) ikut membersihkan
   `product_costs` dan `cost_components` miliknya dalam transaksi yang sama.

### Aturan data yang diterapkan

- Semua uang integer rupiah; kuantitas mendukung 2 angka desimal (kg/liter).
- Validasi Zod: produk wajib dipilih, jumlah unit > 0, minimal satu komponen, nama komponen
  wajib, nominal dan target margin dalam batas wajar (target < 100%).
- Penyimpanan perhitungan, komponen, pembaruan HPP produk, riwayat harga, dan audit log
  berjalan dalam **satu transaksi Dexie**, sehingga tidak ada HPP produk yang berubah tanpa
  catatan.
- Audit log mencatat `hpp_calculate` dan, bila HPP produk berubah, `price_change`.
- Tidak ada versi skema baru: `product_costs` dan `cost_components` sudah ada sejak v1, jadi
  data pengguna tidak dimigrasi ulang.

## Langkah pengujian manual

### A. Perhitungan dasar

1. Buka **Kalkulator HPP** (menu Operasional).
2. Pilih produk barang, jenis usaha terisi otomatis dari profil (mis. Makanan dan Minuman),
   jumlah unit per batch 10.
3. Tambah komponen: Bahan baku "Ayam fillet" 2 kg x Rp35.000; Tenaga kerja "Persiapan" 1 x
   Rp20.000; Overhead "Gas dan listrik" 1 x Rp15.000.
   Hasil: subtotal 70.000 + 20.000 + 15.000; total batch Rp105.000; HPP per unit Rp10.500.
4. Isi harga jual 15.000. Hasil: margin 30%, markup 42,9%, laba per unit Rp4.500.
5. Isi target margin 40%. Hasil: harga rekomendasi Rp17.500. Klik "Pakai harga rekomendasi",
   harga simulasi berubah menjadi 17.500.
6. Simpan dengan opsi "Terapkan HPP ke produk" aktif.
   Hasil: toast sukses; HPP produk menjadi Rp10.500; detail produk menampilkan riwayat harga
   "HPP dari kalkulator Rp... -> Rp10.500".

### B. Validasi

1. Simpan tanpa memilih produk. Hasil: "Pilih produk", data tidak tersimpan.
2. Hapus seluruh komponen (atau kosongkan nama). Hasil: "Tambahkan minimal satu komponen
   biaya", tidak tersimpan.
3. Isi jumlah unit 0. Hasil: "Jumlah unit per batch harus lebih dari 0".
4. Isi target margin 100. Hasil: "Target margin harus di bawah 100%".

### C. Riwayat

1. Buka tab **Riwayat HPP**. Hasil: perhitungan tadi muncul paling atas dengan status
   "Diterapkan: Ya".
2. Klik ikon mata. Hasil: dialog menampilkan komponen, total, HPP lama vs baru, dan catatan.
3. Filter produk lain yang belum pernah dihitung. Hasil: pesan kosong yang sesuai, bukan tabel
   kosong tanpa penjelasan.
4. Hitung ulang produk yang sama tanpa mencentang "Terapkan HPP ke produk", lalu simpan.
   Hasil: riwayat bertambah dengan status "Tidak", HPP produk tidak berubah, riwayat harga
   produk tidak bertambah.

### D. Integrasi produk

1. Hapus produk yang hanya punya stok awal dan sudah memiliki riwayat HPP.
   Hasil: produk terhapus dan perhitungan HPP-nya tidak tersisa sebagai data yatim
   (periksa tab Riwayat HPP).
2. Buka menu Produk dan lihat kolom HPP/margin produk setelah penerapan HPP.
   Hasil: angka sesuai hasil kalkulator, margin dihitung ulang dari harga jual produk.

## Pemeriksaan otomatis

- `npm run build` (Vite) harus berhasil.
- Fungsi murni di `src/utils/hpp.js` diperiksa terpisah: penjumlahan komponen per jenis,
  HPP per unit dengan pembulatan, margin, markup, dan harga rekomendasi.

## Batasan yang disadari

1. **HPP belum otomatis** terpakai pada penjualan; Tahap 4 akan membekukan HPP pada item
   penjualan.
2. **Tidak ada konversi satuan** (kg ke gram); jumlah dan satuan masih label bebas.
3. **Harga beli pada barang masuk belum otomatis** menjadi komponen; tombol isi cepat memakai
   harga beli produk saat ini.
4. **Tidak ada template resep/BOM** yang dapat dipakai ulang antarbatch; setiap perhitungan
   diisi ulang atau dicatat dari riwayat.
5. **Komponen perhitungan tidak dapat diubah** setelah disimpan; koreksi dengan perhitungan
   baru agar riwayat tetap dapat diaudit.
6. Perhitungan HPP tidak memengaruhi stok; stok tetap hanya berubah lewat menu Persediaan.
