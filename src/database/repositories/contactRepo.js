import { db } from '../db'
import { addAuditLog } from './auditLogRepo'

/**
 * Pelanggan dan pemasok disimpan pada tabel terpisah (`customers`, `suppliers`)
 * dengan bentuk record yang sama. Keduanya hanya berisi kontak: belum ada
 * piutang, utang, atau saldo per kontak.
 *
 * Aturan yang dijaga di sini:
 * - Nama kontak unik (tanpa membedakan huruf besar/kecil) per jenis kontak.
 * - Kontak yang sudah dipakai transaksi tidak boleh dihapus; nonaktifkan saja
 *   agar riwayat nota dan pembelian tetap utuh.
 * - Semua perubahan menulis audit log.
 */

export const CONTACT_KINDS = {
  PELANGGAN: 'pelanggan',
  PEMASOK: 'pemasok',
}

const CONTACT_CONFIG = {
  pelanggan: {
    table: 'customers',
    label: 'Pelanggan',
    entity: 'customer',
  },
  pemasok: {
    table: 'suppliers',
    label: 'Pemasok',
    entity: 'supplier',
  },
}

function getConfig(kind) {
  const config = CONTACT_CONFIG[kind]
  if (!config) throw new Error('Jenis kontak tidak dikenal.')
  return config
}

function normalize(input) {
  return {
    name: (input.name ?? '').trim(),
    phone: (input.phone ?? '').trim(),
    email: (input.email ?? '').trim(),
    address: (input.address ?? '').trim(),
    note: (input.note ?? '').trim(),
  }
}

/** Daftar kontak satu jenis, urut nama. `status`: aktif | nonaktif | semua. */
export async function listContacts(kind, { status = 'semua' } = {}) {
  const { table } = getConfig(kind)
  const rows = await db.table(table).toArray()

  return rows
    .filter((row) => {
      if (status === 'aktif') return row.isActive !== false
      if (status === 'nonaktif') return row.isActive === false
      return true
    })
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'id'))
}

export async function getContact(kind, id) {
  const { table } = getConfig(kind)
  if (!id) return null
  return db.table(table).get(id)
}

/**
 * Jumlah pemakaian kontak: pelanggan dihitung dari nota penjualan (yang tidak
 * dibatalkan untuk nilai omzet), pemasok dari pergerakan stok barang masuk.
 * Mengembalikan Map<contactId, { count, total }>.
 */
export async function getContactUsage(kind) {
  const usage = new Map()

  if (kind === CONTACT_KINDS.PELANGGAN) {
    const sales = await db.sales.toArray()
    for (const sale of sales) {
      if (!sale.customerId) continue
      const current = usage.get(sale.customerId) ?? { count: 0, total: 0 }
      current.count += 1
      if (sale.status !== 'dibatalkan') current.total += Number(sale.total ?? 0)
      usage.set(sale.customerId, current)
    }
    return usage
  }

  const movements = await db.stock_movements.toArray()
  for (const movement of movements) {
    if (!movement.supplierId) continue
    const current = usage.get(movement.supplierId) ?? { count: 0, total: 0 }
    current.count += 1
    if (movement.type === 'masuk') {
      current.total += Math.round(Number(movement.qty ?? 0) * Number(movement.unitCost ?? 0))
    }
    usage.set(movement.supplierId, current)
  }
  return usage
}

export async function createContact(kind, input) {
  const config = getConfig(kind)
  const data = normalize(input)

  return db.transaction('rw', db.table(config.table), db.audit_logs, async (tx) => {
    const rows = await tx.table(config.table).toArray()
    const target = data.name.toLowerCase()
    if (rows.some((row) => (row.name ?? '').trim().toLowerCase() === target)) {
      throw new Error(`${config.label} dengan nama "${data.name}" sudah ada.`)
    }

    const now = new Date().toISOString()
    const contact = {
      id: crypto.randomUUID(),
      ...data,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }

    await tx.table(config.table).add(contact)
    await addAuditLog(
      {
        action: 'create',
        entity: config.entity,
        entityId: contact.id,
        description: `Menambahkan ${config.label.toLowerCase()} ${contact.name}`,
        metadata: { name: contact.name, phone: contact.phone },
      },
      tx,
    )

    return contact
  })
}

export async function updateContact(kind, id, input) {
  const config = getConfig(kind)
  const data = normalize(input)

  return db.transaction('rw', db.table(config.table), db.audit_logs, async (tx) => {
    const current = await tx.table(config.table).get(id)
    if (!current) throw new Error(`${config.label} tidak ditemukan.`)

    const rows = await tx.table(config.table).toArray()
    const target = data.name.toLowerCase()
    if (rows.some((row) => row.id !== id && (row.name ?? '').trim().toLowerCase() === target)) {
      throw new Error(`${config.label} dengan nama "${data.name}" sudah ada.`)
    }

    const updated = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    await tx.table(config.table).put(updated)
    await addAuditLog(
      {
        action: 'update',
        entity: config.entity,
        entityId: id,
        description: `Mengubah data ${config.label.toLowerCase()} ${updated.name}`,
      },
      tx,
    )

    return updated
  })
}

export async function setContactActive(kind, id, isActive) {
  const config = getConfig(kind)

  return db.transaction('rw', db.table(config.table), db.audit_logs, async (tx) => {
    const current = await tx.table(config.table).get(id)
    if (!current) throw new Error(`${config.label} tidak ditemukan.`)

    const updated = { ...current, isActive: Boolean(isActive), updatedAt: new Date().toISOString() }
    await tx.table(config.table).put(updated)
    await addAuditLog(
      {
        action: isActive ? 'activate' : 'deactivate',
        entity: config.entity,
        entityId: id,
        description: `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} ${config.label.toLowerCase()} ${current.name}`,
      },
      tx,
    )

    return updated
  })
}

/** Hapus permanen hanya untuk kontak yang belum dipakai transaksi. */
export async function deleteContact(kind, id) {
  const config = getConfig(kind)

  return db.transaction('rw', db.table(config.table), db.audit_logs, async (tx) => {
    const current = await tx.table(config.table).get(id)
    if (!current) throw new Error(`${config.label} tidak ditemukan.`)

    if (kind === CONTACT_KINDS.PELANGGAN) {
      const used = await tx.table('sales').filter((sale) => sale.customerId === id).count()
      if (used > 0) {
        throw new Error(
          `${config.label} ${current.name} sudah dipakai pada ${used} nota. Nonaktifkan saja agar riwayat tetap utuh.`,
        )
      }
    } else {
      const used = await tx
        .table('stock_movements')
        .filter((movement) => movement.supplierId === id)
        .count()
      if (used > 0) {
        throw new Error(
          `${config.label} ${current.name} sudah dipakai pada ${used} pergerakan stok. Nonaktifkan saja agar riwayat tetap utuh.`,
        )
      }
    }

    await tx.table(config.table).delete(id)
    await addAuditLog(
      {
        action: 'delete',
        entity: config.entity,
        entityId: id,
        description: `Menghapus ${config.label.toLowerCase()} ${current.name}`,
      },
      tx,
    )
  })
}
