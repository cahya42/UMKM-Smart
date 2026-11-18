import { db } from '../../database/db'
import { buildProfitSummary, computeCashBalances, findLowStockProducts } from '../../utils/finance'
import { formatNumber, formatPercent, formatRupiah, percentage, toQuantity, toRupiah } from '../../utils/money'

/**
 * Menyusun ringkasan kontekstual untuk SMART ADVISOR.
 *
 * Seluruh angka dihitung di aplikasi dari data lokal (utils/finance.js dan
 * utils/money.js). Yang disiapkan di sini adalah teks ringkasan berukuran
 * kecil, bukan isi database, sehingga pengguna dapat meninjau dan menyetujui
 * isi kiriman sebelum apa pun meninggalkan perangkat.
 */

export const ADVISOR_EXCLUDED_DATA = [
  'Nama, nomor telepon, dan email pelanggan atau pemasok',
  'Alamat, email, dan nomor telepon pada profil usaha',
  'Token lisensi, ID perangkat, dan kunci API penyedia AI',
  'Isi tabel database secara utuh (hanya ringkasan angka di bawah ini)',
]

const FOCUS_RULES = [
  {
    id: 'penjualan',
    label: 'Penjualan & pelanggan',
    keywords: ['jual', 'omzet', 'omset', 'laris', 'pelanggan', 'promosi', 'diskon', 'menu'],
  },
  {
    id: 'laba',
    label: 'Laba & margin',
    keywords: ['laba', 'untung', 'rugi', 'margin', 'profit', 'target'],
  },
  {
    id: 'hpp',
    label: 'HPP & harga jual',
    keywords: ['hpp', 'harga', 'modal', 'bahan', 'resep', 'komponen'],
  },
  {
    id: 'stok',
    label: 'Persediaan',
    keywords: ['stok', 'persediaan', 'gudang', 'restock', 'kulakan', 'habis', 'menipis'],
  },
  {
    id: 'biaya',
    label: 'Biaya operasional',
    keywords: ['biaya', 'pengeluaran', 'sewa', 'gaji', 'listrik', 'hemat', 'efisiensi', 'operasional'],
  },
  {
    id: 'kas',
    label: 'Kas & arus kas',
    keywords: ['kas', 'saldo', 'arus', 'uang masuk', 'uang keluar', 'transfer', 'rekening'],
  },
]

/** Menebak topik pertanyaan dari kata kunci sederhana (tanpa layanan luar). */
export function detectFocus(question = '') {
  const text = String(question).toLowerCase()
  let best = { id: 'umum', label: 'Gambaran umum usaha', score: 0 }

  for (const rule of FOCUS_RULES) {
    const score = rule.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0)
    if (score > best.score) best = { id: rule.id, label: rule.label, score }
  }

  return { id: best.id, label: best.label }
}

/** Membaca hanya tabel yang dibutuhkan untuk ringkasan usaha. */
export async function loadAdvisorData() {
  const [
    profile,
    sales,
    saleItems,
    expenses,
    cashAccounts,
    cashTransactions,
    products,
    units,
    expenseCategories,
  ] = await Promise.all([
    db.business_profile.get('primary'),
    db.sales.toArray(),
    db.sale_items.toArray(),
    db.expenses.toArray(),
    db.cash_accounts.toArray(),
    db.cash_transactions.toArray(),
    db.products.toArray(),
    db.units.toArray(),
    db.expense_categories.toArray(),
  ])

  return {
    profile: profile ?? null,
    sales,
    saleItems,
    expenses,
    cashAccounts,
    cashTransactions,
    products,
    units,
    expenseCategories,
  }
}

function inRange(date, range) {
  return typeof date === 'string' && date >= range.startDate && date <= range.endDate
}

function aggregateProducts(items, products) {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const aggregate = new Map()

  for (const item of items) {
    const current = aggregate.get(item.productId) ?? {
      productId: item.productId,
      name: item.name || productMap.get(item.productId)?.name || 'Produk',
      qty: 0,
      omzet: 0,
      hpp: 0,
    }
    current.qty += toQuantity(item.qty)
    current.omzet += toRupiah(item.subtotal)
    current.hpp += toRupiah(Number(item.costPrice || 0) * Number(item.qty || 0))
    aggregate.set(item.productId, current)
  }

  return Array.from(aggregate.values())
    .map((row) => ({ ...row, profit: row.omzet - row.hpp }))
    .sort((a, b) => b.omzet - a.omzet)
}

