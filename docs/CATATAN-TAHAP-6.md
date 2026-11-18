# Catatan Tahap 6 - SMART ADVISOR

## Tujuan tahap

Memberi pemilik usaha jalan pintas dari angka laporan ke keputusan: bertanya dalam bahasa sehari-hari,
menerima analisis yang terstruktur, dan mencoba simulasi keputusan tanpa mengirim database ke mana pun.

Dua aturan yang dijaga sepanjang tahap ini:

1. **Angka dihitung aplikasi, bukan AI.** Ringkasan disusun dari data lokal memakai fungsi keuangan
   yang sama dengan dashboard dan laporan.
2. **Pengguna menyetujui setiap kiriman.** Tidak ada permintaan jaringan sebelum pratinjau lengkap
   ditampilkan dan pengguna menyatakan setuju.

## 1. Ringkasan kontekstual

`src/services/ai/advisorContext.js`

- Membaca hanya tabel yang dibutuhkan: profil, penjualan, item, pengeluaran, akun kas, mutasi kas,
  produk, satuan, dan kategori pengeluaran.
- Menghitung periode terpilih (hari ini, minggu, bulan, tahun, rentang khusus) memakai
  `buildProfitSummary`, `computeCashBalances`, dan `findLowStockProducts`.
- Isi ringkasan: omzet, HPP, laba kotor, margin, biaya operasional, estimasi laba bersih, rata-rata
  nota, biaya per kategori teratas, 5 produk teratas, stok di bawah minimum, 3 margin terendah, saldo
  tiap akun kas, dan nilai persediaan.
- **Fokus pertanyaan** ditebak dari kata kunci (penjualan, laba, HPP, stok, biaya, kas) untuk memberi
  konteks pada model. Ini klasifikasi lokal sederhana, bukan model bahasa.
- Panjang ringkasan ±900-1.100 karakter, jauh di bawah batas yang membuat kiriman mahal.
- **Tidak pernah disertakan**: nama/telepon/email pelanggan atau pemasok, alamat dan kontak profil,
  token lisensi, ID perangkat, kunci API, serta isi tabel mentah.

## 2. Persetujuan sebelum kirim

`src/pages/advisor/AdvisorConsentDialog.jsx`

Setiap pertanyaan melewati dialog yang menampilkan:

- pertanyaan yang akan dikirim dan penyedia/model tujuan;
- daftar bagian ringkasan beserta jumlah datanya;
- daftar data yang tidak pernah dikirim;
- **pratinjau teks lengkap** yang akan dikirim, persis seperti isi permintaan.

Tombol **Setujui & kirim** nonaktif sampai kotak persetujuan dicentang. Menutup dialog atau menekan
Batal tidak menyimpan pesan dan tidak mengirim apa pun. Persetujuan berlaku untuk satu kiriman; tidak
ada "jangan tanya lagi".

Bila proxy belum diatur, dialog berubah menjadi konfirmasi analisis lokal: label tombol “Buat analisis
lokal”, tanpa permintaan jaringan, dengan penjelasan bahwa tidak ada data yang meninggalkan perangkat.

## 3. Adapter penyedia dan proxy

`src/services/ai/aiProvider.js`

- Penyedia yang tersedia: **OpenAI**, **Google Gemini**, dan **kompatibel OpenAI** (penyedia lain di
  balik proxy yang sama).
- Semua permintaan menuju **satu backend proxy**; aplikasi tidak menyimpan API key dan tidak memanggil
  penyedia secara langsung. Alamat proxy diambil dari `VITE_AI_PROXY_URL` atau diisi di panel
  “Koneksi AI” (disimpan di `settings`, hanya alamat publik).
- Batas waktu 45 detik, pesan kesalahan berbahasa Indonesia untuk 401/403, 429, 5xx, jawaban kosong,
  dan koneksi gagal.
- Model yang dipakai tercatat pada pesan jawaban agar riwayat dapat diaudit.

Kontrak proxy:

