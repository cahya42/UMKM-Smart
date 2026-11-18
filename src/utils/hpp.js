import { grossMargin, multiplyMoney, percentage, toRupiah } from './money'

/**
 * Perhitungan HPP (Harga Pokok Penjualan) sebagai fungsi murni tanpa akses
 * database, sehingga hasilnya dapat dipakai kalkulator, laporan, dan AI.
 *
 * Istilah yang dipakai konsisten:
 * - Total biaya batch : jumlah seluruh komponen biaya untuk satu batch.
 * - HPP per unit      : total biaya batch dibagi jumlah unit (dibulatkan rupiah).
 * - Margin kotor      : (harga jual - HPP) / harga jual.
 * - Markup            : (harga jual - HPP) / HPP.
 */

export const COST_TYPES = [
  { value: 'bahan', label: 'Bahan baku' },
  { value: 'tenaga_kerja', label: 'Tenaga kerja' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'lainnya', label: 'Lainnya' },
]

export const COST_TYPE_LABELS = COST_TYPES.reduce((labels, type) => {
  labels[type.value] = type.label
  return labels
}, {})

export const COST_TYPE_TONES = {
  bahan: 'green',
  tenaga_kerja: 'blue',
  overhead: 'amber',
  lainnya: 'gray',
}

/** Baris komponen kosong untuk formulir. Kunci hanya dipakai React. */
export function createEmptyComponent(costType = 'bahan') {
  return {
    key: crypto.randomUUID(),
    costType,
    name: '',
    quantity: '1',
    unitLabel: '',
    unitCost: '',
  }
}

/** Subtotal satu komponen: jumlah x harga satuan, dibulatkan ke rupiah. */
export function componentSubtotal(component) {
  return multiplyMoney(component?.quantity, component?.unitCost)
}

/**
 * Menjumlahkan komponen per jenis biaya.
 * @returns {{bahan:number, tenaga_kerja:number, overhead:number, lainnya:number,
 *   materialCost:number, laborCost:number, overheadCost:number, otherCost:number, totalCost:number}}
 */
export function summarizeComponents(components = []) {
  const totals = { bahan: 0, tenaga_kerja: 0, overhead: 0, lainnya: 0 }

  for (const component of components) {
    const type = totals[component?.costType] === undefined ? 'lainnya' : component.costType
    totals[type] += componentSubtotal(component)
  }

  return {
    ...totals,
    materialCost: totals.bahan,
    laborCost: totals.tenaga_kerja,
    overheadCost: totals.overhead,
    otherCost: totals.lainnya,
    totalCost: totals.bahan + totals.tenaga_kerja + totals.overhead + totals.lainnya,
  }
}

/** HPP per unit dari total biaya satu batch. */
export function calculateUnitCost(totalCost, batchQuantity) {
  const batch = Number(batchQuantity)
  if (!Number.isFinite(batch) || batch <= 0) return 0
  return toRupiah(Number(totalCost) / batch)
}

/** Margin kotor (%) berdasarkan harga jual dan HPP per unit. */
export function marginPercent(sellingPrice, unitCost) {
  return grossMargin(sellingPrice, unitCost)
}

/** Markup (%) berdasarkan harga jual dan HPP per unit. */
export function markupPercent(sellingPrice, unitCost) {
  const cost = Number(unitCost)
  if (!Number.isFinite(cost) || cost <= 0) return 0
  return percentage(Number(sellingPrice) - cost, cost)
}

/** Laba kotor per unit dalam rupiah. */
export function profitPerUnit(sellingPrice, unitCost) {
  return toRupiah(sellingPrice) - toRupiah(unitCost)
}

/**
 * Harga jual yang menghasilkan margin kotor sesuai target (%).
 * Margin 100% atau lebih tidak mungkin dicapai karena harga jual akan
 * tak terhingga; fungsi mengembalikan 0 agar formulir menolak target tersebut.
 */
export function recommendedSellingPrice(unitCost, targetMargin) {
  const cost = Number(unitCost)
  const margin = Number(targetMargin)
  if (!Number.isFinite(cost) || cost <= 0) return 0
  if (!Number.isFinite(margin) || margin <= 0) return toRupiah(cost)
  if (margin >= 100) return 0
  return toRupiah(cost / (1 - margin / 100))
}
