/**
 * Rancangan skema database UMKM SMART (Dexie / IndexedDB).
 *
 * Aturan yang dipakai di seluruh aplikasi:
 * - Primary key berupa string UUID agar konsisten dan aman saat backup/restore.
 * - Nilai uang disimpan sebagai bilangan bulat rupiah (integer), bukan float.
 * - Tanggal usaha disimpan sebagai string 'YYYY-MM-DD' (zona waktu perangkat),
 *   sedangkan waktu pencatatan disimpan sebagai string ISO lengkap.
 * - Kolom boolean tidak diindeks karena IndexedDB hanya menerima key berupa
 *   number, string, date, atau array.
 *
 * Menambah tabel/kolom HARUS lewat versi skema baru:
 *   db.version(2).stores(STORES_V2).upgrade(tx => { ... })
 * Jangan pernah mengubah versi 1 secara langsung karena akan menghapus data.
 */

export const DB_NAME = 'umkm-smart'

/** Indeks Dexie untuk versi 1. Format: 'primaryKey, index1, index2, ...' */
export const STORES_V1 = {
  // Profil usaha (single business edition, satu baris dengan id 'primary').
  business_profile: 'id, businessName, updatedAt',

  // Pengguna lokal aplikasi (pemilik/operator), bukan akun cloud.
  users: 'id, email, name, role, createdAt',

  // Kategori produk. type: 'produk' | 'bahan'
  categories: 'id, name, type, createdAt',

  // Satuan produk (pcs, kg, liter, porsi, jam, ...)
  units: 'id, name, createdAt',

  // Produk barang maupun jasa.
  products: 'id, sku, name, categoryId, type, unitId, createdAt',
  // type: 'barang' | 'jasa'

  // Versi perhitungan HPP per produk (riwayat HPP dari kalkulator).
  product_costs: 'id, productId, businessType, effectiveDate, createdAt',

  // Komponen biaya HPP milik satu perhitungan (product_costs).
  cost_components: 'id, productCostId, productId, costType, createdAt',

  // Kartu stok: semua perubahan stok wajib lewat tabel ini.
  stock_movements: 'id, productId, type, date, createdAt',
  // type: 'awal' | 'masuk' | 'keluar' | 'penyesuaian' | 'penjualan' | 'pembatalan'

  // Header transaksi penjualan.
  sales: 'id, invoiceNumber, date, status, paymentMethod, cashAccountId, createdAt',
  // status: 'selesai' | 'dibatalkan'

  // Detail item penjualan (harga & HPP dibekukan saat transaksi).
  sale_items: 'id, saleId, productId, createdAt',

  // Pengeluaran operasional usaha.
  expenses: 'id, date, expenseCategoryId, cashAccountId, createdAt',

  // Kategori pengeluaran, bisa ditambah pengguna.
  expense_categories: 'id, name, createdAt',

  // Akun kas: tunai, rekening bank, e-wallet.
  cash_accounts: 'id, name, type, createdAt',
  // type: 'tunai' | 'bank' | 'ewallet'

  // Semua mutasi kas (termasuk transfer antarakun dan pembalik).
  cash_transactions: 'id, cashAccountId, type, date, refType, refId, createdAt',
  // type: 'masuk' | 'keluar'

  // Kontak pelanggan dan pemasok (tanpa piutang/utang pada tahap awal).
  customers: 'id, name, phone, createdAt',
  suppliers: 'id, name, phone, createdAt',

  // Preferensi & data teknis (lisensi, mode pengembangan, dsb).
  settings: 'key',

  // Audit log perubahan penting.
  audit_logs: 'id, action, entity, entityId, createdAt',

  // Riwayat percakapan SMART ADVISOR (tahap 6).
  advisor_conversations: 'id, title, createdAt, updatedAt',
  advisor_messages: 'id, conversationId, role, createdAt',
}

/**
 * Skema versi 2 (Tahap 2): versi 1 + riwayat harga produk.
 * Tabel tambahan (di luar 20 tabel inti) diperlukan karena master prompt
 * mewajibkan setiap produk memiliki riwayat perubahan harga dan HPP.
 */
export const STORES_V2 = {
  ...STORES_V1,
  product_price_history: 'id, productId, changedAt',
}