```
POST {proxyUrl}/advisor
Content-Type: application/json

{
  "provider": "openai" | "gemini" | "compatible",
  "model": "gpt-4o-mini",
  "messages": [{ "role": "system"|"user"|"assistant", "content": "..." }],
  "app": "umkm-smart",
  "promptVersion": 1
}

200 -> { "answer": "...", "model": "...", "usage": { ... } }
4xx/5xx -> { "message": "..." }
```

Proxy yang wajib disiapkan penerbit:

1. Menyimpan API key penyedia di server (environment/secret manager), bukan di repo atau frontend.
2. Membatasi asal permintaan (CORS) ke domain aplikasi.
3. Menerapkan kuota per pengguna/perangkat dan batas panjang pesan.
4. Tidak menyimpan data transaksi; log cukup berisi metadata (waktu, model, jumlah karakter).
5. Meneruskan `messages` apa adanya ke penyedia; instruksi sistem sudah dikirim aplikasi.

## 4. Instruksi dan bentuk jawaban

`src/services/ai/prompt.js`

Instruksi sistem meminta model: hanya memakai angka dari ringkasan, membedakan fakta/dugaan/
rekomendasi, menyebut data yang kurang, tidak menjanjikan hasil, tidak meminta data pribadi, dan
menjawab dalam bahasa Indonesia sederhana.

Bentuk jawaban yang diminta: **KONDISI USAHA**, **TEMUAN**, **REKOMENDASI** (maksimal 3), **LANGKAH
TINDAKAN**, **CATATAN**. Riwayat yang disertakan dibatasi 4 pesan terakhir dan 1.500 karakter per
pesan agar kiriman tetap kecil.

## 5. Analisis lokal tanpa AI

`src/services/ai/localAdvisor.js`

Dipakai saat proxy belum diatur. Analisis deterministik dari angka yang sama, selalu diberi label
“Analisis lokal · tanpa AI” pada pesan. Isinya: kondisi usaha, temuan berbasis ambang sederhana
(margin < 20-25%, biaya > laba kotor, kas negatif, stok minimum, ketergantungan satu produk), maksimal
3 rekomendasi, 3 langkah tindakan, dan catatan batas analisis. Ini bukan AI generatif dan aplikasi
tidak menyebutnya demikian.

## 6. Simulasi keputusan

`src/pages/advisor/DecisionSimulator.jsx`

Simulasi dihitung di perangkat dari laba rugi periode terpilih. Pengguna mengubah empat variabel
(persen): harga jual, jumlah terjual, HPP per unit, dan biaya operasional. Aplikasi menampilkan
perbandingan omzet, HPP, laba kotor, biaya, laba bersih, dan margin, beserta selisih laba bersih.

Rumus: omzet = omzet acuan × (1 + harga) × (1 + volume); HPP = HPP acuan × (1 + HPP) × (1 + volume);
biaya = biaya acuan × (1 + biaya operasional). Tidak ada data yang dikirim saat memakai simulasi.

## 7. Riwayat dan audit

- Percakapan dan pesan disimpan lokal di `advisor_conversations` dan `advisor_messages`; tidak ada
  sinkronisasi cloud.
- Percakapan dapat dibuka kembali atau dihapus (hapus = pesan ikut terhapus, dengan konfirmasi).
- Setiap kiriman eksternal menulis audit log `advisor_send`; analisis lokal menulis
  `advisor_local_analysis`. Metadata berisi mode, penyedia, model, fokus, periode, dan panjang
  ringkasan — bukan isi pertanyaan atau jawaban.

## 8. Hasil pengujian (18 November 2026)

### Impor berkas cadangan yang valid

Data uji dibuat lewat repositori aplikasi (produk “Kopi Uji Impor” stok 10, HPP Rp13.000; pengeluaran
Sewa Rp50.000), lalu cadangan dibuat dengan kode ekspor aplikasi.

