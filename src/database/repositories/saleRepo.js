import { db } from '../db'
import { toQuantity, toRupiah } from '../../utils/money'
import { lineSubtotal } from '../../utils/sales'
import { isStockProduct } from '../../utils/inventory'
import { addAuditLog } from './auditLogRepo'

/**
 * Penjualan selalu menulis empat hal dalam SATU transaksi Dexie:
 * 1. header `sales` + detail `sale_items` (harga & HPP dibekukan),
 * 2. pengurangan stok `stock_movements` + `products.stockQty`,
 * 3. kas masuk `cash_transactions`,
 * 4. audit log.
 *
 * Pembatalan tidak menghapus apa pun: stok dikembalikan lewat pergerakan
 * `pembatalan` dan uang dikembalikan lewat mutasi kas `sale_cancel`.
 */

export const SALE_STATUS = {
  SELESAI: 'selesai',
  DIBATALKAN: 'dibatalkan',
}

function normalizeItemInput(item) {
  return {
    productId: item.productId,
    qty: toQuantity(item.qty),
    price: toRupiah(item.price),
    discount: toRupiah(item.discount),
  }
}

async function nextInvoiceNumber(tx, date) {
  const prefix = `INV-${date.replace(/-/g, '')}`
  const sameDay = await tx.table('sales').where('date').equals(date).count()
  let sequence = sameDay + 1
  let candidate = `${prefix}-${String(sequence).padStart(3, '0')}`
  let guard = 0

  while ((await tx.table('sales').where('invoiceNumber').equals(candidate).count()) > 0 && guard < 1000) {
    sequence += 1
    candidate = `${prefix}-${String(sequence).padStart(3, '0')}`
    guard += 1
  }
  return candidate
}

export async function createSale(input) {
  const items = (input.items ?? []).filter((item) => item.productId).map(normalizeItemInput)
  if (items.length === 0) {
    throw new Error('Tambahkan minimal satu produk pada penjualan.')
  }

  const productIds = items.map((item) => item.productId)
  if (new Set(productIds).size !== productIds.length) {
    throw new Error('Satu produk hanya boleh muncul satu kali. Gabungkan jumlahnya pada baris yang sama.')
  }

  return db.transaction(
    'rw',
    db.products,
    db.sales,
    db.sale_items,
    db.stock_movements,
    db.cash_transactions,
    db.cash_accounts,
    db.customers,
    db.audit_logs,
    async (tx) => {
      const account = await tx.table('cash_accounts').get(input.cashAccountId)
      if (!account) throw new Error('Akun kas tidak ditemukan. Pilih akun kas yang tersedia.')

      let customer = null
      if (input.customerId) {
        customer = await tx.table('customers').get(input.customerId)
        if (!customer) throw new Error('Pelanggan tidak ditemukan. Pilih pelanggan yang tersedia.')
        if (customer.isActive === false) {
          throw new Error(`Pelanggan ${customer.name} sedang nonaktif dan tidak dapat dipakai pada nota baru.`)
        }
      }

      const prepared = []

      for (const item of items) {
        const product = await tx.table('products').get(item.productId)
        if (!product) throw new Error('Produk pada penjualan tidak ditemukan.')
        if (product.isActive === false) {
          throw new Error(`Produk ${product.name} sedang nonaktif dan tidak dapat dijual.`)
        }
        if (!(item.qty > 0)) {
          throw new Error(`Jumlah ${product.name} harus lebih dari 0.`)
        }

        const lineBase = lineSubtotal(item.qty, item.price, 0)
        if (item.discount > lineBase) {
          throw new Error(`Diskon ${product.name} melebihi subtotal baris.`)
        }

        if (isStockProduct(product)) {
          const stock = toQuantity(product.stockQty)
          if (item.qty > stock) {
            throw new Error(
              `Stok ${product.name} tidak cukup. Tersedia ${stock}, diminta ${item.qty}.`,
            )
          }
        }

        prepared.push({
          product,
          qty: item.qty,
          price: item.price,
          discount: item.discount,
          subtotal: lineSubtotal(item.qty, item.price, item.discount),
          costPrice: toRupiah(product.hpp),
          trackStock: isStockProduct(product),
        })
      }

      const subtotal = prepared.reduce((total, item) => total + item.subtotal, 0)
      const saleDiscount = toRupiah(input.discount)
      if (saleDiscount > subtotal) {
        throw new Error('Diskon penjualan melebihi subtotal.')
      }
      const total = subtotal - saleDiscount
      const totalCost = prepared.reduce(
        (cost, item) => cost + toRupiah(item.qty * item.costPrice),
        0,
      )

      const now = new Date().toISOString()
      const invoiceNumber = await nextInvoiceNumber(tx, input.date)
      const saleId = crypto.randomUUID()

      const sale = {
        id: saleId,
        invoiceNumber,
        date: input.date,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? '',
        subtotal,
        discount: saleDiscount,
        total,
        totalCost,
        itemCount: prepared.length,
        quantity: toQuantity(prepared.reduce((qty, item) => qty + item.qty, 0)),
        paymentMethod: input.paymentMethod,
        cashAccountId: input.cashAccountId,
        status: SALE_STATUS.SELESAI,
        note: (input.note ?? '').trim(),
        canceledAt: null,
        cancelReason: '',
        createdAt: now,
        updatedAt: now,
      }

      await tx.table('sales').add(sale)

      for (const item of prepared) {
        await tx.table('sale_items').add({
          id: crypto.randomUUID(),
          saleId,
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku ?? '',
          unitId: item.product.unitId ?? null,
          qty: item.qty,
          price: item.price,
          discount: item.discount,
          subtotal: item.subtotal,
          costPrice: item.costPrice,
          trackStock: item.trackStock,
          createdAt: now,
        })

        if (!item.trackStock) continue

        const before = toQuantity(item.product.stockQty)
        const after = toQuantity(before - item.qty)

        await tx.table('stock_movements').add({
          id: crypto.randomUUID(),
          productId: item.product.id,
          type: 'penjualan',
          change: -item.qty,
          qty: item.qty,
          balanceBefore: before,
          balanceAfter: after,
          unitCost: item.costPrice,
          supplierName: '',
          reason: '',
          note: `Penjualan ${invoiceNumber}`,
          date: input.date,
          refType: 'sale',
          refId: saleId,
          createdAt: now,
        })

        await tx.table('products').update(item.product.id, { stockQty: after, updatedAt: now })
      }

      if (total > 0) {
        await tx.table('cash_transactions').add({
          id: crypto.randomUUID(),
          cashAccountId: input.cashAccountId,
          type: 'masuk',
          amount: total,
          date: input.date,
          refType: 'sale',
          refId: saleId,
          description: `Penjualan ${invoiceNumber}`,
          createdAt: now,
        })
      }

      await addAuditLog(
        {
          action: 'sale_create',
          entity: 'sale',
          entityId: saleId,
          description: `Mencatat penjualan ${invoiceNumber} sebesar Rp${total}`,
          metadata: {
            invoiceNumber,
            total,
            totalCost,
            itemCount: prepared.length,
            paymentMethod: input.paymentMethod,
          },
        },
        tx,
      )

      return sale
    },
  )
}

