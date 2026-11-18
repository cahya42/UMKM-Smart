import { db } from '../../database/db'
import { STORES_V2 } from '../../database/schema'
import { addAuditLog } from '../../database/repositories/auditLogRepo'
import { APP_VERSION } from '../license/constants'

/**
 * Cadangan data usaha:
 * - Ekspor seluruh tabel data ke satu berkas JSON berversi + checksum SHA-256.
 * - Impor divalidasi (format, versi, tabel, jumlah, checksum) sebelum menimpa data.
 * - Sebelum menimpa, dibuat cadangan otomatis ke tabel `backups` agar pemulihan
 *   yang salah masih bisa dibatalkan.
 * - Pengaturan perangkat (lisensi & waktu pasang) tidak ikut diekspor dan tidak
 *   ditimpa saat pemulihan.
 */

export const BACKUP_FORMAT = 'umkm-smart-backup'
export const BACKUP_VERSION = 1

/** Tabel data usaha (termasuk settings), tanpa tabel `backups`. */
export const DATA_TABLES = Object.keys(STORES_V2)

export const MAX_LOCAL_BACKUPS = 2

const DEVICE_SETTING_KEY = 'app.installedAt'
const LICENSE_PREFIX = 'license.'

export function isDeviceSetting(key) {
  return key === DEVICE_SETTING_KEY || String(key).startsWith(LICENSE_PREFIX)
}

function sanitizeTables(tables) {
  const result = {}
  for (const name of DATA_TABLES) {
    const rows = Array.isArray(tables[name]) ? tables[name] : []
    result[name] = name === 'settings' ? rows.filter((row) => !isDeviceSetting(row.key)) : rows
  }
  return result
}

export async function computeChecksum(tables) {
  const canonical = JSON.stringify(DATA_TABLES.map((name) => [name, tables[name] ?? []]))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function collectTables() {
  const entries = await Promise.all(
    DATA_TABLES.map(async (name) => [name, await db.table(name).toArray()]),
  )
  return Object.fromEntries(entries)
}

/** Membuat payload cadangan dari isi database saat ini. */
export async function createBackupPayload() {
  const tables = sanitizeTables(await collectTables())
  const counts = Object.fromEntries(DATA_TABLES.map((name) => [name, tables[name].length]))

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: db.verno,
    createdAt: new Date().toISOString(),
    counts,
    checksum: await computeChecksum(tables),
    tables,
  }
}

export function backupSize(payload) {
  try {
    return new Blob([JSON.stringify(payload)]).size
  } catch {
    return 0
  }
}

/** Menyimpan cadangan ke tabel lokal, menyisakan hanya beberapa terbaru. */
export async function saveLocalBackup(payload, reason = 'Cadangan manual') {
  const id = crypto.randomUUID()

  await db.backups.add({
    id,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    reason,
    appVersion: payload.appVersion ?? APP_VERSION,
    schemaVersion: payload.schemaVersion ?? db.verno,
    counts: payload.counts ?? {},
    size: backupSize(payload),
    payload,
  })

  const all = await db.backups.orderBy('createdAt').reverse().toArray()
  if (all.length > MAX_LOCAL_BACKUPS) {
    await db.backups.bulkDelete(all.slice(MAX_LOCAL_BACKUPS).map((item) => item.id))
  }

  return id
}

