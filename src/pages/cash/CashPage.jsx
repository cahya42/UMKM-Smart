import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Pencil,
  Plus,
  Power,
  Wallet,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import PageHeader from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import {
  CASH_ACCOUNT_TYPES,
  CASH_ACCOUNT_TYPE_LABELS,
  CASH_REF_LABELS,
  createCashAccount,
  listCashAccounts,
  listCashTransactions,
  setCashAccountActive,
  transferCash,
  updateCashAccount,
} from '../../database/repositories/cashRepo'
import { formatLongDate, formatMonthLabel, toDateKey } from '../../utils/dates'
import { formatRupiah, toRupiah } from '../../utils/money'
import {
  cashAccountSchema,
  cashTransferSchema,
  toFieldErrors,
} from '../../utils/validation'

const EMPTY_ACCOUNT = { name: '', type: 'tunai', openingBalance: '', note: '' }
const EMPTY_TRANSFER = {
  date: toDateKey(),
  fromAccountId: '',
  toAccountId: '',
  amount: '',
  note: '',
}

function AccountDialog({ account, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(
    account
      ? {
          name: account.name,
          type: account.type,
          openingBalance: String(account.openingBalance ?? 0),
          note: account.note ?? '',
        }
      : EMPTY_ACCOUNT,
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit() {
    const parsed = cashAccountSchema.safeParse({
      name: form.name,
      type: form.type,
      openingBalance: Number(form.openingBalance || 0),
      note: form.note,
    })

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push('Periksa kembali data akun kas.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      if (account) {
        await updateCashAccount(account.id, parsed.data)
        toast.push(`Akun ${parsed.data.name} diperbarui.`)
      } else {
        await createCashAccount(parsed.data)
        toast.push(`Akun ${parsed.data.name} ditambahkan.`)
      }
      onSaved()
      onClose()
    } catch (error) {
      toast.push(error?.message ?? 'Akun kas gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={account ? 'Ubah akun kas' : 'Tambah akun kas'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h3>{account ? 'Ubah akun kas' : 'Tambah akun kas'}</h3>
          <button type="button" className="icon-button icon-button--sm" onClick={onClose} aria-label="Tutup">
            <X size={17} />
          </button>
        </div>
        <div className="modal__content">
          <div className="form-grid">
            <Field label="Nama akun" htmlFor="cashAccountName" required error={errors.name} className="form-grid__full">
              <input
                id="cashAccountName"
                className={`input ${errors.name ? 'input--error' : ''}`.trim()}
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="Contoh: BCA Usaha"
                maxLength={60}
              />
            </Field>

            <Field label="Jenis akun" htmlFor="cashAccountType" required error={errors.type}>
              <select
                id="cashAccountType"
                className="select"
                value={form.type}
                onChange={(event) => setField('type', event.target.value)}
              >
                {CASH_ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Saldo awal"
              htmlFor="cashAccountOpening"
              required
              error={errors.openingBalance}
              hint="Saldo saat akun mulai dipakai."
            >
              <input
                id="cashAccountOpening"
                type="number"
                min="0"
                step="1"
                className={`input ${errors.openingBalance ? 'input--error' : ''}`.trim()}
                value={form.openingBalance}
                onChange={(event) => setField('openingBalance', event.target.value)}
                placeholder="0"
              />
            </Field>

            <Field label="Catatan" htmlFor="cashAccountNote" error={errors.note} className="form-grid__full">
              <textarea
                id="cashAccountNote"
                className="textarea"
                value={form.note}
                onChange={(event) => setField('note', event.target.value)}
                placeholder="Contoh: rekening operasional harian"
                maxLength={200}
                rows={2}
              />
            </Field>
          </div>

          {account ? (
            <div className="alert alert--warning" style={{ marginTop: 12 }}>
              <span>
                Mengubah saldo awal akan menggeser seluruh saldo akun ini. Riwayat mutasi tidak berubah dan
                perubahan dicatat di audit log.
              </span>
            </div>
          ) : null}

          <div className="form-actions">
            <Button icon={Plus} loading={saving} onClick={handleSubmit}>
              {account ? 'Simpan perubahan' : 'Simpan akun'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Batal
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TransferDialog({ accounts, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(() => ({
    ...EMPTY_TRANSFER,
    fromAccountId: accounts[0]?.id ?? '',
    toAccountId: accounts[1]?.id ?? '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const from = accounts.find((account) => account.id === form.fromAccountId) ?? null

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit() {
    const parsed = cashTransferSchema.safeParse({
      date: form.date,
      fromAccountId: form.fromAccountId,
      toAccountId: form.toAccountId,
      amount: Number(form.amount || 0),
      note: form.note,
    })

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push('Periksa kembali data transfer.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      const result = await transferCash(parsed.data)
      toast.push(`Transfer ${formatRupiah(result.amount)} dari ${result.fromName} ke ${result.toName} tercatat.`)
      onSaved()
      onClose()
    } catch (error) {
      toast.push(error?.message ?? 'Transfer gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Transfer antarakun"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h3>Transfer antarakun</h3>
          <button type="button" className="icon-button icon-button--sm" onClick={onClose} aria-label="Tutup">
            <X size={17} />
          </button>
        </div>
        <div className="modal__content">
          <div className="form-grid">
            <Field label="Tanggal" htmlFor="transferDate" required error={errors.date}>
              <input
                id="transferDate"
                type="date"
                className={`input ${errors.date ? 'input--error' : ''}`.trim()}
                value={form.date}
                max={toDateKey()}
                onChange={(event) => setField('date', event.target.value)}
              />
            </Field>

            <Field label="Nominal" htmlFor="transferAmount" required error={errors.amount}>
              <input
                id="transferAmount"
                type="number"
                min="1"
                step="1"
                className={`input ${errors.amount ? 'input--error' : ''}`.trim()}
                value={form.amount}
                onChange={(event) => setField('amount', event.target.value)}
                placeholder="0"
              />
            </Field>

            <Field label="Dari akun" htmlFor="transferFrom" required error={errors.fromAccountId}>
              <select
                id="transferFrom"
                className="select"
                value={form.fromAccountId}
                onChange={(event) => setField('fromAccountId', event.target.value)}
              >
                <option value="">Pilih akun sumber</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({formatRupiah(account.balance)})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ke akun" htmlFor="transferTo" required error={errors.toAccountId}>
              <select
                id="transferTo"
                className="select"
                value={form.toAccountId}
                onChange={(event) => setField('toAccountId', event.target.value)}
              >
                <option value="">Pilih akun tujuan</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Catatan"
              htmlFor="transferNote"
              error={errors.note}
              className="form-grid__full"
              hint={from ? `Saldo ${from.name} saat ini ${formatRupiah(from.balance)}.` : undefined}
            >
              <input
                id="transferNote"
                className="input"
                value={form.note}
                onChange={(event) => setField('note', event.target.value)}
                placeholder="Contoh: setor tunai ke bank"
                maxLength={200}
              />
            </Field>
          </div>

          <p className="form-note">
            Transfer menulis dua mutasi kas (keluar dari akun asal, masuk ke akun tujuan) dan tidak mengubah
            laba. Saldo akun asal tidak boleh menjadi negatif.
          </p>

          <div className="form-actions">
            <Button icon={ArrowLeftRight} loading={saving} onClick={handleSubmit}>
              Simpan transfer
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Batal
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CashPage() {
  const toast = useToast()
  const [tab, setTab] = useState('akun')
  const [accountDialog, setAccountDialog] = useState({ open: false, account: null })
  const [transferOpen, setTransferOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivating, setDeactivating] = useState(false)
  const [filters, setFilters] = useState({ month: toDateKey().slice(0, 7), accountId: 'semua', type: 'semua' })

  const data = useLiveQuery(async () => {
    const [accounts, transactions] = await Promise.all([
      listCashAccounts(),
      listCashTransactions({ month: filters.month }),
    ])
    return { accounts, transactions }
  }, [filters.month])

  const activeAccounts = useMemo(
    () => (data?.accounts ?? []).filter((account) => account.isActive !== false),
    [data],
  )

  const accountMap = useMemo(
    () => new Map((data?.accounts ?? []).map((account) => [account.id, account])),
    [data],
  )

  const mutations = useMemo(() => {
    return (data?.transactions ?? [])
      .filter((row) => filters.accountId === 'semua' || row.cashAccountId === filters.accountId)
      .filter((row) => filters.type === 'semua' || row.type === filters.type)
  }, [data, filters.accountId, filters.type])

  const mutationTotals = useMemo(
    () =>
      mutations.reduce(
        (totals, row) => {
          const amount = toRupiah(row.amount)
          if (row.type === 'masuk') totals.in += amount
          else totals.out += amount
          return totals
        },
        { in: 0, out: 0 },
      ),
    [mutations],
  )

  const totalBalance = (data?.accounts ?? []).reduce((sum, account) => sum + toRupiah(account.balance), 0)

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await setCashAccountActive(deactivateTarget.id, false)
      toast.push(`Akun ${deactivateTarget.name} dinonaktifkan. Riwayatnya tetap tersimpan.`)
      setDeactivateTarget(null)
    } catch (error) {
      toast.push(error?.message ?? 'Akun gagal dinonaktifkan.', { tone: 'error' })
    } finally {
      setDeactivating(false)
    }
  }

  async function handleActivate(account) {
    try {
      await setCashAccountActive(account.id, true)
      toast.push(`Akun ${account.name} diaktifkan kembali.`)
    } catch (error) {
      toast.push(error?.message ?? 'Akun gagal diaktifkan.', { tone: 'error' })
    }
  }

  return (
    <>
      <PageHeader
        title="Kas & Rekening"
        description="Kelola akun tunai, rekening bank, dan e-wallet. Transfer antarakun tercatat sebagai mutasi kas, bukan pendapatan atau biaya."
      />

      <div className="stat-grid">
        <StatCard
          label="Total saldo kas"
          value={formatRupiah(totalBalance)}
          hint={`${activeAccounts.length} akun aktif`}
          icon={Wallet}
          tone="cash"
        />
        <StatCard
          label={`Uang masuk ${formatMonthLabel(`${filters.month}-01`)}`}
          value={formatRupiah(mutationTotals.in)}
          hint="Termasuk penjualan dan transfer masuk"
          icon={ArrowDownLeft}
        />
        <StatCard
          label={`Uang keluar ${formatMonthLabel(`${filters.month}-01`)}`}
          value={formatRupiah(mutationTotals.out)}
          hint="Termasuk pengeluaran dan transfer keluar"
          icon={ArrowUpRight}
          tone="expense"
        />
        <StatCard
          label="Selisih mutasi"
          value={formatRupiah(mutationTotals.in - mutationTotals.out)}
          hint="Bukan laba usaha"
          icon={ArrowLeftRight}
        />
      </div>

      <div className="row" style={{ marginBottom: 14, justifyContent: 'flex-end' }}>
        <Button variant="secondary" icon={Plus} onClick={() => setAccountDialog({ open: true, account: null })}>
          Tambah akun
        </Button>
        <Button
          icon={ArrowLeftRight}
          onClick={() => setTransferOpen(true)}
          disabled={activeAccounts.length < 2}
        >
          Transfer antarakun
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Kas & mutasi"
          subtitle="Saldo dihitung dari saldo awal ditambah seluruh mutasi akun"
          icon={CreditCard}
          action={
            <div className="segmented" role="group" aria-label="Bagian kas">
              <button
                type="button"
                className={`segmented__button ${tab === 'akun' ? 'segmented__button--active' : ''}`.trim()}
                aria-pressed={tab === 'akun'}
                onClick={() => setTab('akun')}
              >
                Akun kas
              </button>
              <button
                type="button"
                className={`segmented__button ${tab === 'mutasi' ? 'segmented__button--active' : ''}`.trim()}
                aria-pressed={tab === 'mutasi'}
                onClick={() => setTab('mutasi')}
              >
                Mutasi kas
              </button>
            </div>
          }
        />
        <CardBody>
          {!data ? (
            <p className="muted">Memuat akun kas...</p>
          ) : tab === 'akun' ? (
            data.accounts.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Belum ada akun kas"
                description="Tambahkan akun tunai atau rekening bank agar penjualan dan pengeluaran dapat dicatat."
              />
            ) : (
              <div className="table-wrap">
                <table className="table table--right">
                  <thead>
                    <tr>
                      <th>Akun</th>
                      <th>Jenis</th>
                      <th>Saldo awal</th>
                      <th>Saldo saat ini</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <strong>{account.name}</strong>
                          {account.note ? <p className="activity-item__meta">{account.note}</p> : null}
                        </td>
                        <td>
                          <Badge tone={account.type === 'bank' ? 'blue' : account.type === 'ewallet' ? 'green' : 'gray'}>
                            {CASH_ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                          </Badge>
                        </td>
                        <td className="num">{formatRupiah(account.openingBalance)}</td>
                        <td className="table__amount">
                          <span style={account.balance < 0 ? { color: 'var(--danger)' } : undefined}>
                            {formatRupiah(account.balance)}
                          </span>
                        </td>
                        <td>
                          <Badge tone={account.isActive === false ? 'gray' : 'green'}>
                            {account.isActive === false ? 'Nonaktif' : 'Aktif'}
                          </Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Ubah akun"
                              aria-label={`Ubah ${account.name}`}
                              onClick={() => setAccountDialog({ open: true, account })}
                            >
                              <Pencil size={15} />
                            </button>
                            {account.isActive === false ? (
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Aktifkan"
                                aria-label={`Aktifkan ${account.name}`}
                                onClick={() => handleActivate(account)}
                              >
                                <Power size={15} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Nonaktifkan"
                                aria-label={`Nonaktifkan ${account.name}`}
                                onClick={() => setDeactivateTarget(account)}
                              >
                                <Power size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <>
              <div className="toolbar toolbar--plain">
                <div className="toolbar__filters">
                  <input
                    className="input"
                    type="month"
                    value={filters.month}
                    onChange={(event) => setFilters({ ...filters, month: event.target.value })}
                    aria-label="Bulan mutasi"
                    style={{ width: 'auto' }}
                  />
                  <select
                    className="select"
                    value={filters.accountId}
                    onChange={(event) => setFilters({ ...filters, accountId: event.target.value })}
                    aria-label="Akun mutasi"
                  >
                    <option value="semua">Semua akun</option>
                    {data.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={filters.type}
                    onChange={(event) => setFilters({ ...filters, type: event.target.value })}
                    aria-label="Jenis mutasi"
                  >
                    <option value="semua">Masuk & keluar</option>
                    <option value="masuk">Uang masuk</option>
                    <option value="keluar">Uang keluar</option>
                  </select>
                </div>
                <span className="muted">{mutations.length} mutasi</span>
              </div>

              {mutations.length === 0 ? (
                <EmptyState
                  icon={ArrowLeftRight}
                  title="Belum ada mutasi kas"
                  description="Mutasi muncul dari penjualan, pengeluaran, pembatalan, dan transfer antarakun pada bulan ini."
                />
              ) : (
                <div className="table-wrap" style={{ marginTop: 14 }}>
                  <table className="table table--right">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Akun</th>
                        <th>Keterangan</th>
                        <th>Jenis transaksi</th>
                        <th>Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mutations.map((row) => (
                        <tr key={row.id}>
                          <td>{formatLongDate(row.date)}</td>
                          <td>{accountMap.get(row.cashAccountId)?.name ?? '-'}</td>
                          <td>{row.description}</td>
                          <td>
                            <Badge tone={row.refType === 'transfer' ? 'blue' : 'gray'}>
                              {CASH_REF_LABELS[row.refType] ?? row.refType}
                            </Badge>
                          </td>
                          <td className="table__amount">
                            <span style={row.type === 'masuk' ? { color: 'var(--green-700)' } : { color: 'var(--danger)' }}>
                              {row.type === 'masuk' ? '+' : '-'}
                              {formatRupiah(row.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}>
                          <strong>Masuk {formatRupiah(mutationTotals.in)}</strong>
                          {' · '}
                          <strong>Keluar {formatRupiah(mutationTotals.out)}</strong>
                        </td>
                        <td className="table__amount">
                          <strong>{formatRupiah(mutationTotals.in - mutationTotals.out)}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {accountDialog.open ? (
        <AccountDialog
          account={accountDialog.account}
          onClose={() => setAccountDialog({ open: false, account: null })}
          onSaved={() => setTab('akun')}
        />
      ) : null}

      {transferOpen ? (
        <TransferDialog accounts={activeAccounts} onClose={() => setTransferOpen(false)} onSaved={() => setTab('mutasi')} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Nonaktifkan akun kas?"
        description={
          deactivateTarget
            ? `Akun ${deactivateTarget.name} tidak akan muncul pada formulir penjualan dan pengeluaran. Saldo harus nol sebelum akun dinonaktifkan. Riwayat mutasi tetap tersimpan dan akun dapat diaktifkan kembali.`
            : ''
        }
        confirmLabel="Nonaktifkan akun"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </>
  )
}
