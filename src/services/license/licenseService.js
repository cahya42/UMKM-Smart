import { addAuditLog } from '../../database/repositories/auditLogRepo'
import { daysSince } from '../../utils/dates'
import { APP_VERSION, LICENSE_API_URL, LICENSE_PUBLIC_KEY_JWK } from './constants'
import { getDeviceInfo } from './device'
import {
  clearLicenseRecord,
  getDevMode,
  getOfflineGraceDays,
  readLicenseRecord,
  setDevMode,
  writeLicenseRecord,
} from './licenseStorage'

export class LicenseError extends Error {
  constructor(message, code = 'LICENSE_ERROR') {
    super(message)
    this.name = 'LicenseError'
    this.code = code
  }
}

/**
 * Memverifikasi bukti aktivasi bertanda tangan digital dari server lisensi.
 *
 * Format bukti:
 * {
 *   payload: "<string JSON persis seperti yang ditandatangani server>",
 *   signature: "<ECDSA P-256 SHA-256 atas byte payload, base64url>"
 * }
 *
 * Aplikasi hanya memegang kunci publik. Private key tidak pernah ada di frontend.
 */
export async function verifyLicenseProof(proof) {
  if (!proof || typeof proof.payload !== 'string' || typeof proof.signature !== 'string') {
    throw new LicenseError('Bukti aktivasi tidak lengkap.', 'BAD_PROOF')
  }
  if (!LICENSE_PUBLIC_KEY_JWK) {
    throw new LicenseError(
      'Kunci publik lisensi belum dikonfigurasi pada aplikasi ini. Hubungi penerbit aplikasi.',
      'NO_PUBLIC_KEY',
    )
  }

  let publicKey
  try {
    publicKey = await crypto.subtle.importKey(
      'jwk',
      LICENSE_PUBLIC_KEY_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
  } catch {
    throw new LicenseError('Kunci publik lisensi tidak valid.', 'BAD_PUBLIC_KEY')
  }

  let signatureBytes
  try {
    signatureBytes = base64UrlToBytes(proof.signature)
  } catch {
    throw new LicenseError('Tanda tangan aktivasi tidak dapat dibaca.', 'BAD_SIGNATURE')
  }

  let valid = false
  try {
    valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signatureBytes,
      new TextEncoder().encode(proof.payload),
    )
  } catch {
    throw new LicenseError('Tanda tangan aktivasi tidak dapat diverifikasi.', 'BAD_SIGNATURE')
  }

  if (!valid) {
    throw new LicenseError(
      'Tanda tangan bukti aktivasi tidak sah. Bukti mungkin diubah atau bukan dari server lisensi resmi.',
      'BAD_SIGNATURE',
    )
  }

  let payload
  try {
    payload = JSON.parse(proof.payload)
  } catch {
    throw new LicenseError('Isi bukti aktivasi tidak valid.', 'BAD_PAYLOAD')
  }

  if (!payload.licenseId || !payload.email || !payload.status) {
    throw new LicenseError('Isi bukti aktivasi tidak lengkap.', 'BAD_PAYLOAD')
  }

  return payload
}

/**
 * Aktivasi online: email + token dikirim ke server lisensi melalui HTTPS.
 * Server mengembalikan bukti bertanda tangan, lalu aplikasi memverifikasinya.
 */
export async function activateLicense({ email, token }) {
  assertLicenseServerUsable()

  const device = await getDeviceInfo()
  const normalizedEmail = email.trim().toLowerCase()

  const response = await postJson('/activate', {
    email: normalizedEmail,
    token: token.trim(),
    deviceId: device.id,
    deviceLabel: device.label,
    appVersion: APP_VERSION,
  })

  const payload = await verifyLicenseProof(response.proof)

  if (String(payload.email).trim().toLowerCase() !== normalizedEmail) {
    throw new LicenseError('Bukti aktivasi tidak sesuai dengan email pembeli.', 'EMAIL_MISMATCH')
  }
  if (payload.deviceId && payload.deviceId !== device.id) {
    throw new LicenseError('Bukti aktivasi diterbitkan untuk perangkat lain.', 'DEVICE_MISMATCH')
  }

  const now = new Date().toISOString()
  const record = {
    payload,
    proof: response.proof,
    activatedAt: now,
    lastVerifiedAt: now,
    lastVerifyMode: 'online',
  }

  await writeLicenseRecord(record)
  await addAuditLog({
    action: 'license_activate',
    entity: 'license',
    entityId: payload.licenseId,
    description: 'Aktivasi lisensi berhasil diverifikasi',
    metadata: { email: payload.email, deviceLabel: device.label },
  })

  return payload
}

