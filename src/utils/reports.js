import { formatLongDate } from './dates'
import { formatNumber, formatPercent, formatRupiah, percentage, toQuantity, toRupiah } from './money'
import { isCompletedExpense, isCompletedSale, summarizeExpenses, summarizeSales } from './finance'

/**
 * Definisi dan pembuat 9 laporan usaha (Tahap 5).
 * Semua perhitungan dilakukan di aplikasi dari data lokal; tidak ada data
 * yang dikirim ke layanan luar.
 */

export const REPORTS = [
  { id: 'laba-rugi', label: 'Laba rugi', description: 'Omzet, HPP, biaya operasional, dan laba bersih.' },
  { id: 'penjualan', label: 'Penjualan', description: 'Daftar nota beserta pelanggan, metode, dan total.' },
  { id: 'pengeluaran', label: 'Pengeluaran', description: 'Biaya operasional per kategori dan akun kas.' },
  { id: 'arus-kas', label: 'Arus kas', description: 'Uang masuk dan keluar dari seluruh akun kas.' },
  { id: 'saldo-kas', label: 'Saldo akun kas', description: 'Saldo awal, mutasi periode, dan saldo akhir per akun.' },
  { id: 'persediaan', label: 'Persediaan', description: 'Stok dan nilai persediaan berdasarkan HPP produk.' },
  { id: 'hpp', label: 'Riwayat HPP', description: 'Perhitungan HPP per produk pada periode.' },
  { id: 'produk-terlaris', label: 'Produk terlaris', description: 'Produk dengan omzet dan laba kotor tertinggi.' },
  { id: 'mutasi-stok', label: 'Mutasi stok', description: 'Kartu stok seluruh produk pada periode.' },
]

export const STOCK_TYPE_LABELS = {
  awal: 'Stok awal',
  masuk: 'Stok masuk',
  keluar: 'Stok keluar',
  penyesuaian: 'Penyesuaian',
  penjualan: 'Penjualan',
  pembatalan: 'Pembatalan',
}

function inRange(date, range) {
  return typeof date === 'string' && date >= range.startDate && date <= range.endDate
}

function byDateAsc(a, b) {
  return `${a.date}${a.createdAt ?? ''}`.localeCompare(`${b.date}${b.createdAt ?? ''}`)
}

function moneyColumn(key, label) {
  return { key, label, align: 'right' }
}

function emptyReport(def, range) {
  return {
    ...def,
    periodLabel: range.label,
    columns: [{ key: 'info', label: 'Informasi' }],
    rows: [{ info: 'Belum ada data pada periode ini.' }],
    summary: [],
    fileName: `laporan-${def.id}-${range.startDate}-${range.endDate}`,
  }
}