/** Membatalkan penjualan dengan stok kembali dan kas keluar (bukan menghapus). */
export async function cancelSale(saleId, reason = '') {
  return db.transaction(
    'rw',
    db.products,
    db.sales,
    db.sale_items,
    db.stock_movements,
    db.cash_transactions,
    db.audit_logs,
    async (tx) => {
      const sale = await tx.table('sales').get(saleId)
      if (!sale) throw new Error('Penjualan tidak ditemukan.')
      if (sale.status === SALE_STATUS.DIBATALKAN) {
        throw new Error('Penjualan ini sudah dibatalkan.')
      }

      const items = await tx.table('sale_items').where('saleId').equals(saleId).toArray()
      const now = new Date().toISOString()

      for (const item of items) {
        if (item.trackStock === false) continue
        const product = await tx.table('products').get(item.productId)
        if (!product) continue

        const before = toQuantity(product.stockQty)
        const after = toQuantity(before + item.qty)

        await tx.table('stock_movements').add({
          id: crypto.randomUUID(),
          productId: product.id,
          type: 'pembatalan',
          change: item.qty,
          qty: item.qty,
          balanceBefore: before,
          balanceAfter: after,
          unitCost: toRupiah(item.costPrice),
          supplierName: '',
          reason: 'Pembatalan penjualan',
          note: `Pembatalan ${sale.invoiceNumber}`,
          date: now.slice(0, 10),
          refType: 'sale_cancel',
          refId: sale.id,
          createdAt: now,
        })

        await tx.table('products').update(product.id, { stockQty: after, updatedAt: now })
      }

      if (sale.total > 0) {
        await tx.table('cash_transactions').add({
          id: crypto.randomUUID(),
          cashAccountId: sale.cashAccountId,
          type: 'keluar',
          amount: toRupiah(sale.total),
          date: now.slice(0, 10),
          refType: 'sale_cancel',
          refId: sale.id,
          description: `Pembatalan penjualan ${sale.invoiceNumber}`,
          createdAt: now,
        })
      }

      const updated = {
        ...sale,
        status: SALE_STATUS.DIBATALKAN,
        canceledAt: now,
        cancelReason: reason.trim(),
        updatedAt: now,
      }
      await tx.table('sales').put(updated)

      await addAuditLog(
        {
          action: 'sale_cancel',
          entity: 'sale',
          entityId: sale.id,
          description: `Membatalkan penjualan ${sale.invoiceNumber} sebesar Rp${sale.total}; stok dan kas dikembalikan`,
          metadata: { invoiceNumber: sale.invoiceNumber, total: sale.total, reason: reason.trim() },
        },
        tx,
      )

      return updated
    },
  )
}

/** Daftar penjualan; `month` berformat 'YYYY-MM'. */
export async function listSales({ month } = {}) {
  const rows = month
    ? await db.sales.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray()
    : await db.sales.toArray()

  return rows.sort((a, b) =>
    `${b.date}${b.createdAt ?? ''}`.localeCompare(`${a.date}${a.createdAt ?? ''}`),
  )
}

export async function getSaleItems(saleId) {
  return db.sale_items.where('saleId').equals(saleId).toArray()
}

export async function getSaleDetail(saleId) {
  const sale = await db.sales.get(saleId)
  if (!sale) return null

  const [items, account] = await Promise.all([
    getSaleItems(saleId),
    sale.cashAccountId ? db.cash_accounts.get(sale.cashAccountId) : Promise.resolve(null),
  ])

  return { sale, items, accountName: account?.name ?? 'Akun kas dihapus' }
}