/** Mengunduh payload cadangan sebagai berkas JSON tanpa menyimpannya lagi. */
export function downloadPayload(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `umkm-smart-backup-${String(payload.createdAt ?? '').slice(0, 10) || 'data'}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Mengunduh cadangan sebagai berkas JSON dan menyimpannya sebagai cadangan lokal. */
export async function downloadBackup() {
  const payload = await createBackupPayload()
  downloadPayload(payload)
  await saveLocalBackup(payload, 'Unduhan manual')
  return payload
}

/**
 * Memeriksa berkas cadangan sebelum dipakai.
 * @returns {{ok:boolean, errors:string[], payload:object|null, summary:object|null}}
 */
export async function validateBackupPayload(input) {
  const errors = []
  let payload = input

  if (typeof input === 'string') {
    try {
      payload = JSON.parse(input)
    } catch {
      return { ok: false, errors: ['Berkas bukan JSON yang valid.'], payload: null, summary: null }
    }
  }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['Isi berkas cadangan tidak dikenali.'], payload: null, summary: null }
  }

  if (payload.format !== BACKUP_FORMAT) {
    errors.push('Berkas ini bukan cadangan UMKM SMART.')
  }
  if (payload.version !== BACKUP_VERSION) {
    errors.push(`Versi cadangan tidak didukung (${payload.version ?? 'tidak ada'}).`)
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    errors.push('Cadangan tidak memiliki daftar tabel data.')
  } else {
    const missing = DATA_TABLES.filter((name) => !Array.isArray(payload.tables[name]))
    if (missing.length > 0) {
      errors.push(`Cadangan tidak lengkap. Tabel hilang: ${missing.join(', ')}.`)
    } else {
      const countMismatch = DATA_TABLES.filter(
        (name) => Number(payload.counts?.[name] ?? -1) !== payload.tables[name].length,
      )
      if (countMismatch.length > 0) {
        errors.push(`Jumlah data tidak cocok dengan catatan cadangan: ${countMismatch.join(', ')}.`)
      }

      if (!payload.checksum) {
        errors.push('Cadangan tidak memiliki checksum sehingga keutuhannya tidak dapat dipastikan.')
      } else {
        const checksum = await computeChecksum(sanitizeTables(payload.tables))
        if (checksum !== payload.checksum) {
          errors.push('Checksum cadangan tidak cocok. Berkas mungkin rusak atau diubah.')
        }
      }
    }
  }

  if (Number(payload.schemaVersion) > db.verno) {
    errors.push(
      `Cadangan dibuat oleh aplikasi versi lebih baru (skema v${payload.schemaVersion}); perbarui aplikasi terlebih dahulu.`,
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors, payload: null, summary: null }
  }

  return {
    ok: true,
    errors: [],
    payload,
    summary: {
      createdAt: payload.createdAt,
      appVersion: payload.appVersion,
      schemaVersion: payload.schemaVersion,
      counts: payload.counts,
      total: Object.values(payload.counts).reduce((sum, value) => sum + Number(value || 0), 0),
    },
  }
}

/**
 * Memulihkan data dari payload yang sudah tervalidasi.
 * Data saat ini dicadangkan lebih dulu, lalu seluruh tabel data ditimpa dalam
 * satu transaksi. Pengaturan lisensi perangkat tetap dipertahankan.
 */
export async function restoreBackup(payload) {
  const check = await validateBackupPayload(payload)
  if (!check.ok) throw new Error(check.errors[0] ?? 'Cadangan tidak valid.')

  const safety = await createBackupPayload()
  await saveLocalBackup(safety, 'Cadangan otomatis sebelum pemulihan')

  const deviceSettings = (await db.settings.toArray()).filter((row) => isDeviceSetting(row.key))
  const tables = sanitizeTables(check.payload.tables)
  const restoredSettings = [
    ...tables.settings,
    ...deviceSettings.filter((device) => !tables.settings.some((row) => row.key === device.key)),
  ]

  await db.transaction('rw', DATA_TABLES.map((name) => db.table(name)), async (tx) => {
    for (const name of DATA_TABLES) {
      const table = tx.table(name)
      await table.clear()
      const rows = name === 'settings' ? restoredSettings : tables[name]
      if (rows.length > 0) await table.bulkPut(rows)
    }
  })

  await addAuditLog({
    action: 'backup_restore',
    entity: 'database',
    description: `Memulihkan data dari cadangan ${check.summary.createdAt ?? ''}`.trim(),
    metadata: { counts: check.summary.counts, sourceAppVersion: check.payload.appVersion },
  })

  return check.summary
}

/** Daftar cadangan lokal (tanpa payload besar). */
export async function listLocalBackups() {
  const rows = await db.backups.orderBy('createdAt').reverse().toArray()
  return rows.map(({ payload, ...rest }) => ({ ...rest, total: Object.values(rest.counts ?? {}).reduce((sum, value) => sum + Number(value || 0), 0) }))
}

export async function getLocalBackup(id) {
  return db.backups.get(id)
}

export async function restoreLocalBackup(id) {
  const backup = await getLocalBackup(id)
  if (!backup) throw new Error('Cadangan lokal tidak ditemukan.')
  return restoreBackup(backup.payload)
}