export function buildReport(id, data, range) {
  const def = REPORTS.find((report) => report.id === id) ?? REPORTS[0]
  const {
    sales = [],
    saleItems = [],
    expenses = [],
    cashAccounts = [],
    cashTransactions = [],
    products = [],
    units = [],
    movements = [],
    productCosts = [],
    expenseCategories = [],
  } = data ?? {}

  const accountMap = new Map(cashAccounts.map((account) => [account.id, account.name]))
  const productMap = new Map(products.map((product) => [product.id, product]))
  const unitMap = new Map(units.map((unit) => [unit.id, unit.name]))
  const expenseCategoryMap = new Map(expenseCategories.map((category) => [category.id, category.name]))

  const salesInPeriod = sales.filter((sale) => inRange(sale.date, range))
  const completedSales = salesInPeriod.filter(isCompletedSale)
  const completedSaleIds = new Set(completedSales.map((sale) => sale.id))
  const itemsInPeriod = saleItems.filter((item) => completedSaleIds.has(item.saleId))
  const expensesInPeriod = expenses.filter((expense) => inRange(expense.date, range))
  const activeExpenses = expensesInPeriod.filter(isCompletedExpense)

  switch (id) {
    case 'penjualan': {
      if (salesInPeriod.length === 0) return emptyReport(def, range)
      const rows = salesInPeriod
        .slice()
        .sort(byDateAsc)
        .map((sale) => ({
          tanggal: formatLongDate(sale.date),
          nota: sale.invoiceNumber,
          pelanggan: sale.customerName || 'Pelanggan umum',
          metode: sale.paymentMethod,
          item: formatNumber(sale.quantity ?? sale.itemCount ?? 0),
          total: formatRupiah(sale.total),
          status: sale.status === 'dibatalkan' ? 'Dibatalkan' : 'Selesai',
        }))
      const summary = summarizeSales(salesInPeriod, saleItems)
      return {
        ...def,
        periodLabel: range.label,
        columns: [
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'nota', label: 'No. nota' },
          { key: 'pelanggan', label: 'Pelanggan' },
          { key: 'metode', label: 'Metode' },
          moneyColumn('item', 'Qty'),
          moneyColumn('total', 'Total'),
          { key: 'status', label: 'Status' },
        ],
        rows,
        summary: [
          { label: 'Omzet', value: formatRupiah(summary.omzet), hint: `${summary.transactions} nota selesai` },
          { label: 'Total nota', value: `${salesInPeriod.length} nota`, hint: `${summary.itemsSold} item terjual` },
          { label: 'Rata-rata per nota', value: formatRupiah(summary.averageTransaction) },
        ],
        fileName: `laporan-penjualan-${range.startDate}-${range.endDate}`,
      }
    }

    case 'pengeluaran': {
      if (expensesInPeriod.length === 0) return emptyReport(def, range)
      const rows = expensesInPeriod
        .slice()
        .sort(byDateAsc)
        .map((expense) => ({
          tanggal: formatLongDate(expense.date),
          kategori: expenseCategoryMap.get(expense.expenseCategoryId) ?? '-',
          keterangan: expense.description,
          akun: accountMap.get(expense.cashAccountId) ?? '-',
          nominal: formatRupiah(expense.amount),
          status: expense.status === 'dibatalkan' ? 'Dibatalkan' : 'Selesai',
        }))
      const summary = summarizeExpenses(expensesInPeriod)
      return {
        ...def,
        periodLabel: range.label,
        columns: [
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'kategori', label: 'Kategori' },
          { key: 'keterangan', label: 'Keterangan' },
          { key: 'akun', label: 'Akun kas' },
          moneyColumn('nominal', 'Nominal'),
          { key: 'status', label: 'Status' },
        ],
        rows,
        summary: [
          { label: 'Total pengeluaran', value: formatRupiah(summary.total), hint: `${summary.count} catatan aktif` },
          { label: 'Catatan dibatalkan', value: `${expensesInPeriod.length - summary.count}` },
        ],
        fileName: `laporan-pengeluaran-${range.startDate}-${range.endDate}`,
      }
    }

    case 'arus-kas': {
      const rowsInPeriod = cashTransactions.filter((row) => inRange(row.date, range)).sort(byDateAsc)
      if (rowsInPeriod.length === 0) return emptyReport(def, range)

      let totalIn = 0
      let totalOut = 0
      const rows = rowsInPeriod.map((row) => {
        const amount = toRupiah(row.amount)
        if (row.type === 'masuk') totalIn += amount
        else totalOut += amount
        return {
          tanggal: formatLongDate(row.date),
          akun: accountMap.get(row.cashAccountId) ?? '-',
          keterangan: row.description,
          jenis: row.refType === 'transfer' ? 'Transfer' : row.type === 'masuk' ? 'Masuk' : 'Keluar',
          masuk: row.type === 'masuk' ? formatRupiah(amount) : '-',
          keluar: row.type === 'keluar' ? formatRupiah(amount) : '-',
        }
      })

      return {
        ...def,
        periodLabel: range.label,
        columns: [
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'akun', label: 'Akun kas' },
          { key: 'keterangan', label: 'Keterangan' },
          { key: 'jenis', label: 'Jenis' },
          moneyColumn('masuk', 'Masuk'),
          moneyColumn('keluar', 'Keluar'),
        ],
        rows,
        summary: [
          { label: 'Total masuk', value: formatRupiah(totalIn) },
          { label: 'Total keluar', value: formatRupiah(totalOut) },
          { label: 'Arus kas bersih', value: formatRupiah(totalIn - totalOut), hint: 'Bukan laba usaha' },
        ],
        fileName: `laporan-arus-kas-${range.startDate}-${range.endDate}`,
      }
    }

    case 'saldo-kas': {
      if (cashAccounts.length === 0) return emptyReport(def, range)
      let totalEnd = 0
      let totalIn = 0
      let totalOut = 0

      const rows = cashAccounts.map((account) => {
        let endBalance = toRupiah(account.openingBalance)
        let periodIn = 0
        let periodOut = 0

        for (const row of cashTransactions) {
          if (row.cashAccountId !== account.id) continue
          const amount = toRupiah(row.amount)
          if (row.date <= range.endDate) {
            endBalance += row.type === 'masuk' ? amount : -amount
          }
          if (inRange(row.date, range)) {
            if (row.type === 'masuk') periodIn += amount
            else periodOut += amount
          }
        }

        totalEnd += endBalance
        totalIn += periodIn
        totalOut += periodOut

        return {
          akun: account.name,
          jenis: account.type,
          awal: formatRupiah(account.openingBalance),
          masuk: formatRupiah(periodIn),
          keluar: formatRupiah(periodOut),
          akhir: formatRupiah(endBalance),
        }
      })

      return {
        ...def,
        periodLabel: `${range.label} (saldo per ${formatLongDate(range.endDate)})`,
        columns: [
          { key: 'akun', label: 'Akun' },
          { key: 'jenis', label: 'Jenis' },
          moneyColumn('awal', 'Saldo awal akun'),
          moneyColumn('masuk', 'Masuk periode'),
          moneyColumn('keluar', 'Keluar periode'),
          moneyColumn('akhir', 'Saldo akhir'),
        ],
        rows,
        summary: [
          { label: 'Total saldo akhir', value: formatRupiah(totalEnd), hint: 'Seluruh akun' },
          { label: 'Masuk periode', value: formatRupiah(totalIn) },
          { label: 'Keluar periode', value: formatRupiah(totalOut) },
        ],
        fileName: `laporan-saldo-kas-${range.endDate}`,
      }
    }

    case 'persediaan': {
      const stockProducts = products.filter(
        (product) => product.type === 'barang' && product.trackStock !== false,
      )
      if (stockProducts.length === 0) return emptyReport(def, range)

      let totalValue = 0
      let lowStock = 0
      const rows = stockProducts
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
        .map((product) => {
          const qty = toQuantity(product.stockQty)
          const value = toRupiah(qty * toRupiah(product.hpp))
          totalValue += value
          if (qty <= toQuantity(product.minStock)) lowStock += 1
          return {
            sku: product.sku || '-',
            produk: product.name,
            stok: formatNumber(qty),
            satuan: unitMap.get(product.unitId) ?? '-',
            hpp: formatRupiah(product.hpp),
            nilai: formatRupiah(value),
            status: product.isActive === false ? 'Nonaktif' : qty <= toQuantity(product.minStock) ? 'Menipis' : 'Aman',
          }
        })

      return {
        ...def,
        periodLabel: `Posisi per ${formatLongDate(range.endDate)}`,
        columns: [
          { key: 'sku', label: 'SKU' },
          { key: 'produk', label: 'Produk' },
          moneyColumn('stok', 'Stok' ),
          { key: 'satuan', label: 'Satuan' },
          moneyColumn('hpp', 'HPP/unit'),
          moneyColumn('nilai', 'Nilai stok'),
          { key: 'status', label: 'Status' },
        ],
        rows,
        summary: [
          { label: 'Nilai persediaan', value: formatRupiah(totalValue), hint: 'Stok x HPP' },
          { label: 'Jumlah produk', value: `${stockProducts.length} produk` },
          { label: 'Stok menipis', value: `${lowStock} produk` },
        ],
        fileName: `laporan-persediaan-${range.endDate}`,
      }
    }

    case 'hpp': {
      const costsInPeriod = productCosts
        .filter((cost) => inRange(cost.effectiveDate, range))
        .sort(byDateAsc)
      if (costsInPeriod.length === 0) return emptyReport(def, range)

      const rows = costsInPeriod.map((cost) => {
        const margin = percentage(toRupiah(cost.sellingPrice) - toRupiah(cost.unitCost), cost.sellingPrice)
        return {
          tanggal: formatLongDate(cost.effectiveDate),
          produk: cost.productName || productMap.get(cost.productId)?.name || '-',
          batch: formatNumber(cost.batchQuantity),
          total: formatRupiah(cost.totalCost),
          hpp: formatRupiah(cost.unitCost),
          jual: formatRupiah(cost.sellingPrice),
          margin: formatPercent(margin),
          target: formatPercent(cost.targetMargin ?? 0),
        }
      })

      return {
        ...def,
        periodLabel: range.label,
        columns: [
          { key: 'tanggal', label: 'Tanggal berlaku' },
          { key: 'produk', label: 'Produk' },
          moneyColumn('batch', 'Batch'),
          moneyColumn('total', 'Total biaya'),
          moneyColumn('hpp', 'HPP/unit'),
          moneyColumn('jual', 'Harga jual'),
          moneyColumn('margin', 'Margin'),
          moneyColumn('target', 'Target'),
        ],
        rows,
        summary: [
          { label: 'Perhitungan HPP', value: `${costsInPeriod.length}` },
          {
            label: 'Rata-rata HPP/unit',
            value: formatRupiah(
              costsInPeriod.reduce((sum, cost) => sum + toRupiah(cost.unitCost), 0) / costsInPeriod.length,
            ),
          },
        ],
        fileName: `laporan-hpp-${range.startDate}-${range.endDate}`,
      }
    }

    case 'produk-terlaris': {
      if (itemsInPeriod.length === 0) return emptyReport(def, range)
      const aggregate = new Map()
      for (const item of itemsInPeriod) {
        const key = item.productId
        const current = aggregate.get(key) ?? {
          productId: key,
          name: item.name || productMap.get(key)?.name || '-',
          qty: 0,
          omzet: 0,
          hpp: 0,
        }
        current.qty += toQuantity(item.qty)
        current.omzet += toRupiah(item.subtotal)
        current.hpp += toRupiah(Number(item.costPrice || 0) * Number(item.qty || 0))
        aggregate.set(key, current)
      }

      const aggregated = Array.from(aggregate.values()).sort((a, b) => b.omzet - a.omzet)
      const totalOmzet = aggregated.reduce((sum, item) => sum + item.omzet, 0)
      const rows = aggregated.map((item) => ({
        produk: item.name,
        qty: formatNumber(item.qty),
        omzet: formatRupiah(item.omzet),
        hpp: formatRupiah(item.hpp),
        laba: formatRupiah(item.omzet - item.hpp),
      }))

      return {
        ...def,
        periodLabel: range.label,
        columns: [
          { key: 'produk', label: 'Produk' },
          moneyColumn('qty', 'Qty terjual'),
          moneyColumn('omzet', 'Omzet'),
          moneyColumn('hpp', 'HPP'),
          moneyColumn('laba', 'Laba kotor'),
        ],
        rows,
        summary: [
          { label: 'Omzet item', value: formatRupiah(totalOmzet), hint: 'Sebelum diskon nota' },
          { label: 'Produk terjual', value: `${rows.length} produk` },
          { label: 'Terlaris', value: rows[0]?.produk ?? '-', hint: rows[0] ? `${rows[0].qty} qty` : '' },
        ],
        fileName: `laporan-produk-terlaris-${range.startDate}-${range.endDate}`,
      }
    }

    case 'mutasi-stok': {
      const movementsInPeriod = movements.filter((row) => inRange(row.date, range)).sort(byDateAsc)
      if (movementsInPeriod.length === 0) return emptyReport(def, range)

      const rows = movementsInPeriod.map((row) => ({
        tanggal: formatLongDate(row.date),
        produk: productMap.get(row.productId)?.name ?? '-',
        jenis: STOCK_TYPE_LABELS[row.type] ?? row.type,
        perubahan: `${row.change > 0 ? '+' : ''}${formatNumber(row.change)}`,
        saldo: formatNumber(row.balanceAfter),
        catatan: row.note || row.reason || '-',
      }))

      return {
        ...def,
        periodLabel: range.label,
        columns: [
          { key: 'tanggal', label: 'Tanggal' },
          { key: 'produk', label: 'Produk' },
          { key: 'jenis', label: 'Jenis' },
          moneyColumn('perubahan', 'Perubahan'),
          moneyColumn('saldo', 'Saldo akhir'),
          { key: 'catatan', label: 'Catatan' },
        ],
        rows,
        summary: [
          { label: 'Pergerakan stok', value: `${movementsInPeriod.length}` },
          { label: 'Produk bergerak', value: `${new Set(movementsInPeriod.map((row) => row.productId)).size} produk` },
        ],
        fileName: `laporan-mutasi-stok-${range.startDate}-${range.endDate}`,
      }
    }

    case 'laba-rugi':
    default: {
      if (salesInPeriod.length === 0 && expensesInPeriod.length === 0) return emptyReport(def, range)

      const salesSummary = summarizeSales(salesInPeriod, saleItems)
      const expenseSummary = summarizeExpenses(expensesInPeriod)
      const netProfit = salesSummary.grossProfit - expenseSummary.total

      const expenseByCategory = new Map()
      for (const expense of activeExpenses) {
        const name = expenseCategoryMap.get(expense.expenseCategoryId) ?? 'Lainnya'
        expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + toRupiah(expense.amount))
      }

      const rows = [
        { uraian: 'Omzet penjualan', jenis: 'Pendapatan', nilai: formatRupiah(salesSummary.omzet) },
        { uraian: 'Diskon yang diberikan', jenis: 'Informasi', nilai: formatRupiah(salesSummary.discounts) },
        { uraian: 'HPP barang/jasa terjual', jenis: 'Biaya langsung', nilai: formatRupiah(salesSummary.hpp) },
        { uraian: 'Laba kotor', jenis: 'Subtotal', nilai: formatRupiah(salesSummary.grossProfit) },
        ...Array.from(expenseByCategory.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, total]) => ({
            uraian: name,
            jenis: 'Biaya operasional',
            nilai: formatRupiah(total),
          })),
        {
          uraian: 'Total biaya operasional',
          jenis: 'Subtotal',
          nilai: formatRupiah(expenseSummary.total),
        },
        { uraian: 'Laba bersih (estimasi)', jenis: 'Hasil', nilai: formatRupiah(netProfit) },
      ]

      return {
        ...def,
        periodLabel: range.label,
        columns: [
          { key: 'uraian', label: 'Uraian' },
          { key: 'jenis', label: 'Kelompok' },
          moneyColumn('nilai', 'Nilai'),
        ],
        rows,
        summary: [
          { label: 'Omzet', value: formatRupiah(salesSummary.omzet), hint: `${salesSummary.transactions} nota` },
          { label: 'Laba kotor', value: formatRupiah(salesSummary.grossProfit), hint: `Margin ${formatPercent(salesSummary.margin)}` },
          { label: 'Laba bersih', value: formatRupiah(netProfit), hint: 'Setelah biaya operasional' },
        ],
        fileName: `laporan-laba-rugi-${range.startDate}-${range.endDate}`,
      }
    }
  }
}
