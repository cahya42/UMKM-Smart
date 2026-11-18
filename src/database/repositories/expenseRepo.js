import { db } from '../db'
import { toRupiah } from '../../utils/money'
import { addAuditLog } from './auditLogRepo'

/**
 * Pengeluaran operasional selalu menulis `expenses` + mutasi kas keluar dalam
 * satu transaksi. Pembatalan memakai mutasi kas masuk pembalik, bukan hapus.
 */

export const EXPENSE_STATUS = {
  SELESAI: 'selesai',
  DIBATALKAN: 'dibatalkan',
}

export async function listExpenseCategories() {
  return db.expense_categories.orderBy('name').toArray()
}

export async function createExpenseCategory({ name }) {
  const cleanName = name.trim()

  return db.transaction('rw', db.expense_categories, db.audit_logs, async (tx) => {
    const existing = await tx.table('expense_categories').toArray()
    const duplicate = existing.some(
      (category) => category.name.toLowerCase() === cleanName.toLowerCase(),
    )
    if (duplicate) throw new Error(`Kategori pengeluaran "${cleanName}" sudah ada.`)

    const now = new Date().toISOString()
    const record = {
      id: crypto.randomUUID(),
      name: cleanName,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    }

    await tx.table('expense_categories').add(record)
    await addAuditLog(
      {
        action: 'create',
        entity: 'expense_category',
        entityId: record.id,
        description: `Menambah kategori pengeluaran ${record.name}`,
      },
      tx,
    )

    return record
  })
}

export async function createExpense(input) {
  const amount = toRupiah(input.amount)
  if (amount <= 0) throw new Error('Nominal pengeluaran harus lebih dari 0.')

  return db.transaction(
    'rw',
    db.expenses,
    db.cash_transactions,
    db.cash_accounts,
    db.expense_categories,
    db.audit_logs,
    async (tx) => {
      const account = await tx.table('cash_accounts').get(input.cashAccountId)
      if (!account) throw new Error('Akun kas tidak ditemukan. Pilih akun kas yang tersedia.')

      const category = await tx.table('expense_categories').get(input.expenseCategoryId)
      if (!category) throw new Error('Kategori pengeluaran tidak ditemukan.')

      const now = new Date().toISOString()
      const record = {
        id: crypto.randomUUID(),
        date: input.date,
        expenseCategoryId: category.id,
        cashAccountId: account.id,
        amount,
        description: input.description.trim(),
        note: (input.note ?? '').trim(),
        status: EXPENSE_STATUS.SELESAI,
        canceledAt: null,
        cancelReason: '',
        createdAt: now,
        updatedAt: now,
      }

      await tx.table('expenses').add(record)

      await tx.table('cash_transactions').add({
        id: crypto.randomUUID(),
        cashAccountId: account.id,
        type: 'keluar',
        amount,
        date: record.date,
        refType: 'expense',
        refId: record.id,
        description: record.description || `Pengeluaran ${category.name}`,
        createdAt: now,
      })

      await addAuditLog(
        {
          action: 'expense_create',
          entity: 'expense',
          entityId: record.id,
          description: `Mencatat pengeluaran ${record.description} sebesar Rp${amount}`,
          metadata: { amount, category: category.name, cashAccountId: account.id },
        },
        tx,
      )

      return record
    },
  )
}

/** Membatalkan pengeluaran: kas masuk kembali, catatan tetap ada. */
export async function cancelExpense(expenseId, reason = '') {
  return db.transaction(
    'rw',
    db.expenses,
    db.cash_transactions,
    db.audit_logs,
    async (tx) => {
      const expense = await tx.table('expenses').get(expenseId)
      if (!expense) throw new Error('Pengeluaran tidak ditemukan.')
      if (expense.status === EXPENSE_STATUS.DIBATALKAN) {
        throw new Error('Pengeluaran ini sudah dibatalkan.')
      }

      const now = new Date().toISOString()
      const updated = {
        ...expense,
        status: EXPENSE_STATUS.DIBATALKAN,
        canceledAt: now,
        cancelReason: reason.trim(),
        updatedAt: now,
      }

      await tx.table('expenses').put(updated)

      await tx.table('cash_transactions').add({
        id: crypto.randomUUID(),
        cashAccountId: expense.cashAccountId,
        type: 'masuk',
        amount: toRupiah(expense.amount),
        date: now.slice(0, 10),
        refType: 'expense_cancel',
        refId: expense.id,
        description: `Pembatalan pengeluaran: ${expense.description}`,
        createdAt: now,
      })

      await addAuditLog(
        {
          action: 'expense_cancel',
          entity: 'expense',
          entityId: expense.id,
          description: `Membatalkan pengeluaran ${expense.description} sebesar Rp${expense.amount}; kas dikembalikan`,
          metadata: { amount: expense.amount, reason: reason.trim() },
        },
        tx,
      )

      return updated
    },
  )
}

/** Daftar pengeluaran; `month` berformat 'YYYY-MM'. */
export async function listExpenses({ month } = {}) {
  const rows = month
    ? await db.expenses.where('date').between(`${month}-01`, `${month}-31`, true, true).toArray()
    : await db.expenses.toArray()

  return rows.sort((a, b) =>
    `${b.date}${b.createdAt ?? ''}`.localeCompare(`${a.date}${a.createdAt ?? ''}`),
  )
}
