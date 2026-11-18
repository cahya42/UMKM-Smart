/**
 * Semua uang di UMKM SMART disimpan sebagai bilangan bulat rupiah (integer).
 * Tidak ada desimal pada nilai uang, sehingga penjumlahan tidak terkena
 * galat pembulatan floating point seperti 0.1 + 0.2.
 */

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Membulatkan ke rupiah terdekat dan memastikan hasilnya bilangan bulat. */
export function toRupiah(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number)
}

/** Format tampilan: Rp1.500.000 */
export function formatRupiah(value) {
  return rupiahFormatter.format(toRupiah(value))
}

/** Format ringkas untuk kartu statistik: Rp1,5 jt */
export function formatRupiahCompact(value) {
  const amount = toRupiah(value)
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return `Rp${trimDecimal(amount / 1_000_000_000)} M`
  if (abs >= 1_000_000) return `Rp${trimDecimal(amount / 1_000_000)} jt`
  if (abs >= 10_000) return `Rp${trimDecimal(amount / 1_000)} rb`
  return formatRupiah(amount)
}

function trimDecimal(number) {
  return number.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
}

/** Kuantitas stok (boleh desimal untuk kg/liter), dibatasi 2 angka di belakang koma. */
export function toQuantity(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

/** Format angka umum (kuantitas stok, jumlah transaksi). */
export function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return numberFormatter.format(number)
}

/**
 * Total uang untuk satu baris: kuantitas (boleh desimal untuk kg/liter)
 * dikali harga satuan integer, dibulatkan ke rupiah.
 */
export function multiplyMoney(quantity, unitAmount) {
  const qty = Number(quantity)
  const price = toRupiah(unitAmount)
  if (!Number.isFinite(qty)) return 0
  return toRupiah(qty * price)
}

/** Persentase aman (0 jika pembagi 0). */
export function percentage(part, whole, fractionDigits = 1) {
  const total = Number(whole)
  if (!Number.isFinite(total) || total === 0) return 0
  const value = (Number(part) / total) * 100
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(fractionDigits))
}

/** Format persentase: 32,5% */
export function formatPercent(value, fractionDigits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0%'
  return `${number.toFixed(fractionDigits).replace('.', ',')}%`
}

/** HPP per unit dibulatkan ke rupiah. */
export function unitCost(totalCost, quantity) {
  const total = toRupiah(totalCost)
  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) return 0
  return toRupiah(total / qty)
}

/** Margin kotor (%) dari harga jual dan HPP per unit. */
export function grossMargin(sellingPrice, costPrice) {
  const price = toRupiah(sellingPrice)
  if (price <= 0) return 0
  return percentage(price - toRupiah(costPrice), price)
}
