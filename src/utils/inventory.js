import { toQuantity, toRupiah } from './money'

/**
 * Fungsi persediaan murni (tanpa akses database) agar mudah diuji.
 * Saldo stok berasal dari kolom balanceAfter yang ditulis saat pergerakan stok
 * dibuat, sehingga kartu stok tidak perlu menghitung ulang seluruh riwayat.
 */

export const MOVEMENT_LABELS = {
  awal: 'Stok awal',
  masuk: 'Barang masuk',
  keluar: 'Barang keluar',
  penyesuaian: 'Penyesuaian',
  penjualan: 'Penjualan',
  pembatalan: 'Pembatalan penjualan',
}

export const MOVEMENT_TONES = {
  awal: 'gray',
  masuk: 'green',
  keluar: 'amber',
  penyesuaian: 'blue',
  penjualan: 'blue',
  pembatalan: 'amber',
}

export const OUT_REASONS = [
  'Rusak',
  'Kedaluwarsa',
  'Hilang',
  'Pemakaian internal',
  'Retur ke pemasok',
  'Lainnya',
]

/** Produk yang stoknya benar-benar dilacak (barang, bukan jasa). */
export function isStockProduct(product) {
  return Boolean(product) && product.type === 'barang' && product.trackStock !== false
}

/** Nilai satuan yang dipakai menaksir nilai persediaan. */
export function stockUnitValue(product) {
  const hpp = toRupiah(product?.hpp)
  return hpp > 0 ? hpp : toRupiah(product?.purchasePrice)
}

/** Perubahan stok dari satu pergerakan (fallback untuk data lama). */
export function movementDelta(movement) {
  if (Number.isFinite(Number(movement?.change))) return toQuantity(movement.change)
  if (movement?.type === 'masuk' || movement?.type === 'pembatalan') return toQuantity(movement?.qty)
  return -toQuantity(movement?.qty)
}

export function summarizeInventory(products = []) {
  const stockProducts = products.filter((product) => isStockProduct(product) && product.isActive !== false)

  const totalValue = stockProducts.reduce(
    (total, product) => total + Math.round(toQuantity(product.stockQty) * stockUnitValue(product)),
    0,
  )

  const outOfStock = stockProducts.filter((product) => toQuantity(product.stockQty) <= 0)
  const lowStock = stockProducts.filter((product) => {
    const stock = toQuantity(product.stockQty)
    return stock > 0 && stock <= toQuantity(product.minStock)
  })

  return {
    count: stockProducts.length,
    totalValue,
    lowStock,
    outOfStock,
    alertCount: lowStock.length + outOfStock.length,
  }
}

/**
 * Menyusun kartu stok untuk satu periode.
 * @param {Array} movements seluruh pergerakan satu produk
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string} endDate 'YYYY-MM-DD'
 */
export function buildStockCard(movements = [], startDate, endDate) {
  const sorted = [...movements].sort((a, b) =>
    `${a.date} ${a.createdAt ?? ''}`.localeCompare(`${b.date} ${b.createdAt ?? ''}`),
  )

  const before = sorted.filter((movement) => movement.date < startDate)
  const openingBalance = before.length > 0 ? before[before.length - 1].balanceAfter ?? 0 : 0

  const rows = sorted.filter((movement) => movement.date >= startDate && movement.date <= endDate)

  const closingBalance = rows.length > 0
    ? rows[rows.length - 1].balanceAfter ?? openingBalance
    : openingBalance

  const totalIn = rows.reduce((total, movement) => {
    const delta = movementDelta(movement)
    return delta > 0 ? total + delta : total
  }, 0)

  const totalOut = rows.reduce((total, movement) => {
    const delta = movementDelta(movement)
    return delta < 0 ? total + Math.abs(delta) : total
  }, 0)

  return { openingBalance, rows, closingBalance, totalIn, totalOut }
}
