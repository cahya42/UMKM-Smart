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
    entity: 'customer',
    label: 'Pelanggan',
    usageTable: 'sales',
    usageField: 'customerId',
    usageLabel: 'nota',
  },
  pemasok: {
    table: 'suppliers',
    entity: 'supplier',
    label: 'Pemasok',
    usageTable: 'stock_movements',
    usageField: 'supplierId',
    usageLabel: 'pergerakan stok',
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

async function ensureNameAvailable(tx, config, name, excludeId = null) {
  const rows = await tx.table(config.table).toArray()
  const target = name.toLowerCase()
  const duplicate = rows.some(
    (row) => row.id !== excludeId && (row.name ?? '').trim().toLowerCase() === target,
  )
  if (duplicate) throw new Error(`${config.label} dengan nama "${name}" sudah ada.`)
}

/** Daftar kontak satu jenis, urut nama. */
export async function listContacts(kind) {
  const { table } = getConfig(kind)
  const rows = await db.table(table).toArray()
  return rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'id'))
}

/**
 * Rekap pemakaian kontak: pelanggan dari nota penjualan, pemasok dari
 * pergerakan stok. Nilai pemakaian pelanggan hanya menghitung nota yang tidak
 * dibatalkan; nilai pemasok hanya menghitung barang masuk.
 * Mengembalikan Map<contactId, { count, total }>.
 */
export async function getContactUsage(kind) {
  const config = getConfig(kind)
  const rows = await db.table(config.usageTable).toArray()
  const usage = new Map()

  for (const row of rows) {
    const contactId = row[config.usageField]
    if (!contactId) continue

    const current = usage.get(contactId) ?? { count: 0, total: 0 }
    current.count += 1

    if (kind === CONTACT_KINDS.PELANGGAN) {
      if (row.status !== 'dibatalkan') current.total += Number(row.total ?? 0)
    } else if (row.type === 'masuk') {
      current.total += Math.round(Number(row.qty ?? 0) * Number(row.unitCost ?? 0))
    }

    usage.set(contactId, current)
  }

  return usage
}

export async function createContact(kind, input) {
  const config = getConfig(kind)
  const data = normalize(input)

  return db.transaction('rw', db.table(config.table), db.audit_logs, async (tx) => {
    await ensureNameAvailable(tx, config, data.name)

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

    await ensureNameAvailable(tx, config, data.name, id)

    const updated = { ...current, ...data, updatedAt: new Date().toISOString() }
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

  return db.transaction(
    'rw',
    db.table(config.table),
    db.table(config.usageTable),
    db.audit_logs,
    async (tx) => {
      const current = await tx.table(config.table).get(id)
      if (!current) throw new Error(`${config.label} tidak ditemukan.`)

      const used = await tx
        .table(config.usageTable)
        .filter((row) => row[config.usageField] === id)
        .count()

      if (used > 0) {
        throw new Error(
          `${config.label} ${current.name} sudah dipakai pada ${used} ${config.usageLabel}. Nonaktifkan saja agar riwayat tetap utuh.`,
        )
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
    },
  )
}
