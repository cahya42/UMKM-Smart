import { db } from '../../database/db'
import { INSTALLATION_ID_KEY } from './constants'

/**
 * Identitas perangkat untuk aktivasi lisensi.
 *
 * Catatan penting: ini adalah penanda instalasi yang disimpan di IndexedDB,
 * bukan pengenal perangkat keras yang tidak bisa dipalsukan. Perlindungan
 * lisensi bersifat wajar: tujuannya membatasi satu lisensi untuk satu
 * instalasi, bukan membuat aplikasi mustahil disalin.
 */
export async function getInstallationId() {
  const stored = await db.settings.get(INSTALLATION_ID_KEY)
  if (stored?.value) return stored.value

  const id = crypto.randomUUID()
  await db.settings.put({
    key: INSTALLATION_ID_KEY,
    value: id,
    updatedAt: new Date().toISOString(),
  })
  return id
}

export function getDeviceLabel() {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform || ''
  return `${platform || 'Perangkat'} - ${describeBrowser(userAgent)}`
}

function describeBrowser(userAgent) {
  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/OPR\//.test(userAgent)) return 'Opera'
  if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) return 'Chrome'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'Browser'
}

export async function getDeviceInfo() {
  const id = await getInstallationId()
  return { id, label: getDeviceLabel() }
}
