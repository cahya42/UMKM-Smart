import { db } from '../db'

/**
 * Mencatat perubahan penting. Audit log tidak boleh diubah atau dihapus
 * oleh pengguna biasa; fungsinya hanya menambah catatan.
 *
 * @param {object} entry
 * @param {string} entry.action contoh: 'create' | 'update' | 'delete' | 'activate'
 * @param {string} entry.entity nama tabel yang berubah
 * @param {string} [entry.entityId]
 * @param {string} entry.description penjelasan singkat untuk pengguna
 * @param {string} [entry.actor] siapa yang melakukan
 * @param {object} [entry.metadata] data tambahan (tanpa rahasia)
 * @param {import('dexie').Transaction} [tx] transaksi berjalan
 */
export async function addAuditLog(entry, tx) {
  const record = {
    id: crypto.randomUUID(),
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    description: entry.description,
    actor: entry.actor ?? 'pemilik',
    metadata: entry.metadata ?? null,
    createdAt: new Date().toISOString(),
  }

  if (tx) {
    await tx.table('audit_logs').add(record)
    return record
  }

  await db.audit_logs.add(record)
  return record
}

/** Audit log terbaru untuk ditampilkan di halaman Pengaturan. */
export async function getRecentAuditLogs(limit = 20) {
  return db.audit_logs.orderBy('createdAt').reverse().limit(limit).toArray()
}
