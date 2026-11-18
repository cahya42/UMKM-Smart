import { db } from '../db'
import { toQuantity, toRupiah } from '../../utils/money'
import { addAuditLog } from './auditLogRepo'

export const STOCK_MOVEMENT_TYPES = {
  AWAL: 'awal',
  MASUK: 'masuk',
  KELUAR: 'keluar',
  PENYESUAIAN: 'penyesuaian',
}

const DESCRIPTION_BY_TYPE = {
  masuk: 'Mencatat barang masuk',
  keluar: 'Mencatat barang keluar',
  penyesuaian: 'Menyesuaikan stok (stock opname)',
}

/**
 * Mencatat satu pergerakan stok dan memperbarui stok produk dalam SATU transaksi.
 * Stok tidak boleh negatif, dan produk jasa tidak memiliki stok.
 *
 * Pergerakan stok tidak pernah diubah atau dihapus; koreksi dilakukan dengan
 * pergerakan baru (penyesuaian) agar kartu stok tetap dapat diaudit.
 */
export async function recordStockMovement({
  productId,
  type,
  quantity,
  date,
  note = '',
  unitCost = 0,
  supplierName = '',
  supplierId = '',
  reason = '',
}) {
  if (!DESCRIPTION_BY_TYPE[type]) {
    throw new Error('Jenis pergerakan stok tidak dikenal.')
  }

  return db.transaction('rw', db.products, db.stock_movements, db.suppliers, db.audit_logs, async (tx) => {
    const product = await tx.table('products').get(productId)
    if (!product) throw new Error('Produk tidak ditemukan.')
    if (product.type !== 'barang' || product.trackStock === false) {
      throw new Error('Produk jasa tidak memiliki persediaan.')
    }

    const amount = toQuantity(quantity)
    const before = toQuantity(product.stockQty)

    if ((type === 'masuk' || type === 'keluar') && amount <= 0) {
      throw new Error('Jumlah harus lebih dari 0.')
    }
    if (type === 'penyesuaian' && amount < 0) {
      throw new Error('Stok hasil hitung tidak boleh negatif.')
    }

    let change
    if (type === 'masuk') change = amount
    else if (type === 'keluar') change = -amount
    else change = toQuantity(amount - before)

    if (type === 'penyesuaian' && change === 0) {
      throw new Error(`Stok tercatat ${before} dan hasil hitung ${amount}. Tidak ada perubahan untuk disimpan.`)
    }

    const after = toQuantity(before + change)
    if (after < 0) {
      throw new Error(
        `Stok tidak cukup. Stok ${product.name} saat ini ${before}, tidak dapat dikurangi ${amount}.`,
      )
    }

    let supplier = null
    if (supplierId) {
      supplier = await tx.table('suppliers').get(supplierId)
      if (!supplier) throw new Error('Pemasok tidak ditemukan. Pilih pemasok yang tersedia.')
      if (supplier.isActive === false) {
        throw new Error(`Pemasok ${supplier.name} sedang nonaktif dan tidak dapat dipakai.`)
      }
    }

    const now = new Date().toISOString()
    const movement = {
      id: crypto.randomUUID(),
      productId,
      type,
      change,
      qty: Math.abs(change),
      balanceBefore: before,
      balanceAfter: after,
      unitCost: toRupiah(unitCost),
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? supplierName.trim(),
      reason: reason.trim(),
      note: note.trim(),
      date,
      refType: null,
      refId: null,
      createdAt: now,
    }

    await tx.table('stock_movements').add(movement)
    await tx.table('products').update(productId, { stockQty: after, updatedAt: now })

    await addAuditLog(
      {
        action: 'stock_movement',
        entity: 'stock_movement',
        entityId: movement.id,
        description: `${DESCRIPTION_BY_TYPE[type]}: ${product.name} ${change > 0 ? '+' : ''}${change}`,
        metadata: { productId, type, change, balanceAfter: after, date },
      },
      tx,
    )

    return movement
  })
}

/**
 * Dipakai saat produk baru dibuat dengan stok awal, di dalam transaksi
 * pembuatan produk agar produk dan kartu stok selalu konsisten.
 */
export async function addInitialStock(tx, product, quantity, date) {
  const qty = toQuantity(quantity)
  if (qty <= 0) return null

  const now = new Date().toISOString()
  const movement = {
    id: crypto.randomUUID(),
    productId: product.id,
    type: 'awal',
    change: qty,
    qty,
    balanceBefore: 0,
    balanceAfter: qty,
    unitCost: toRupiah(product.purchasePrice),
    supplierName: '',
    reason: '',
    note: 'Stok awal saat produk dibuat',
    date,
    refType: null,
    refId: null,
    createdAt: now,
  }

  await tx.table('stock_movements').add(movement)
  await tx.table('products').update(product.id, { stockQty: qty, updatedAt: now })
  return movement
}

export async function listMovementsForProduct(productId) {
  return db.stock_movements.where('productId').equals(productId).toArray()
}

export async function listRecentMovements(limit = 10) {
  return db.stock_movements.orderBy('createdAt').reverse().limit(limit).toArray()
}
