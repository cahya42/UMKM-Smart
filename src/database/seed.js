/**
 * Data awal (referensi), bukan data transaksi contoh.
 *
 * Fungsi ini hanya dijalankan sekali saat database pertama kali dibuat
 * (event 'populate'). Data transaksi usaha tidak pernah diisi otomatis.
 */

const now = () => new Date().toISOString()

const UNITS = [
  { name: 'pcs', description: 'Satuan buah / unit' },
  { name: 'kg', description: 'Kilogram' },
  { name: 'gram', description: 'Gram' },
  { name: 'liter', description: 'Liter' },
  { name: 'ml', description: 'Mililiter' },
  { name: 'porsi', description: 'Porsi makanan/minuman' },
  { name: 'bungkus', description: 'Bungkus / kemasan' },
  { name: 'paket', description: 'Paket layanan' },
  { name: 'jam', description: 'Jam layanan' },
  { name: 'meter', description: 'Meter' },
]

const EXPENSE_CATEGORIES = [
  'Sewa',
  'Listrik',
  'Air',
  'Transportasi',
  'Gaji',
  'Promosi',
  'Perawatan',
  'Administrasi',
  'Pengeluaran lainnya',
]

/**
 * @param {import('dexie').Transaction} tx transaksi populate dari Dexie
 */
export async function seedDatabase(tx) {
  const timestamp = now()

  await tx.table('units').bulkAdd(
    UNITS.map((unit) => ({
      id: crypto.randomUUID(),
      name: unit.name,
      description: unit.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )

  await tx.table('expense_categories').bulkAdd(
    EXPENSE_CATEGORIES.map((name) => ({
      id: crypto.randomUUID(),
      name,
      isSystem: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )

  await tx.table('cash_accounts').bulkAdd([
    {
      id: crypto.randomUUID(),
      name: 'Kas Tunai',
      type: 'tunai',
      openingBalance: 0,
      note: 'Kas utama di tempat usaha',
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ])

  await tx.table('settings').bulkAdd([
    { key: 'app.installedAt', value: timestamp, updatedAt: timestamp },
    { key: 'license.offlineGraceDays', value: 30, updatedAt: timestamp },
  ])
}
