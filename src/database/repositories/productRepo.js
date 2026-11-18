import { db } from '../db'
import { formatRupiah, toQuantity, toRupiah } from '../../utils/money'
import { toDateKey } from '../../utils/dates'
import { addAuditLog } from './auditLogRepo'
import { addInitialStock } from './stockRepo'

export const PRODUCT_TYPE = {
  BARANG: 'barang',
  JASA: 'jasa',
}

/** Mengubah input formulir menjadi record produk yang konsisten. */
export function normalizeProductInput(input) {
  const type = input.type === PRODUCT_TYPE.JASA ? PRODUCT_TYPE.JASA : PRODUCT_TYPE.BARANG
  const isBarang = type === PRODUCT_TYPE.BARANG

  return {
    name: input.name.trim(),
    sku: (input.sku ?? '').trim().toUpperCase(),
    type,
    categoryId: input.categoryId || null,
    unitId: input.unitId || null,
    purchasePrice: toRupiah(input.purchasePrice),
    sellingPrice: toRupiah(input.sellingPrice),
    hpp: toRupiah(input.hpp),
    stockQty: isBarang ? toQuantity(input.stockQty) : 0,
    minStock: isBarang ? toQuantity(input.minStock) : 0,
    trackStock: isBarang ? input.trackStock !== false : false,
    isActive: true,
    imageDataUrl: input.imageDataUrl || null,
    note: (input.note ?? '').trim(),
  }
}

async function nextSku(table) {
  const total = await table.count()
  let sequence = total + 1
  let candidate = `PRD-${String(sequence).padStart(4, '0')}`
  let guard = 0

  while ((await table.where('sku').equals(candidate).count()) > 0 && guard < 1000) {
    sequence += 1
    candidate = `PRD-${String(sequence).padStart(4, '0')}`
    guard += 1
  }
  return candidate
}

export async function listProducts() {
  return db.products.orderBy('name').toArray()
}

export async function getAllProducts() {
  return db.products.toArray()
}

export async function getProduct(productId) {
  return db.products.get(productId)
}

export async function createProduct(input) {
  const data = normalizeProductInput(input)

  return db.transaction('rw', db.products, db.stock_movements, db.product_price_history, db.audit_logs, async (tx) => {
    const table = tx.table('products')
    if (!data.sku) data.sku = await nextSku(table)

    const duplicateSku = await table.where('sku').equals(data.sku).count()
    if (duplicateSku > 0) throw new Error(`SKU "${data.sku}" sudah dipakai produk lain.`)

    const now = new Date().toISOString()
    const record = { id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now }

    await table.add(record)

    await tx.table('product_price_history').add({
      id: crypto.randomUUID(),
      productId: record.id,
      purchasePrice: record.purchasePrice,
      sellingPrice: record.sellingPrice,
      hpp: record.hpp,
      source: 'create',
      note: 'Harga awal produk',
      changedAt: now,
    })

    await addInitialStock(tx, record, record.stockQty, toDateKey())

    await addAuditLog(
      {
        action: 'create',
        entity: 'product',
        entityId: record.id,
        description: `Menambah produk ${record.name}`,
        metadata: { sku: record.sku, type: record.type },
      },
      tx,
    )

    return record
  })
}

