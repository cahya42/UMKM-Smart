import Dexie from 'dexie'
import { DB_NAME, STORES_V1, STORES_V2 } from './schema'
import { seedDatabase } from './seed'

export const db = new Dexie(DB_NAME)

/**
 * Versi skema ditambahkan berurutan tanpa mengubah versi lama, sehingga data
 * pengguna tetap aman saat aplikasi diperbarui.
 *
 * v1 (Tahap 1): 20 tabel inti.
 * v2 (Tahap 2): menambah product_price_history untuk riwayat harga & HPP.
 */
db.version(1).stores(STORES_V1)
db.version(2).stores(STORES_V2)

// Hanya berjalan saat database baru dibuat (bukan saat pembaruan versi).
db.on('populate', (tx) => seedDatabase(tx))

/** Info versi untuk halaman Pengaturan dan file backup. */
export async function getDatabaseInfo() {
  return {
    name: db.name,
    version: db.verno,
    isOpen: db.isOpen(),
    tables: db.tables.map((table) => table.name),
  }
}
