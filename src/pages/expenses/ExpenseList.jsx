import { Search, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import { Card, CardBody } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import { cancelExpense, listExpenses } from '../../database/repositories/expenseRepo'
import { formatLongDate, toDateKey } from '../../utils/dates'
import { formatRupiah } from '../../utils/money'

export default function ExpenseList() {
  const toast = useToast()
  const [filters, setFilters] = useState({ month: toDateKey().slice(0, 7), categoryId: '', search: '' })
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [canceling, setCanceling] = useState(false)

  const data = useLiveQuery(async () => {
    const [expenses, categories, accounts] = await Promise.all([
      listExpenses({ month: filters.month }),
      db.expense_categories.toArray(),
      db.cash_accounts.toArray(),
    ])

    return {
      expenses,
      categories: categories.sort((a, b) => a.name.localeCompare(b.name, 'id')),
      categoryMap: new Map(categories.map((category) => [category.id, category.name])),
      accountMap: new Map(accounts.map((account) => [account.id, account.name])),
    }
  }, [filters.month])

  const rows = useMemo(() => {
    if (!data) return []
    const search = filters.search.trim().toLowerCase()

    return data.expenses.filter((expense) => {
      if (filters.categoryId && expense.expenseCategoryId !== filters.categoryId) return false
      if (search && !expense.description.toLowerCase().includes(search)) return false
      return true
    })
  }, [data, filters])

  const total = rows
    .filter((expense) => expense.status !== 'dibatalkan')
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

  function openCancel(expense) {
    setReason('')
    setCancelTarget(expense)
  }

  async function handleCancel() {
    if (!cancelTarget) return
    if (reason.trim().length < 3) {
      toast.push('Alasan pembatalan minimal 3 karakter.', { tone: 'error' })
      return
    }

    setCanceling(true)
    try {
      await cancelExpense(cancelTarget.id, reason)
      toast.push('Pengeluaran dibatalkan dan kas sudah dikembalikan.')
      setCancelTarget(null)
      setReason('')
    } catch (error) {
      toast.push(error?.message ?? 'Pengeluaran gagal dibatalkan.', { tone: 'error' })
    } finally {
      setCanceling(false)
    }
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="muted">Memuat pengeluaran...</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardBody>
          <div className="toolbar toolbar--plain">
            <div className="toolbar__filters" style={{ flex: 1 }}>
              <div className="toolbar__search">
                <Search size={16} aria-hidden="true" />
                <input
                  className="input"
                  type="search"
                  placeholder="Cari keterangan pengeluaran"
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  aria-label="Cari pengeluaran"
                />
              </div>

              <input
                className="input"
                type="month"
                value={filters.month}
                onChange={(event) => setFilters({ ...filters, month: event.target.value })}
                aria-label="Bulan pengeluaran"
                style={{ width: 'auto' }}
              />

              <select
                className="select"
                value={filters.categoryId}
                onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}
                aria-label="Filter kategori"
              >
                <option value="">Semua kategori</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="muted">
              {rows.length} catatan - {formatRupiah(total)}
            </span>
          </div>

          {data.expenses.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Belum ada pengeluaran bulan ini"
              description="Catat biaya operasional seperti sewa, listrik, atau gaji agar laba bersih dan saldo kas akurat."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ada pengeluaran yang cocok"
              description="Ubah bulan, kategori, atau kata kunci pencarian."
            />
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table table--right">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    <th>Kategori</th>
                    <th>Akun kas</th>
                    <th>Nominal</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatLongDate(expense.date)}</td>
                      <td>{expense.description}</td>
                      <td className="muted">{data.categoryMap.get(expense.expenseCategoryId) ?? '-'}</td>
                      <td className="muted">{data.accountMap.get(expense.cashAccountId) ?? '-'}</td>
                      <td className="table__amount">{formatRupiah(expense.amount)}</td>
                      <td>
                        <Badge tone={expense.status === 'dibatalkan' ? 'gray' : 'green'}>
                          {expense.status === 'dibatalkan' ? 'Dibatalkan' : 'Selesai'}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          {expense.status !== 'dibatalkan' ? (
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Batalkan pengeluaran"
                              aria-label={`Batalkan ${expense.description}`}
                              onClick={() => openCancel(expense)}
                            >
                              <XCircle size={15} />
                            </button>
                          ) : (
                            <span className="text-soft">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Batalkan pengeluaran ini?"
        description={
          cancelTarget
            ? `Pengeluaran "${cancelTarget.description}" sebesar ${formatRupiah(cancelTarget.amount)} akan ditandai dibatalkan. Kas dikembalikan melalui mutasi masuk pembalik; catatan tidak dihapus.`
            : ''
        }
        confirmLabel="Batalkan pengeluaran"
        loading={canceling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      >
        <Field label="Alasan pembatalan" htmlFor="expenseCancelReason" required hint="Minimal 3 karakter.">
          <textarea
            id="expenseCancelReason"
            className="textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: salah input nominal"
            maxLength={200}
            rows={2}
          />
        </Field>
      </ConfirmDialog>
    </>
  )
}