/**
 * @param {object} data hasil loadAdvisorData()
 * @param {{startDate:string,endDate:string,label:string}} range periode ringkasan
 * @param {string} question pertanyaan pengguna (untuk memilih fokus)
 */
export function buildAdvisorContext(data, range, question = '') {
  const safeData = data ?? {}
  const focus = detectFocus(question)

  const sales = (safeData.sales ?? []).filter((sale) => inRange(sale.date, range))
  const expenses = (safeData.expenses ?? []).filter((expense) => inRange(expense.date, range))
  const profit = buildProfitSummary(sales, safeData.saleItems ?? [], expenses)

  const completedSaleIds = new Set(
    sales.filter((sale) => sale.status !== 'dibatalkan').map((sale) => sale.id),
  )
  const soldItems = (safeData.saleItems ?? []).filter((item) => completedSaleIds.has(item.saleId))
  const products = safeData.products ?? []
  const productMap = new Map(products.map((product) => [product.id, product]))
  const unitMap = new Map((safeData.units ?? []).map((unit) => [unit.id, unit.name]))
  const categoryMap = new Map(
    (safeData.expenseCategories ?? []).map((category) => [category.id, category.name]),
  )

  const topProducts = aggregateProducts(soldItems, products).slice(0, 5)

  const lowStock = findLowStockProducts(products)
    .map((product) => ({
      name: product.name,
      qty: toQuantity(product.stockQty),
      min: toQuantity(product.minStock),
      unit: unitMap.get(product.unitId) ?? '',
    }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 5)

  const lowestMargin = products
    .filter(
      (product) =>
        product.isActive !== false && toRupiah(product.sellingPrice) > 0 && toRupiah(product.hpp) >= 0,
    )
    .map((product) => ({
      name: product.name,
      sellingPrice: toRupiah(product.sellingPrice),
      hpp: toRupiah(product.hpp),
      margin: percentage(toRupiah(product.sellingPrice) - toRupiah(product.hpp), product.sellingPrice),
    }))
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 3)

  const expenseByCategory = new Map()
  for (const expense of expenses.filter((row) => row.status !== 'dibatalkan')) {
    const name = categoryMap.get(expense.expenseCategoryId) ?? 'Lainnya'
    expenseByCategory.set(name, (expenseByCategory.get(name) ?? 0) + toRupiah(expense.amount))
  }
  const topExpenses = Array.from(expenseByCategory.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)

  const allCash = computeCashBalances(safeData.cashAccounts ?? [], safeData.cashTransactions ?? [])
  const accounts = allCash.accounts
    .filter((account) => account.isActive !== false || account.balance !== 0)
    .slice(0, 8)

  const stockValue = products
    .filter((product) => product.type === 'barang' && product.trackStock !== false && product.isActive !== false)
    .reduce((total, product) => total + toQuantity(product.stockQty) * toRupiah(product.hpp), 0)

  const facts = {
    periodLabel: range.label,
    startDate: range.startDate,
    endDate: range.endDate,
    businessName: safeData.profile?.businessName ?? '',
    businessType: safeData.profile?.businessType ?? '',
    omzet: profit.omzet,
    hpp: profit.hpp,
    grossProfit: profit.grossProfit,
    margin: profit.margin,
    operatingExpenses: profit.operatingExpenses,
    netProfit: profit.netProfit,
    netMargin: profit.netMargin,
    transactions: profit.transactions,
    itemsSold: profit.itemsSold,
    averageTransaction: profit.averageTransaction,
    topProducts,
    lowStock,
    lowestMargin,
    topExpenses,
    cashTotal: allCash.total,
    accounts,
    stockValue,
    productCount: products.filter((product) => product.isActive !== false).length,
  }

  const lines = []
  const add = (line = '') => lines.push(line)

  add('RINGKASAN USAHA (dihitung aplikasi UMKM SMART, bukan data mentah)')
  add(`Periode: ${range.startDate} sampai ${range.endDate} (${range.label})`)
  add(
    `Profil: ${facts.businessName || 'belum diisi'}${
      facts.businessType ? ` (${facts.businessType})` : ''
    }`,
  )
  add(`Fokus pertanyaan: ${focus.label}`)
  add('')

  add('KEUANGAN PERIODE')
  add(`- Omzet: ${formatRupiah(facts.omzet)} dari ${facts.transactions} nota selesai`)
  add(`- HPP barang/jasa terjual: ${formatRupiah(facts.hpp)}`)
  add(
    `- Laba kotor: ${formatRupiah(facts.grossProfit)} (margin ${formatPercent(facts.margin)})`,
  )
  add(
    `- Biaya operasional: ${formatRupiah(facts.operatingExpenses)} dari ${profit.expenseCount} catatan`,
  )
  add(
    `- Estimasi laba bersih: ${formatRupiah(facts.netProfit)}${
      facts.netProfit < 0 ? ' (rugi)' : ''
    }`,
  )
  add(
    `- Rata-rata nilai nota: ${formatRupiah(facts.averageTransaction)}; item terjual: ${formatNumber(
      facts.itemsSold,
    )}`,
  )
  add('')

  add('BIAYA OPERASIONAL TERBESAR')
  if (topExpenses.length === 0) {
    add('- Tidak ada pengeluaran tercatat pada periode ini')
  } else {
    for (const expense of topExpenses) add(`- ${expense.name}: ${formatRupiah(expense.total)}`)
  }
  add('')

  add('PRODUK TERATAS BERDASARKAN OMZET PERIODE')
  if (topProducts.length === 0) {
    add('- Belum ada item terjual pada periode ini')
  } else {
    topProducts.forEach((product, index) => {
      add(
        `${index + 1}. ${product.name}: ${formatNumber(product.qty)} qty, omzet ${formatRupiah(
          product.omzet,
        )}, laba kotor ${formatRupiah(product.profit)}`,
      )
    })
  }
  add('')

  add('STOK PERLU PERHATIAN (posisi saat ini)')
  if (lowStock.length === 0) {
    add('- Tidak ada produk yang menyentuh batas minimum stok')
  } else {
    for (const product of lowStock) {
      add(
        `- ${product.name}: ${formatNumber(product.qty)} ${product.unit} (minimum ${formatNumber(
          product.min,
        )} ${product.unit})`.trim(),
      )
    }
  }
  add('')

  add('HARGA JUAL DAN MARGIN TERENDAH (produk aktif)')
  if (lowestMargin.length === 0) {
    add('- Belum ada produk dengan harga jual')
  } else {
    for (const product of lowestMargin) {
      add(
        `- ${product.name}: harga jual ${formatRupiah(product.sellingPrice)}, HPP ${formatRupiah(
          product.hpp,
        )}, margin ${formatPercent(product.margin)}`,
      )
    }
  }
  add('')

  add('KAS (posisi saat ini, bukan laba)')
  if (accounts.length === 0) {
    add('- Belum ada akun kas')
  } else {
    for (const account of accounts) add(`- ${account.name}: ${formatRupiah(account.balance)}`)
    add(`- Total saldo kas: ${formatRupiah(facts.cashTotal)}`)
  }
  add(`- Nilai persediaan (stok x HPP): ${formatRupiah(stockValue)}`)
  add('')
  add(
    'Catatan: ringkasan ini tidak memuat nama pelanggan, kontak, alamat, token lisensi, atau isi database.',
  )

  const counts = [
    {
      label: 'Laba rugi periode',
      detail: `${facts.transactions} nota, ${profit.expenseCount} pengeluaran`,
    },
    { label: 'Produk teratas', detail: `${topProducts.length} produk` },
    { label: 'Stok perlu perhatian', detail: `${lowStock.length} produk` },
    { label: 'Harga & margin terendah', detail: `${lowestMargin.length} produk` },
    { label: 'Biaya operasional terbesar', detail: `${topExpenses.length} kategori` },
    { label: 'Saldo kas', detail: `${accounts.length} akun` },
  ]

  return {
    generatedAt: new Date().toISOString(),
    focus,
    periodLabel: range.label,
    startDate: range.startDate,
    endDate: range.endDate,
    text: lines.join('\n'),
    fields: [
      { label: 'Periode', value: range.label },
      { label: 'Omzet', value: formatRupiah(facts.omzet) },
      { label: 'Laba bersih', value: formatRupiah(facts.netProfit) },
      { label: 'Fokus', value: focus.label },
      { label: 'Produk teratas', value: `${topProducts.length} produk` },
      { label: 'Stok menipis', value: `${lowStock.length} produk` },
    ],
    counts,
    facts,
  }
}
