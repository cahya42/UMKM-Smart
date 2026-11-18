import { multiplyMoney, percentage, toQuantity, toRupiah } from './money'

/**
 * Perhitungan penjualan murni (tanpa akses database).
 * Nilai uang selalu integer rupiah; kuantitas boleh desimal 2 angka.
 */

export const PAYMENT_METHODS = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer bank' },
  { value: 'qris', label: 'QRIS' },
  { value: 'ewallet', label: 'E-wallet' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const PAYMENT_LABELS = PAYMENT_METHODS.reduce((labels, method) => {
  labels[method.value] = method.label
  return labels
}, {})

export const PAYMENT_TONES = {
  tunai: 'green',
  transfer: 'blue',
  qris: 'blue',
  ewallet: 'amber',
  lainnya: 'gray',
}

export const SALE_STATUS_LABELS = {
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

/** Subtotal satu baris setelah diskon baris, tidak pernah negatif. */
export function lineSubtotal(quantity, price, discount = 0) {
  const base = multiplyMoney(toQuantity(quantity), toRupiah(price))
  const discountValue = Math.min(toRupiah(discount), base)
  return base - discountValue
}

/**
 * Ringkasan nilai penjualan dari baris item.
 * Baris tanpa produk diabaikan agar baris kosong pada formulir tidak dihitung.
 */
export function buildSaleTotals(items = [], saleDiscount = 0) {
  let subtotal = 0
  let totalCost = 0
  let quantity = 0
  let itemCount = 0

  for (const item of items) {
    if (!item?.productId) continue
    const qty = toQuantity(item.qty)
    if (!(qty > 0)) continue

    subtotal += lineSubtotal(qty, item.price, item.discount)
    totalCost += toRupiah(qty * toRupiah(item.costPrice))
    quantity += qty
    itemCount += 1
  }

  const discount = Math.min(toRupiah(saleDiscount), subtotal)
  const total = subtotal - discount
  const profit = total - totalCost

  return {
    subtotal,
    discount,
    total,
    totalCost,
    profit,
    margin: percentage(profit, total),
    quantity,
    itemCount,
  }
}

/** Ringkasan daftar penjualan (hanya yang tidak dibatalkan). */
export function summarizeSalesList(sales = []) {
  const completed = sales.filter((sale) => sale.status !== 'dibatalkan')
  const omzet = completed.reduce((total, sale) => total + toRupiah(sale.total), 0)
  const totalCost = completed.reduce((total, sale) => total + toRupiah(sale.totalCost), 0)

  return {
    omzet,
    totalCost,
    grossProfit: omzet - totalCost,
    transactions: completed.length,
    canceled: sales.length - completed.length,
  }
}
