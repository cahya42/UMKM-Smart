import { db } from '../db'
import { toRupiah } from '../../utils/money'
import { computeCashBalances } from '../../utils/finance'
import { addAuditLog } from './auditLogRepo'

/**
 * Kas & rekening (Tahap 5):
 * - Akun kas tidak dihapus agar riwayat mutasi tetap utuh; hanya dinonaktifkan.
 * - Transfer menulis DUA mutasi kas (keluar dari asal, masuk ke tujuan) dalam
 *   satu transaksi, dengan refId yang sama.
 * - Saldo tidak boleh negatif akibat transfer; transfer dicek terhadap saldo
 *   akun asal di dalam transaksi.
 */

export const CASH_ACCOUNT_TYPES = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'bank', label: 'Rekening bank' },
  { value: 'ewallet', label: 'E-wallet' },
]

export const CASH_ACCOUNT_TYPE_LABELS = Object.fromEntries(
  CASH_ACCOUNT_TYPES.map((type) => [type.value, type.label]),
)

export const CASH_REF_LABELS = {
  sale: 'Penjualan',
  sale_cancel: 'Pembatalan penjualan',
  expense: 'Pengeluaran',
  expense_cancel: 'Pembatalan pengeluaran',
  transfer: 'Transfer antarakun',
}

function normalizeName(name) {
  return String(name ?? '').trim()
}

async function assertUniqueName(tx, name, excludeId = null) {
  const rows = await tx.table('cash_accounts').toArray()
  const duplicate = rows.some(
    (account) =>
      account.id !== excludeId && normalizeName(account.name).toLowerCase() === name.toLowerCase(),
  )
  if (duplicate) throw new Error(`Akun kas "${name}" sudah ada.`)
}

async function accountBalance(tx, account) {
  const transactions = await tx
    .table('cash_transactions')
    .where('cashAccountId')
    .equals(account.id)
    .toArray()

  return transactions.reduce((total, transaction) => {
    const amount = toRupiah(transaction.amount)
    return total + (transaction.type === 'masuk' ? amount : -amount)
  }, toRupiah(account.openingBalance))
}

export async function listCashAccounts() {
  const [accounts, transactions] = await Promise.all([
    db.cash_accounts.toArray(),
    db.cash_transactions.toArray(),
  ])

  const balances = new Map(
    computeCashBalances(accounts, transactions).accounts.map((account) => [account.id, account.balance]),
  )

  return accounts
    .map((account) => ({ ...account, balance: balances.get(account.id) ?? 0 }))
    .sort((a, b) => {
      if ((a.isActive !== false) !== (b.isActive !== false)) return a.isActive === false ? 1 : -1
      return a.name.localeCompare(b.name, 'id')
    })
}

export async function createCashAccount(input) {
  const name = normalizeName(input.name)
  const openingBalance = toRupiah(input.openingBalance)

  return db.transaction('rw', db.cash_accounts, db.audit_logs, async (tx) => {
    await assertUniqueName(tx, name)

    const now = new Date().toISOString()
    const record = {
      id: crypto.randomUUID(),
      name,
      type: input.type,
      openingBalance,
      note: normalizeName(input.note),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }

    await tx.table('cash_accounts').add(record)
    await addAuditLog(
      {
        action: 'cash_account_create',
        entity: 'cash_account',
        entityId: record.id,
        description: `Menambah akun kas ${record.name} dengan saldo awal Rp${openingBalance}`,
        metadata: { type: record.type, openingBalance },
      },
      tx,
    )

    return record
  })
}

export async function updateCashAccount(id, input) {
  const name = normalizeName(input.name)
  const openingBalance = toRupiah(input.openingBalance)

  return db.transaction('rw', db.cash_accounts, db.audit_logs, async (tx) => {
    const account = await tx.table('cash_accounts').get(id)
    if (!account) throw new Error('Akun kas tidak ditemukan.')

    await assertUniqueName(tx, name, id)

    const updated = {
      ...account,
      name,
      type: input.type,
      openingBalance,
      note: normalizeName(input.note),
      updatedAt: new Date().toISOString(),
    }

    await tx.table('cash_accounts').put(updated)
    await addAuditLog(
      {
        action: 'cash_account_update',
        entity: 'cash_account',
        entityId: id,
        description: `Mengubah akun kas ${updated.name}`,
        metadata: {
          before: { name: account.name, type: account.type, openingBalance: account.openingBalance },
          after: { name: updated.name, type: updated.type, openingBalance: updated.openingBalance },
        },
      },
      tx,
    )

    return updated
  })
}

