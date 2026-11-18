import { Plus, Receipt, Wallet, XCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { StatCard } from '../../components/ui/Card'
import { db } from '../../database/db'
import { listExpenses } from '../../database/repositories/expenseRepo'
import { toDateKey } from '../../utils/dates'
import { computeCashBalances } from '../../utils/finance'
import { formatRupiah } from '../../utils/money'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'

const TABS = [
  { value: 'daftar', label: 'Daftar pengeluaran' },
  { value: 'baru', label: 'Catat pengeluaran' },
]

export default function ExpensesPage() {
  const [tab, setTab] = useState('daftar')
  const monthKey = toDateKey().slice(0, 7)

  const data = useLiveQuery(async () => {
    const [expenses, accounts, cashTransactions] = await Promise.all([
      listExpenses({ month: monthKey }),
      db.cash_accounts.toArray(),
      db.cash_transactions.toArray(),
    ])

    return { expenses, cash: computeCashBalances(accounts, cashTransactions) }
  }, [monthKey])

  const completed = (data?.expenses ?? []).filter((expense) => expense.status !== 'dibatalkan')
  const total = completed.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const canceled = (data?.expenses?.length ?? 0) - completed.length

  return (
    <>
      <PageHeader
        title="Pengeluaran Usaha"
        description="Catat biaya operasional dengan kategori dan akun kas. Setiap pengeluaran mengurangi kas dan dapat dibatalkan lewat transaksi pembalik tanpa menghapus catatan."
        actions={
          tab === 'daftar' ? (
            <Button icon={Plus} onClick={() => setTab('baru')}>
              Catat pengeluaran
            </Button>
          ) : null
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Pengeluaran bulan ini"
          value={formatRupiah(total)}
          hint={`${completed.length} catatan aktif`}
          icon={Receipt}
          tone="expense"
        />
        <StatCard
          label="Transaksi"
          value={`${completed.length} catatan`}
          hint={canceled > 0 ? `${canceled} dibatalkan` : 'Tidak ada pembatalan'}
          icon={XCircle}
        />
        <StatCard
          label="Saldo kas"
          value={formatRupiah(data?.cash.total ?? 0)}
          hint="Seluruh akun kas aktif"
          icon={Wallet}
        />
      </div>

      <div className="segmented" role="tablist" aria-label="Bagian pengeluaran" style={{ marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`segmented__button ${tab === item.value ? 'segmented__button--active' : ''}`.trim()}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'daftar' ? <ExpenseList /> : <ExpenseForm onSaved={() => setTab('daftar')} />}
    </>
  )
}
