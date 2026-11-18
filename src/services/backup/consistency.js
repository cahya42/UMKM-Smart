import { db } from '../../database/db'
import { toQuantity, toRupiah } from '../../utils/money'

/**
 * Pemeriksaan konsistensi data (read-only). Tidak memperbaiki apa pun;
 * hasilnya dipakai pengguna untuk memutuskan pemulihan atau koreksi.
 */

function groupBy(rows, key) {
  const map = new Map()
  for (const row of rows) {
    const value = row[key]
    const list = map.get(value) ?? []
    list.push(row)
    map.set(value, list)
  }
  return map
}

function sameMoney(a, b) {
  return toRupiah(a) === toRupiah(b)
}

export async function runConsistencyCheck() {
  const [
    products,
    movements,
    sales,
    saleItems,
    expenses,
    cashAccounts,
    cashTransactions,
    productCosts,
    costComponents,
  ] = await Promise.all([
    db.products.toArray(),
    db.stock_movements.toArray(),
    db.sales.toArray(),
    db.sale_items.toArray(),
    db.expenses.toArray(),
    db.cash_accounts.toArray(),
    db.cash_transactions.toArray(),
    db.product_costs.toArray(),
    db.cost_components.toArray(),
  ])

  const issues = []
  const addIssue = (id, severity, title, description, rows) => {
    if (rows.length === 0) return
    issues.push({
      id,
      severity,
      title,
      description,
      count: rows.length,
      samples: rows.slice(0, 5).map((row) => row.label),
    })
  }

  // 1. Stok negatif.
  addIssue(
    'negative-stock',
    'error',
    'Stok negatif',
    'Stok tidak boleh kurang dari nol.',
    products
      .filter((product) => toQuantity(product.stockQty) < 0)
      .map((product) => ({ label: `${product.name}: ${toQuantity(product.stockQty)}` })),
  )

  // 2. Saldo kartu stok terakhir vs stok produk.
  const movementsByProduct = groupBy(movements, 'productId')
  const stockMismatch = []
  for (const product of products) {
    if (product.type !== 'barang' || product.trackStock === false) continue
    const list = (movementsByProduct.get(product.id) ?? [])
      .slice()
      .sort((a, b) => `${a.date} ${a.createdAt ?? ''}`.localeCompare(`${b.date} ${b.createdAt ?? ''}`))
    const last = list[list.length - 1]
    const expected = last ? toQuantity(last.balanceAfter) : 0
    if (toQuantity(product.stockQty) !== expected) {
      stockMismatch.push({
        label: `${product.name}: stok ${toQuantity(product.stockQty)}, kartu ${expected}`,
      })
    }
  }
  addIssue(
    'stock-balance',
    'error',
    'Stok tidak sama dengan kartu stok',
    'Saldo akhir kartu stok berbeda dari stok produk.',
    stockMismatch,
  )

  // 3. Aritmetika saldo pergerakan stok.
  const brokenMovements = movements
    .filter((movement) => {
      const change = Number(movement.change)
      return (
        !Number.isFinite(change) ||
        Math.abs(toQuantity(movement.balanceBefore) + change - toQuantity(movement.balanceAfter)) > 0.001
      )
    })
    .map((movement) => ({ label: `${movement.type} ${movement.date}: ${movement.balanceBefore} + ${movement.change} != ${movement.balanceAfter}` }))
  addIssue(
    'movement-arithmetic',
    'error',
    'Saldo pergerakan stok tidak konsisten',
    'balanceBefore + perubahan harus sama dengan balanceAfter.',
    brokenMovements,
  )

  // 4. Total penjualan dari item.
  const itemsBySale = groupBy(saleItems, 'saleId')
  const saleTotals = []
  for (const sale of sales) {
    const items = itemsBySale.get(sale.id) ?? []
    const subtotal = items.reduce((sum, item) => sum + toRupiah(item.subtotal), 0)
    const totalCost = items.reduce((sum, item) => sum + toRupiah(Number(item.costPrice) * Number(item.qty)), 0)
    const expectedTotal = subtotal - toRupiah(sale.discount)

    if (!sameMoney(subtotal, sale.subtotal) || !sameMoney(expectedTotal, sale.total) || !sameMoney(totalCost, sale.totalCost)) {
      saleTotals.push({
        label: `${sale.invoiceNumber}: subtotal ${sale.subtotal}/${subtotal}, total ${sale.total}/${expectedTotal}, HPP ${sale.totalCost}/${totalCost}`,
      })
    }
  }
  addIssue(
    'sale-totals',
    'error',
    'Total penjualan tidak sesuai item',
    'Subtotal, total, atau HPP pada nota berbeda dari jumlah itemnya.',
    saleTotals,
  )

  // 5. Kas penjualan.
  const cashBySale = groupBy(
    cashTransactions.filter((row) => row.refType === 'sale' || row.refType === 'sale_cancel'),
    'refId',
  )
  const saleCash = []
  for (const sale of sales) {
    if (toRupiah(sale.total) <= 0) continue
    const rows = cashBySale.get(sale.id) ?? []
    const income = rows.find((row) => row.refType === 'sale')
    const reversal = rows.find((row) => row.refType === 'sale_cancel')

    if (!income || !sameMoney(income.amount, sale.total)) {
      saleCash.push({ label: `${sale.invoiceNumber}: kas masuk tidak cocok` })
    }
    if (sale.status === 'dibatalkan' && (!reversal || !sameMoney(reversal.amount, sale.total))) {
      saleCash.push({ label: `${sale.invoiceNumber}: kas pembalik tidak ada/tidak cocok` })
    }
    if (sale.status !== 'dibatalkan' && reversal) {
      saleCash.push({ label: `${sale.invoiceNumber}: ada pembalik padahal nota selesai` })
    }
  }
  addIssue(
    'sale-cash',
    'error',
    'Kas penjualan tidak sesuai nota',
    'Mutasi kas masuk atau pembalik tidak cocok dengan nota.',
    saleCash,
  )

  // 6. Kas pengeluaran.
  const cashByExpense = groupBy(
    cashTransactions.filter((row) => row.refType === 'expense' || row.refType === 'expense_cancel'),
    'refId',
  )
  const expenseCash = []
  for (const expense of expenses) {
    const rows = cashByExpense.get(expense.id) ?? []
    const out = rows.find((row) => row.refType === 'expense')
    const reversal = rows.find((row) => row.refType === 'expense_cancel')

    if (!out || !sameMoney(out.amount, expense.amount)) {
      expenseCash.push({ label: `${expense.description}: kas keluar tidak cocok` })
    }
    if (expense.status === 'dibatalkan' && (!reversal || !sameMoney(reversal.amount, expense.amount))) {
      expenseCash.push({ label: `${expense.description}: kas pembalik tidak ada/tidak cocok` })
    }
  }
  addIssue(
    'expense-cash',
    'error',
    'Kas pengeluaran tidak sesuai catatan',
    'Mutasi kas keluar atau pembalik tidak cocok dengan pengeluaran.',
    expenseCash,
  )

  // 7. Data yatim.
  const saleIds = new Set(sales.map((row) => row.id))
  const productIds = new Set(products.map((row) => row.id))
  const accountIds = new Set(cashAccounts.map((row) => row.id))
  const costIds = new Set(productCosts.map((row) => row.id))

  addIssue(
    'orphan-sale-items',
    'warning',
    'Item penjualan tanpa nota',
    'Item tidak memiliki header penjualan.',
    saleItems.filter((row) => !saleIds.has(row.saleId)).map((row) => ({ label: `${row.name} (${row.saleId})` })),
  )
  addIssue(
    'orphan-movements',
    'warning',
    'Pergerakan stok tanpa produk',
    'Kartu stok merujuk produk yang tidak ada.',
    movements.filter((row) => !productIds.has(row.productId)).map((row) => ({ label: `${row.type} ${row.date}` })),
  )
  addIssue(
    'orphan-cash',
    'warning',
    'Mutasi kas tanpa akun',
    'Mutasi kas merujuk akun yang tidak ada.',
    cashTransactions
      .filter((row) => !accountIds.has(row.cashAccountId))
      .map((row) => ({ label: `${row.description} (${row.cashAccountId})` })),
  )
  addIssue(
    'orphan-costs',
    'warning',
    'Komponen HPP tanpa perhitungan',
    'Komponen biaya merujuk perhitungan yang tidak ada.',
    costComponents.filter((row) => !costIds.has(row.productCostId)).map((row) => ({ label: row.name })),
  )

  // 8. Nomor nota dan SKU ganda.
  const invoiceCounts = new Map()
  for (const sale of sales) invoiceCounts.set(sale.invoiceNumber, (invoiceCounts.get(sale.invoiceNumber) ?? 0) + 1)
  addIssue(
    'duplicate-invoice',
    'error',
    'Nomor nota ganda',
    'Setiap nota harus memiliki nomor unik.',
    [...invoiceCounts.entries()].filter(([, count]) => count > 1).map(([number]) => ({ label: number })),
  )

  const skuCounts = new Map()
  for (const product of products) {
    if (!product.sku) continue
    skuCounts.set(product.sku, (skuCounts.get(product.sku) ?? 0) + 1)
  }
  addIssue(
    'duplicate-sku',
    'warning',
    'SKU produk ganda',
    'SKU sebaiknya unik agar pencarian produk tidak membingungkan.',
    [...skuCounts.entries()].filter(([, count]) => count > 1).map(([sku]) => ({ label: sku })),
  )

  // 9. HPP dari komponen.
  const componentsByCost = groupBy(costComponents, 'productCostId')
  const brokenCosts = []
  for (const cost of productCosts) {
    const components = componentsByCost.get(cost.id) ?? []
    const total = components.reduce((sum, row) => sum + toRupiah(row.subtotal), 0)
    const unitCost = toRupiah(total / Number(cost.batchQuantity || 1))
    if (!sameMoney(total, cost.totalCost) || !sameMoney(unitCost, cost.unitCost)) {
      brokenCosts.push({
        label: `${cost.productName}: total ${cost.totalCost}/${total}, HPP ${cost.unitCost}/${unitCost}`,
      })
    }
  }
  addIssue(
    'product-costs',
    'warning',
    'HPP tidak sesuai komponen',
    'Total atau HPP per unit berbeda dari jumlah komponen biaya.',
    brokenCosts,
  )

  return {
    checkedAt: new Date().toISOString(),
    issues,
    errorCount: issues.filter((issue) => issue.severity === 'error').reduce((sum, issue) => sum + issue.count, 0),
    warningCount: issues.filter((issue) => issue.severity === 'warning').reduce((sum, issue) => sum + issue.count, 0),
    stats: {
      products: products.length,
      movements: movements.length,
      sales: sales.length,
      expenses: expenses.length,
      cashTransactions: cashTransactions.length,
      productCosts: productCosts.length,
    },
  }
}