export async function updateProduct(productId, input) {
  const data = normalizeProductInput(input)

  return db.transaction('rw', db.products, db.product_price_history, db.audit_logs, async (tx) => {
    const existing = await tx.table('products').get(productId)
    if (!existing) throw new Error('Produk tidak ditemukan.')

    // Stok tidak boleh diubah dari formulir produk; gunakan modul Persediaan
    // agar setiap perubahan stok punya catatan kartu stok.
    const nextStock = toQuantity(existing.stockQty)
    if (existing.type === 'barang' && data.type === 'jasa' && nextStock > 0) {
      throw new Error(
        'Jenis produk tidak dapat diubah menjadi jasa karena masih memiliki stok. Sesuaikan stok menjadi 0 di menu Persediaan terlebih dahulu.',
      )
    }
    data.stockQty = data.type === 'barang' ? nextStock : 0

    if (data.sku && data.sku !== existing.sku) {
      const duplicate = await tx.table('products').where('sku').equals(data.sku).count()
      if (duplicate > 0) throw new Error(`SKU "${data.sku}" sudah dipakai produk lain.`)
    }
    if (!data.sku) data.sku = existing.sku

    const priceChanged =
      data.purchasePrice !== existing.purchasePrice ||
      data.sellingPrice !== existing.sellingPrice ||
      data.hpp !== existing.hpp

    const updated = {
      ...existing,
      ...data,
      isActive: existing.isActive,
      updatedAt: new Date().toISOString(),
    }

    await tx.table('products').put(updated)

    if (priceChanged) {
      const notes = []
      if (data.purchasePrice !== existing.purchasePrice) {
        notes.push(`harga beli ${formatRupiah(existing.purchasePrice)} -> ${formatRupiah(data.purchasePrice)}`)
      }
      if (data.sellingPrice !== existing.sellingPrice) {
        notes.push(`harga jual ${formatRupiah(existing.sellingPrice)} -> ${formatRupiah(data.sellingPrice)}`)
      }
      if (data.hpp !== existing.hpp) {
        notes.push(`HPP ${formatRupiah(existing.hpp)} -> ${formatRupiah(data.hpp)}`)
      }

      await tx.table('product_price_history').add({
        id: crypto.randomUUID(),
        productId,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        hpp: data.hpp,
        source: 'update',
        note: notes.join('; '),
        changedAt: updated.updatedAt,
      })

      await addAuditLog(
        {
          action: 'price_change',
          entity: 'product',
          entityId: productId,
          description: `Mengubah harga ${existing.name}: ${notes.join('; ')}`,
        },
        tx,
      )
    }

    await addAuditLog(
      {
        action: 'update',
        entity: 'product',
        entityId: productId,
        description: `Memperbarui produk ${existing.name}`,
      },
      tx,
    )

    return updated
  })
}

export async function setProductActive(productId, isActive) {
  return db.transaction('rw', db.products, db.audit_logs, async (tx) => {
    const product = await tx.table('products').get(productId)
    if (!product) throw new Error('Produk tidak ditemukan.')

    await tx.table('products').update(productId, {
      isActive: Boolean(isActive),
      updatedAt: new Date().toISOString(),
    })

    await addAuditLog(
      {
        action: isActive ? 'activate' : 'deactivate',
        entity: 'product',
        entityId: productId,
        description: `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} produk ${product.name}`,
      },
      tx,
    )
  })
}

/**
 * Hapus permanen hanya untuk produk yang belum pernah dipakai transaksi.
 * Selain itu produk harus dinonaktifkan agar riwayat penjualan dan kartu stok
 * tetap utuh.
 */
export async function deleteProduct(productId) {
  return db.transaction(
    'rw',
    db.products,
    db.stock_movements,
    db.sale_items,
    db.product_price_history,
    db.audit_logs,
    async (tx) => {
      const product = await tx.table('products').get(productId)
      if (!product) throw new Error('Produk tidak ditemukan.')

      const soldItems = await tx.table('sale_items').where('productId').equals(productId).count()
      if (soldItems > 0) {
        throw new Error(
          'Produk sudah dipakai pada transaksi penjualan. Nonaktifkan produk agar riwayat penjualan tetap utuh.',
        )
      }

      const movements = await tx.table('stock_movements').where('productId').equals(productId).toArray()
      const nonInitial = movements.filter((movement) => movement.type !== 'awal')
      if (nonInitial.length > 0) {
        throw new Error(
          'Produk sudah memiliki riwayat stok (barang masuk/keluar/penyesuaian). Nonaktifkan produk agar kartu stok tetap utuh.',
        )
      }

      await tx.table('stock_movements').bulkDelete(movements.map((movement) => movement.id))
      await tx.table('product_price_history').where('productId').equals(productId).delete()
      await tx.table('products').delete(productId)

      await addAuditLog(
        {
          action: 'delete',
          entity: 'product',
          entityId: productId,
          description: `Menghapus produk ${product.name}`,
          metadata: { sku: product.sku },
        },
        tx,
      )
    },
  )
}

export async function getProductPriceHistory(productId, limit = 12) {
  const rows = await db.product_price_history.where('productId').equals(productId).toArray()
  return rows.sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, limit)
}