/**
 * Memperbarui bukti aktivasi secara online (misalnya setelah perpanjangan
 * atau pemindahan perangkat). Aman dipanggil saat offline: error jaringan
 * tidak mengubah lisensi yang sudah tersimpan.
 */
export async function refreshLicense() {
  const record = await readLicenseRecord()
  if (!record?.payload) {
    throw new LicenseError('Belum ada lisensi yang terpasang.', 'NO_LICENSE')
  }
  assertLicenseServerUsable()

  const device = await getDeviceInfo()
  const response = await postJson('/verify', {
    licenseId: record.payload.licenseId,
    email: record.payload.email,
    deviceId: device.id,
    deviceLabel: device.label,
    appVersion: APP_VERSION,
  })

  const payload = await verifyLicenseProof(response.proof)
  if (payload.deviceId && payload.deviceId !== device.id) {
    throw new LicenseError('Lisensi ini terdaftar untuk perangkat lain.', 'DEVICE_MISMATCH')
  }

  const updated = {
    ...record,
    payload,
    proof: response.proof,
    lastVerifiedAt: new Date().toISOString(),
    lastVerifyMode: 'online',
  }
  await writeLicenseRecord(updated)
  await addAuditLog({
    action: 'license_verify',
    entity: 'license',
    entityId: payload.licenseId,
    description: 'Pemeriksaan lisensi online berhasil',
  })
  return payload
}

/**
 * Menilai status lisensi dari bukti yang sudah diverifikasi.
 * Tidak melakukan verifikasi tanda tangan (dilakukan di verifyLicenseProof).
 */
export function evaluateLicense(payload, record, graceDays) {
  if (!payload) return { state: 'unactivated', label: 'Belum diaktifkan', unlocked: false }

  if (payload.status !== 'active') {
    return {
      state: payload.status === 'revoked' ? 'revoked' : 'inactive',
      label: payload.status === 'revoked' ? 'Lisensi dicabut' : 'Lisensi tidak aktif',
      unlocked: false,
    }
  }

  if (payload.expiresAt) {
    const expiry = new Date(payload.expiresAt).getTime()
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      return { state: 'expired', label: 'Lisensi kedaluwarsa', unlocked: false, expiresAt: payload.expiresAt }
    }
  }

  const allowedDays = Number.isInteger(payload.offlineGraceDays) ? payload.offlineGraceDays : graceDays
  const sinceVerify = daysSince(record?.lastVerifiedAt || record?.activatedAt)

  if (sinceVerify > allowedDays) {
    return {
      state: 'offline_grace_expired',
      label: 'Masa toleransi offline berakhir',
      unlocked: false,
      graceDays: allowedDays,
      daysSinceVerify: sinceVerify,
    }
  }

  return {
    state: sinceVerify > 0 ? 'offline_grace' : 'active',
    label: sinceVerify > 0 ? `Aktif (offline ${sinceVerify} hari)` : 'Aktif',
    unlocked: true,
    graceDays: allowedDays,
    daysSinceVerify: sinceVerify,
    daysLeft: Math.max(allowedDays - sinceVerify, 0),
    expiresAt: payload.expiresAt ?? null,
  }
}

