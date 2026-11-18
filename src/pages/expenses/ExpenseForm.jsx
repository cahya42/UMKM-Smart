import { Plus, Save, Wallet, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import {
  createExpense,
  createExpenseCategory,
  listExpenseCategories,
} from '../../database/repositories/expenseRepo'
import { computeCashBalances } from '../../utils/finance'
import { toDateKey } from '../../utils/dates'
import { formatRupiah } from '../../utils/money'
import { expenseCategorySchema, expenseSchema, toFieldErrors } from '../../utils/validation'

const EMPTY_FORM = {
  date: toDateKey(),
  expenseCategoryId: '',
  cashAccountId: '',
  amount: '',
  description: '',
  note: '',
}

export default function ExpenseForm({ onSaved }) {
  const toast = useToast()

  const data = useLiveQuery(async () => {
    const [categories, accounts, cashTransactions] = await Promise.all([
      listExpenseCategories(),
      db.cash_accounts.toArray(),
      db.cash_transactions.toArray(),
    ])

    return {
      categories,
      accounts: accounts.filter((account) => account.isActive !== false),
      cash: computeCashBalances(accounts, cashTransactions),
    }
  }, [])

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm((current) => {
      if (current.cashAccountId || data.accounts.length === 0) return current
      return { ...current, cashAccountId: data.accounts[0].id }
    })
  }, [data])

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      date: form.date,
      expenseCategoryId: form.expenseCategoryId,
      cashAccountId: form.cashAccountId,
      amount: Number(form.amount || 0),
      description: form.description,
      note: form.note,
    }

    const parsed = expenseSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push('Periksa kembali data pengeluaran yang ditandai merah.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      await createExpense(parsed.data)
      toast.push('Pengeluaran dicatat dan kas sudah dikurangi.')
      setForm((current) => ({ ...current, amount: '', description: '', note: '' }))
      setErrors({})
      onSaved?.()
    } catch (error) {
      toast.push(error?.message ?? 'Pengeluaran gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveCategory() {
    const parsed = expenseCategorySchema.safeParse({ name: categoryName })
    if (!parsed.success) {
      setCategoryError(parsed.error.issues[0]?.message ?? 'Nama kategori tidak valid.')
      return
    }

    setSavingCategory(true)
    try {
      const category = await createExpenseCategory(parsed.data)
      toast.push(`Kategori ${category.name} ditambahkan.`)
      setCategoryOpen(false)
      setCategoryName('')
      setCategoryError('')
      setField('expenseCategoryId', category.id)
    } catch (error) {
      setCategoryError(error?.message ?? 'Kategori gagal disimpan.')
    } finally {
      setSavingCategory(false)
    }
  }

  const account = data?.cash.accounts.find((item) => item.id === form.cashAccountId) ?? null

  return (
    <>
      <Card>
        <CardHeader
          title="Catat pengeluaran"
          subtitle="Biaya operasional mengurangi kas. Bila sudah menjadi komponen HPP, jangan dicatat lagi di sini."
          icon={Wallet}
        />
        <CardBody>
          {!data ? (
            <p className="muted">Memuat kategori dan akun kas...</p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid">
                <Field label="Tanggal" htmlFor="expenseDate" required error={errors.date}>
                  <input
                    id="expenseDate"
                    type="date"
                    className={`input ${errors.date ? 'input--error' : ''}`.trim()}
                    value={form.date}
                    onChange={(event) => setField('date', event.target.value)}
                    max={toDateKey()}
                  />
                </Field>

                <Field label="Nominal" htmlFor="expenseAmount" required error={errors.amount}>
                  <input
                    id="expenseAmount"
                    type="number"
                    min="1"
                    step="1"
                    className={`input ${errors.amount ? 'input--error' : ''}`.trim()}
                    value={form.amount}
                    onChange={(event) => setField('amount', event.target.value)}
                    placeholder="0"
                  />
                </Field>

                <Field
                  label="Kategori"
                  htmlFor="expenseCategory"
                  required
                  error={errors.expenseCategoryId}
                  className="form-grid__full"
                >
                  <div className="row" style={{ gap: 8 }}>
                    <select
                      id="expenseCategory"
                      className={`select ${errors.expenseCategoryId ? 'select--error' : ''}`.trim()}
                      value={form.expenseCategoryId}
                      onChange={(event) => setField('expenseCategoryId', event.target.value)}
                    >
                      <option value="">Pilih kategori</option>
                      {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      onClick={() => {
                        setCategoryError('')
                        setCategoryOpen(true)
                      }}
                    >
                      Kategori baru
                    </Button>
                  </div>
                </Field>

                <Field
                  label="Akun kas sumber dana"
                  htmlFor="expenseAccount"
                  required
                  error={errors.cashAccountId}
                  hint={account ? `Saldo saat ini ${formatRupiah(account.balance)}.` : undefined}
                >
                  <select
                    id="expenseAccount"
                    className={`select ${errors.cashAccountId ? 'select--error' : ''}`.trim()}
                    value={form.cashAccountId}
                    onChange={(event) => setField('cashAccountId', event.target.value)}
                  >
                    <option value="">Pilih akun kas</option>
                    {data.accounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Keterangan"
                  htmlFor="expenseDescription"
                  required
                  error={errors.description}
                  className="form-grid__full"
                >
                  <input
                    id="expenseDescription"
                    className={`input ${errors.description ? 'input--error' : ''}`.trim()}
                    value={form.description}
                    onChange={(event) => setField('description', event.target.value)}
                    placeholder="Contoh: sewa lapak bulan November"
                    maxLength={200}
                  />
                </Field>

                <Field label="Catatan" htmlFor="expenseNote" error={errors.note} className="form-grid__full" hint="Opsional.">
                  <textarea
                    id="expenseNote"
                    className={`textarea ${errors.note ? 'textarea--error' : ''}`.trim()}
                    value={form.note}
                    onChange={(event) => setField('note', event.target.value)}
                    placeholder="Contoh: dibayar tunai ke pemilik lapak"
                    maxLength={200}
                    rows={2}
                  />
                </Field>
              </div>

              {data.accounts.length === 0 ? (
                <div className="alert alert--danger" style={{ marginTop: 12 }}>
                  <span>Belum ada akun kas aktif, sehingga pengeluaran belum dapat dicatat.</span>
                </div>
              ) : null}

              <div className="form-actions">
                <Button type="submit" icon={Save} loading={saving} disabled={data.accounts.length === 0}>
                  Simpan pengeluaran
                </Button>
                <span className="form-note">Kas berkurang saat tersimpan dan tidak bisa dihapus, hanya dibatalkan.</span>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {categoryOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setCategoryOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Kategori pengeluaran baru"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <h3>Kategori pengeluaran baru</h3>
              <button
                type="button"
                className="icon-button icon-button--sm"
                onClick={() => setCategoryOpen(false)}
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>
            <div className="modal__content">
              <Field label="Nama kategori" htmlFor="newExpenseCategory" required error={categoryError}>
                <input
                  id="newExpenseCategory"
                  className={`input ${categoryError ? 'input--error' : ''}`.trim()}
                  value={categoryName}
                  onChange={(event) => {
                    setCategoryName(event.target.value)
                    setCategoryError('')
                  }}
                  placeholder="Contoh: Bahan bakar"
                  maxLength={60}
                />
              </Field>
              <div className="form-actions">
                <Button icon={Save} loading={savingCategory} onClick={handleSaveCategory}>
                  Simpan kategori
                </Button>
                <Button variant="secondary" onClick={() => setCategoryOpen(false)}>
                  Batal
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
