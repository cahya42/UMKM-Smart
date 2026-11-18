import { eachDateKey, eachMonthKey, formatDayMonth, formatMonthLabel, monthKeyOf } from './dates'
import { percentage, toRupiah } from './money'

/**
 * Kumpulan fungsi perhitungan keuangan murni (tanpa akses database),
 * sehingga bisa diuji terpisah dan dipakai ulang oleh laporan serta AI.
 *
 * Istilah:
 * - Omzet          : total nilai penjualan (belum dikurangi apa pun).
 * - HPP            : biaya langsung barang/jasa yang terjual.
 * - Laba kotor     : omzet - HPP.
 * - Biaya operasional : pengeluaran usaha pada periode.
 * - Laba bersih    : laba kotor - biaya operasional (estimasi).
 * - Saldo kas      : uang yang benar-benar ada di akun kas, bukan laba.
 */

export function sumAmounts(values) {
  return values.reduce((total, value) => total + (Number.isFinite(Number(value)) ? Number(value) : 0), 0)
}

/** Penjualan yang dianggap sah (belum/ tidak dibatalkan). */
export function isCompletedSale(sale) {
  return sale && sale.status !== 'dibatalkan'
}

/**
 * @param {Array} sales daftar penjualan pada periode
 * @param {Array} saleItems detail item milik penjualan tersebut
 */
export function summarizeSales(sales, saleItems = []) {
  const completed = sales.filter(isCompletedSale)
  const completedIds = new Set(completed.map((sale) => sale.id))

  const omzet = completed.reduce((total, sale) => total + toRupiah(sale.total), 0)
  const discounts = completed.reduce((total, sale) => total + toRupiah(sale.discount), 0)

  const hpp = saleItems
    .filter((item) => completedIds.has(item.saleId))
    .reduce((total, item) => total + toRupiah(Number(item.costPrice || 0) * Number(item.qty || 0)), 0)

  const transactions = completed.length
  const itemsSold = saleItems
    .filter((item) => completedIds.has(item.saleId))
    .reduce((total, item) => total + (Number(item.qty) || 0), 0)

  return {
    omzet,
    hpp,
    discounts,
    grossProfit: omzet - hpp,
    margin: percentage(omzet - hpp, omzet),
    transactions,
    itemsSold,
    averageTransaction: transactions > 0 ? Math.round(omzet / transactions) : 0,
  }
}

export function isCompletedExpense(expense) {
  return Boolean(expense) && expense.status !== 'dibatalkan'
}

export function summarizeExpenses(expenses = []) {
  const active = expenses.filter(isCompletedExpense)
  const total = active.reduce((acc, expense) => acc + toRupiah(expense.amount), 0)
  return { total, count: active.length }
}

/**
 * Saldo kas dihitung dari saldo awal setiap akun ditambah seluruh mutasi kas.
 * Saldo kas TIDAK sama dengan laba.
 */
export function computeCashBalances(accounts = [], cashTransactions = []) {
  const perAccount = accounts.map((account) => {
    const opening = toRupiah(account.openingBalance)
    const movements = cashTransactions
      .filter((transaction) => transaction.cashAccountId === account.id)
      .reduce((total, transaction) => {
        const amount = toRupiah(transaction.amount)
        return total + (transaction.type === 'masuk' ? amount : -amount)
      }, 0)

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      balance: opening + movements,
    }
  })

  return {
    total: perAccount.reduce((total, account) => total + account.balance, 0),
    accounts: perAccount,
  }
}

export function findLowStockProducts(products = []) {
  return products.filter(
    (product) =>
      product.isActive !== false &&
      product.type === 'barang' &&
      product.trackStock !== false &&
      Number(product.stockQty || 0) <= Number(product.minStock || 0),
  )
}

export function countActiveProducts(products = []) {
  return products.filter((product) => product.isActive !== false).length
}

/**
 * Ringkasan laba rugi sederhana untuk satu periode.
 */
export function buildProfitSummary(sales, saleItems, expenses) {
  const salesSummary = summarizeSales(sales, saleItems)
  const expenseSummary = summarizeExpenses(expenses)

  return {
    ...salesSummary,
    operatingExpenses: expenseSummary.total,
    expenseCount: expenseSummary.count,
    netProfit: salesSummary.grossProfit - expenseSummary.total,
    netMargin: percentage(salesSummary.grossProfit - expenseSummary.total, salesSummary.omzet),
  }
}

/**
 * Data grafik per hari (periode pendek) atau per bulan (periode panjang).
 * Mengembalikan satuan omzet penjualan dan pengeluaran untuk setiap titik.
 */
export function buildPeriodSeries(sales = [], expenses = [], range) {
  const useMonthly = (range?.dayCount ?? 0) > 62

  const buckets = new Map()

  if (useMonthly) {
    for (const key of eachMonthKey(range.startDate, range.endDate)) {
      buckets.set(key, { key, label: formatMonthLabel(`${key}-01`), penjualan: 0, pengeluaran: 0 })
    }
    for (const sale of sales) {
      if (!isCompletedSale(sale)) continue
      const key = monthKeyOf(sale.date)
      const bucket = buckets.get(key)
      if (bucket) bucket.penjualan += toRupiah(sale.total)
    }
    for (const expense of expenses) {
      if (!isCompletedExpense(expense)) continue
      const key = monthKeyOf(expense.date)
      const bucket = buckets.get(key)
      if (bucket) bucket.pengeluaran += toRupiah(expense.amount)
    }
  } else {
    for (const key of eachDateKey(range.startDate, range.endDate)) {
      buckets.set(key, { key, label: formatDayMonth(key), penjualan: 0, pengeluaran: 0 })
    }
    for (const sale of sales) {
      if (!isCompletedSale(sale)) continue
      const bucket = buckets.get(sale.date)
      if (bucket) bucket.penjualan += toRupiah(sale.total)
    }
    for (const expense of expenses) {
      if (!isCompletedExpense(expense)) continue
      const bucket = buckets.get(expense.date)
      if (bucket) bucket.pengeluaran += toRupiah(expense.amount)
    }
  }

  return { granularity: useMonthly ? 'bulan' : 'hari', points: Array.from(buckets.values()) }
}

/**
 * Menggabungkan penjualan dan pengeluaran menjadi daftar transaksi terbaru.
 */
export function buildRecentActivity(sales = [], expenses = [], limit = 6) {
  const saleEntries = sales.map((sale) => ({
    id: `sale-${sale.id}`,
    kind: 'penjualan',
    title: sale.invoiceNumber ? `Penjualan ${sale.invoiceNumber}` : 'Penjualan',
    subtitle: sale.customerName || 'Pelanggan umum',
    date: sale.date,
    createdAt: sale.createdAt,
    amount: toRupiah(sale.total),
    canceled: sale.status === 'dibatalkan',
  }))

  const expenseEntries = expenses.map((expense) => ({
    id: `expense-${expense.id}`,
    kind: 'pengeluaran',
    title: expense.description || 'Pengeluaran',
    subtitle: expense.categoryName || 'Biaya operasional',
    date: expense.date,
    createdAt: expense.createdAt,
    amount: toRupiah(expense.amount),
    canceled: expense.status === 'dibatalkan',
  }))

  return [...saleEntries, ...expenseEntries]
    .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)))
    .slice(0, limit)
}
