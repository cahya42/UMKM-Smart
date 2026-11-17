import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../database/db'
import { getPeriodRange } from '../utils/dates'
import {
  buildPeriodSeries,
  buildProfitSummary,
  buildRecentActivity,
  computeCashBalances,
  countActiveProducts,
  findLowStockProducts,
  summarizeSales,
} from '../utils/finance'

/**
 * Mengambil data dashboard sesuai periode terpilih dan menghitung ringkasannya
 * dengan fungsi keuangan murni di utils/finance.js.
 *
 * Catatan: dashboard sengaja hanya membaca data yang dibutuhkan, tidak
 * mengirim atau memuat seluruh basis data ke memori pada setiap perubahan.
 */
export function useDashboardData({ period, customStart, customEnd }) {
  const range = useMemo(
    () => getPeriodRange(period, { start: customStart, end: customEnd }),
    [period, customStart, customEnd],
  )

  const data = useLiveQuery(
    async () => {
      try {
        const todayKey = getPeriodRange('today').startDate
        const monthRange = getPeriodRange('month')

        const [
          sales,
          expenses,
          products,
          accounts,
          cashTransactions,
          recentSales,
          recentExpenses,
          expenseCategories,
          todaySales,
          monthSales,
        ] = await Promise.all([
          db.sales.where('date').between(range.startDate, range.endDate, true, true).toArray(),
          db.expenses.where('date').between(range.startDate, range.endDate, true, true).toArray(),
          db.products.toArray(),
          db.cash_accounts.toArray(),
          db.cash_transactions.toArray(),
          db.sales.orderBy('createdAt').reverse().limit(6).toArray(),
          db.expenses.orderBy('createdAt').reverse().limit(6).toArray(),
          db.expense_categories.toArray(),
          db.sales.where('date').equals(todayKey).toArray(),
          db.sales.where('date').between(monthRange.startDate, monthRange.endDate, true, true).toArray(),
        ])

        const categoryMap = new Map(expenseCategories.map((category) => [category.id, category.name]))
        const withCategory = (expense) => ({
          ...expense,
          categoryName: categoryMap.get(expense.expenseCategoryId) ?? 'Biaya operasional',
        })

        const expensesWithCategory = expenses.map(withCategory)
        const saleIds = sales.map((sale) => sale.id)
        // Hanya ambil detail item milik penjualan pada periode ini.
        const saleItems = saleIds.length > 0 ? await db.sale_items.where('saleId').anyOf(saleIds).toArray() : []

        return {
          summary: buildProfitSummary(sales, saleItems, expensesWithCategory),
          series: buildPeriodSeries(sales, expensesWithCategory, range),
          cash: computeCashBalances(accounts, cashTransactions),
          activeProducts: countActiveProducts(products),
          lowStock: findLowStockProducts(products),
          recent: buildRecentActivity(recentSales, recentExpenses.map(withCategory), 6),
          quick: {
            today: summarizeSales(todaySales).omzet,
            month: summarizeSales(monthSales).omzet,
          },
        }
      } catch (error) {
        return { error: error?.message ?? 'Data dashboard tidak dapat dimuat.' }
      }
    },
    [range.startDate, range.endDate],
    null,
  )

  return { data, range, isLoading: data === null }
}