export async function getLicenseStatus() {
  const [record, graceDays, devMode] = await Promise.all([
    readLicenseRecord(),
    getOfflineGraceDays(),
    getDevMode(),
  ])

  if (record?.proof) {
    try {
      const payload = await verifyLicenseProof(record.proof)
      const status = evaluateLicense(payload, record, graceDays)
      return {
        record,
        payload,
        status,
        devMode: false,
        unlocked: status.state === 'active' || status.state === 'offline_grace',
        error: null,
      }
    } catch (error) {
      return {
        record,
        payload: null,
        status: { state: 'invalid', label: 'Bukti lisensi tidak valid', unlocked: false },
        devMode: false,
        unlocked: false,
        error: error instanceof LicenseError ? error.message : 'Bukti lisensi tidak dapat diverifikasi.',
      }
    }
  }

  if (devMode) {
    return {
      record: null,
      payload: null,
      status: { state: 'dev_mode', label: 'Mode pengembangan', unlocked: true },
      devMode: true,
      unlocked: true,
      error: null,
    }
  }

  return {
    record: null,
    payload: null,
    status: { state: 'unactivated', label: 'Belum diaktifkan', unlocked: false },
    devMode: false,
    unlocked: false,
    error: null,
  }
}

export async function enableDevMode(enabled) {
  await setDevMode(enabled)
  await addAuditLog({
    action: enabled ? 'dev_mode_on' : 'dev_mode_off',
    entity: 'license',
    entityId: 'dev',
    description: enabled
      ? 'Mode pengembangan diaktifkan (tanpa lisensi sah)'
      : 'Mode pengembangan dimatikan',
  })
}

export async function removeLicense() {
  const record = await readLicenseRecord()
  await clearLicenseRecord()
  await addAuditLog({
    action: 'license_remove',
    entity: 'license',
    entityId: record?.payload?.licenseId ?? null,
    description: 'Lisensi dihapus dari perangkat ini',
  })
}

/** Status apakah aktivasi online dapat dicoba (server dikonfigurasi). */
export function isLicenseServerConfigured() {
  return Boolean(LICENSE_API_URL)
}

export function isPublicKeyConfigured() {
  return Boolean(LICENSE_PUBLIC_KEY_JWK)
}

function assertLicenseServerUsable() {
  if (!LICENSE_API_URL) {
    throw new LicenseError(
      'Server lisensi belum dikonfigurasi pada aplikasi ini (VITE_LICENSE_API_URL kosong). Aktivasi online tidak dapat dilakukan.',
      'NO_SERVER',
    )
  }

  let url
  try {
    url = new URL(LICENSE_API_URL)
  } catch {
    throw new LicenseError('Alamat server lisensi tidak valid.', 'BAD_SERVER')
  }

  const isLocalhost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !isLocalhost) {
    throw new LicenseError(
      'Alamat server lisensi harus memakai HTTPS agar email dan token tidak dikirim tanpa enkripsi.',
      'INSECURE_SERVER',
    )
  }
}

async function postJson(path, body) {
  const endpoint = `${LICENSE_API_URL.replace(/\/+$/, '')}${path}`
  let response

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new LicenseError(
      'Tidak dapat menghubungi server lisensi. Periksa koneksi internet Anda, lalu coba lagi.',
      'NETWORK_ERROR',
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.message || defaultMessageForStatus(response.status)
    throw new LicenseError(message, `HTTP_${response.status}`)
  }

  if (!data?.proof) {
    throw new LicenseError('Server lisensi tidak mengirimkan bukti aktivasi.', 'NO_PROOF')
  }

  return data
}

function defaultMessageForStatus(status) {
  if (status === 401 || status === 403) return 'Email atau token lisensi tidak cocok.'
  if (status === 404) return 'Token lisensi tidak ditemukan.'
  if (status === 409) return 'Lisensi sudah aktif di perangkat lain. Ajukan pemindahan perangkat ke administrator.'
  if (status === 429) return 'Terlalu banyak percobaan aktivasi. Coba lagi beberapa saat.'
  return `Server lisensi menolak permintaan (kode ${status}).`
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
