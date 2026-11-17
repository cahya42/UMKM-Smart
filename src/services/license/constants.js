export const APP_VERSION = '0.1.0'

/** Alamat layanan lisensi (HTTPS). Kosong berarti aktivasi online belum dikonfigurasi. */
export const LICENSE_API_URL = (import.meta.env.VITE_LICENSE_API_URL || '').trim()

/**
 * Hanya kunci PUBLIK yang boleh ada di frontend.
 * Private key penanda tangan tetap berada di server lisensi.
 */
export const LICENSE_PUBLIC_KEY_JWK = parsePublicKey(import.meta.env.VITE_LICENSE_PUBLIC_KEY_JWK)

export const DEFAULT_OFFLINE_GRACE_DAYS = 30

/** Kunci penyimpanan di tabel settings (bukan data transaksi). */
export const LICENSE_RECORD_KEY = 'license.record'
export const LICENSE_DEV_MODE_KEY = 'license.devMode'
export const LICENSE_GRACE_KEY = 'license.offlineGraceDays'
export const INSTALLATION_ID_KEY = 'app.installationId'

function parsePublicKey(rawValue) {
  if (!rawValue || typeof rawValue !== 'string' || rawValue.trim() === '') return null
  try {
    const parsed = JSON.parse(rawValue)
    if (parsed?.kty !== 'EC' || parsed?.crv !== 'P-256' || !parsed.x || !parsed.y) return null
    return parsed
  } catch {
    return null
  }
}