/**
 * Menonaktifkan akun hanya boleh jika saldonya nol dan masih ada akun aktif
 * lain, supaya penjualan/pengeluaran selalu punya akun penerima.
 */
export async function setCashAccountActive(id, isActive) {
  return db.transaction('rw', db.cash_accounts, db.cash_transactions, db.audit_logs, async (tx) => {
    const account = await tx.table('cash_accounts').get(id)
    if (!account) throw new Error('Akun kas tidak ditemukan.')

    if (!isActive) {
      const balance = await accountBalance(tx, account)
      if (balance !== 0) {
        throw new Error(
          `Saldo ${account.name} masih ${balance < 0 ? '-' : ''}Rp${Math.abs(balance)}. Pindahkan saldonya lewat transfer sebelum menonaktifkan akun.`,
        )
      }

      const others = (await tx.table('cash_accounts').toArray()).filter(
        (item) => item.id !== id && item.isActive !== false,
      )
      if (others.length === 0) {
        throw new Error('Minimal harus ada satu akun kas aktif.')
      }
    }

    const updated = { ...account, isActive: Boolean(isActive), updatedAt: new Date().toISOString() }
    await tx.table('cash_accounts').put(updated)

    await addAuditLog(
      {
        action: isActive ? 'cash_account_activate' : 'cash_account_deactivate',
        entity: 'cash_account',
        entityId: id,
        description: `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} akun kas ${account.name}`,
      },
      tx,
    )

    return updated
  })
}

/** Transfer antarakun: dua mutasi kas dalam satu transaksi. */
export async function transferCash(input) {
  const amount = toRupiah(input.amount)
  if (amount <= 0) throw new Error('Nominal transfer harus lebih dari 0.')
  if (input.fromAccountId === input.toAccountId) {
    throw new Error('Akun sumber dan tujuan harus berbeda.')
  }

  return db.transaction(
    'rw',
    db.cash_accounts,
    db.cash_transactions,
    db.audit_logs,
    async (tx) => {
      const from = await tx.table('cash_accounts').get(input.fromAccountId)
      const to = await tx.table('cash_accounts').get(input.toAccountId)
      if (!from) throw new Error('Akun kas sumber tidak ditemukan.')
      if (!to) throw new Error('Akun kas tujuan tidak ditemukan.')
      if (from.isActive === false) throw new Error(`Akun ${from.name} sedang nonaktif.`)
      if (to.isActive === false) throw new Error(`Akun ${to.name} sedang nonaktif.`)

      const balance = await accountBalance(tx, from)
      if (amount > balance) {
        throw new Error(
          `Saldo ${from.name} tidak cukup. Tersedia Rp${balance < 0 ? 0 : balance}, diminta Rp${amount}.`,
        )
      }

      const now = new Date().toISOString()
      const transferId = crypto.randomUUID()
      const note = normalizeName(input.note)

      await tx.table('cash_transactions').bulkAdd([
        {
          id: crypto.randomUUID(),
          cashAccountId: from.id,
          type: 'keluar',
          amount,
          date: input.date,
          refType: 'transfer',
          refId: transferId,
          description: `Transfer ke ${to.name}${note ? ` - ${note}` : ''}`,
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          cashAccountId: to.id,
          type: 'masuk',
          amount,
          date: input.date,
          refType: 'transfer',
          refId: transferId,
          description: `Transfer dari ${from.name}${note ? ` - ${note}` : ''}`,
          createdAt: now,
        },
      ])

      await addAuditLog(
        {
          action: 'cash_transfer',
          entity: 'cash_transfer',
          entityId: transferId,
          description: `Transfer Rp${amount} dari ${from.name} ke ${to.name}`,
          metadata: { amount, fromAccountId: from.id, toAccountId: to.id, date: input.date },
        },
        tx,
      )

      return { id: transferId, amount, fromName: from.name, toName: to.name }
    },
  )
}

/** Mutasi kas, diurutkan terbaru lebih dulu. */
export async function listCashTransactions({ month, accountId } = {}) {
  let rows = month
    ? await db.cash_transactions.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray()
    : await db.cash_transactions.toArray()

  if (accountId) rows = rows.filter((row) => row.cashAccountId === accountId)

  return rows.sort((a, b) =>
    `${b.date}${b.createdAt ?? ''}`.localeCompare(`${a.date}${a.createdAt ?? ''}`),
  )
}
