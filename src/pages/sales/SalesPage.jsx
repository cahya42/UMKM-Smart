import { Plus, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import PageHeader from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/Card'
import { db } from '../../database/db'
import { toDateKey } from '../../utils/dates'
import { computeCashBalances } from '../../utils/finance'
import { formatRupiah } from '../../utils/money'
import { summarizeSalesList } from '../../utils/sales'
import SaleList from './SaleList'

export default function SalesPage() {
  const monthKey = toDateKey().slice(0, 7)

  const data = useLiveQuery(async () => {
    const [sales, accounts, cashTransactions] = await Promise.all([
      db.sales.where('date').between(`${monthKey}-01`, `${monthKey}-31`, true, true).toArray(),
      db.cash_accounts.toArray(),
      db.cash_transactions.toArray(),
    ])
    return { sales, cash: computeCashBalances(accounts, cashTransactions) }
  }, [monthKey])

  const summary = summarizeSalesList(data?.sales ?? [])

  return (
    <>
      <PageHeader
        title="Penjualan"
        description="Catat penjualan barang dan jasa. Stok berkurang dan kas bertambah otomatis; pembatalan mengembalikan keduanya lewat transaksi pembalik, bukan menghapus riwayat."
        actions={
          <Link to="/penjualan/baru" className="btn btn--primary">
            <Plus size={16} aria-hidden="true" />
            Transaksi baru
          </Link>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Omzet bulan ini"
          value={formatRupiah(summary.omzet)}
          hint={`${summary.transactions} transaksi selesai`}
          icon={Receipt}
          tone="cash"
        />
        <StatCard
          label="Laba kotor"
          value={formatRupiah(summary.grossProfit)}
          hint="Omzet dikurangi HPP terjual"
          icon={TrendingUp}
          tone="profit"
        />
        <StatCard
          label="Transaksi"
          value={`${summary.transactions} nota`}
          hint={summary.canceled > 0 ? `${summary.canceled} dibatalkan` : 'Tidak ada pembatalan'}
          icon={ShoppingCart}
        />
        <StatCard
          label="Saldo kas"
          value={formatRupiah(data?.cash.total ?? 0)}
          hint="Seluruh akun kas aktif"
          icon={Wallet}
        />
      </div>

      <SaleList />
    </>
  )
}