| Langkah | Hasil |
|---|---|
| Berkas cadangan valid | 27 baris, 9.154 byte JSON, checksum SHA-256 64 karakter |
| Data uji dihapus sebelum impor | Produk 0, pengeluaran berstatus dibatalkan, kas 2 mutasi |
| Berkas dimasukkan lewat input berkas (jalur `handleFile` di halaman Backup) | “Berkas valid · umkm-smart-backup-uji.json · 27 baris data” |
| Pulihkan dengan konfirmasi PULIHKAN | Produk “Kopi Uji Impor” kembali, pengeluaran kembali berstatus selesai, 1 cadangan otomatis sebelum pemulihan dibuat |
| Toast | “Data berhasil dipulihkan dari cadangan.” + rincian 27 baris |
| Pemeriksaan konsistensi setelah pemulihan | 0 error, 0 peringatan; kas -Rp50.000 konsisten dengan pengeluaran |

### SMART ADVISOR

| Skenario | Hasil |
|---|---|
| Ringkasan bulan ini | 1.014 karakter; omzet Rp0, laba bersih -Rp50.000, stok menipis 0, margin terendah Kopi Uji Impor 35% |
| Batal pada dialog persetujuan | Tidak ada percakapan/pesan tersimpan; pertanyaan tetap di kotak isian |
| Analisis lokal (proxy kosong) | Jawaban 1.250 karakter tersimpan; badge “Analisis lokal · tanpa AI”; audit `advisor_local_analysis` |
| Pengaturan proxy `http://127.0.0.1:3100` | Tersimpan di `settings`; badge berubah “Proxy aktif” |
| Dialog dengan proxy aktif | “Ringkasan akan dikirim ke OpenAI (gpt-4o-mini)”; tombol kirim **nonaktif** sebelum kotak persetujuan dicentang, aktif sesudahnya |
| Kirim ke proxy uji | Proxy menerima `POST /advisor` 2.916 byte, provider `openai`, model `gpt-4o-mini`, 2 pesan, ringkasan terdeteksi; jawaban tersimpan dengan model `mock-model` |
| Riwayat | 2 percakapan; membuka percakapan menampilkan 2 pesan; pilihan percakapan bertahan saat berpindah tab |
| Simulasi | Acuan omzet Rp40.000, HPP Rp26.000, laba bersih -Rp36.000; harga +10% dan volume +20% → omzet Rp52.800, HPP Rp31.200, laba bersih -Rp28.400, margin 40,9%, selisih +Rp7.600 |
| Pembersihan data uji | Semua tabel uji 0 baris, pengaturan advisor dihapus, pemeriksaan konsistensi 0 error/0 peringatan |

## Batasan yang disadari

1. **Proxy AI belum disertakan.** Repo ini hanya berisi klien; tanpa proxy, fitur berjalan sebagai
   analisis lokal. Kontrak di atas harus diterapkan di server penerbit.
2. **Kualitas jawaban bergantung pada model dan proxy.** Struktur jawaban diminta lewat instruksi,
   bukan dijamin oleh kode; tampilan menerima teks apa adanya.
3. **Klasifikasi fokus pertanyaan sederhana** (kata kunci), bukan pemahaman bahasa.
4. **Ringkasan bersifat agregat.** Advisor tidak melihat detail per nota, nama pelanggan, atau catatan
   bebas, sehingga pertanyaan yang sangat spesifik bisa dijawab dengan “data belum cukup”.
5. **Analisis lokal memakai ambang tetap** (mis. margin 20-25%) sebagai penanda, bukan penilaian usaha
   yang sebenarnya.
6. **Simulasi mengasumsikan perubahan merata** pada seluruh produk dan tidak memodelkan reaksi
   pelanggan, pajak, atau musim.
7. Riwayat percakapan tersimpan lokal tanpa enkripsi, sama seperti data usaha lainnya.
8. Pesan yang gagal dikirim tidak disimpan; pengguna harus mengirim ulang setelah masalah koneksi
   diperbaiki.

## Langkah berikutnya

Tahap 7: PWA (manifest, service worker, indikator offline, pembaruan) dan backup terjadwal. Tahap 8:
server lisensi, pengelolaan perangkat, dan finalisasi dokumentasi. Pelanggan/pemasok tetap belum aktif
dan ditandai “T4” pada navigasi.
