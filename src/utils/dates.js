/**
 * Tanggal usaha memakai zona waktu perangkat, disimpan sebagai 'YYYY-MM-DD'.
 * Jangan memakai new Date('2026-01-01') untuk tanggal usaha karena akan
 * dianggap UTC dan dapat bergeser satu hari di Indonesia (UTC+7).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: 'Minggu ini' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'year', label: 'Tahun ini' },
  { value: 'custom', label: 'Periode khusus' },
]

export function toDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(key) {
  if (typeof key !== 'string') return null
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

export function startOfWeek(date = new Date()) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = result.getDay() // 0 = Minggu
  const diff = day === 0 ? -6 : 1 - day // minggu dimulai Senin
  result.setDate(result.getDate() + diff)
  return result
}

export function endOfWeek(date = new Date()) {
  const start = startOfWeek(date)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function daysBetweenKeys(startKey, endKey) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  if (!start || !end) return 0
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

/**
 * Rentang tanggal untuk filter dashboard dan laporan.
 * @returns {{period: string, startDate: string, endDate: string, label: string, dayCount: number}}
 */
export function getPeriodRange(period, custom = {}) {
  const today = new Date()
  let start = today
  let end = today

  switch (period) {
    case 'week':
      start = startOfWeek(today)
      end = endOfWeek(today)
      break
    case 'month':
      start = startOfMonth(today)
      end = endOfMonth(today)
      break
    case 'year':
      start = new Date(today.getFullYear(), 0, 1)
      end = new Date(today.getFullYear(), 11, 31)
      break
    case 'custom': {
      const customStart = parseDateKey(custom.start)
      const customEnd = parseDateKey(custom.end)
      if (customStart && customEnd) {
        start = customStart <= customEnd ? customStart : customEnd
        end = customStart <= customEnd ? customEnd : customStart
      }
      break
    }
    case 'today':
    default:
      start = today
      end = today
      break
  }

  const startDate = toDateKey(start)
  const endDate = toDateKey(end)

  return {
    period,
    startDate,
    endDate,
    dayCount: daysBetweenKeys(startDate, endDate) + 1,
    label: period === 'today' ? `Hari ini, ${formatLongDate(startDate)}` : `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`,
  }
}

const longDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dayMonthFormatter = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' })
const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })

export function formatLongDate(dateKey) {
  const date = typeof dateKey === 'string' ? parseDateKey(dateKey) : dateKey
  return date ? longDateFormatter.format(date) : '-'
}

export function formatShortDate(dateKey) {
  const date = typeof dateKey === 'string' ? parseDateKey(dateKey) : dateKey
  return date ? shortDateFormatter.format(date) : '-'
}

export function formatDayMonth(dateKey) {
  const date = typeof dateKey === 'string' ? parseDateKey(dateKey) : dateKey
  return date ? dayMonthFormatter.format(date) : '-'
}

export function formatMonthLabel(dateKey) {
  const date = typeof dateKey === 'string' ? parseDateKey(dateKey) : dateKey
  return date ? monthFormatter.format(date) : '-'
}

export function formatDateTime(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '-'
  return `${shortDateFormatter.format(date)} ${timeFormatter.format(date)}`
}

/** Daftar tanggal 'YYYY-MM-DD' dari start sampai end (inklusif). */
export function eachDateKey(startKey, endKey) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  if (!start || !end || start > end) return []

  const keys = []
  let cursor = start
  let guard = 0
  while (cursor <= end && guard < 3700) {
    keys.push(toDateKey(cursor))
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return keys
}

/** Daftar kunci bulan 'YYYY-MM' dari start sampai end (inklusif). */
export function eachMonthKey(startKey, endKey) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  if (!start || !end || start > end) return []

  const keys = []
  let year = start.getFullYear()
  let month = start.getMonth() + 1
  const endYear = end.getFullYear()
  const endMonth = end.getMonth() + 1
  let guard = 0

  while ((year < endYear || (year === endYear && month <= endMonth)) && guard < 240) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    guard += 1
  }
  return keys
}

export function monthKeyOf(dateKey) {
  return typeof dateKey === 'string' ? dateKey.slice(0, 7) : ''
}

/** Jarak hari dari sekarang (dipakai untuk masa toleransi lisensi). */
export function daysSince(isoString) {
  if (!isoString) return 0
  const time = new Date(isoString).getTime()
  if (Number.isNaN(time)) return 0
  return Math.floor((Date.now() - time) / MS_PER_DAY)
}
