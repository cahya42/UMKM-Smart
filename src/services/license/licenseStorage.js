import { db } from '../../database/db'
import {
  DEFAULT_OFFLINE_GRACE_DAYS,
  LICENSE_DEV_MODE_KEY,
  LICENSE_GRACE_KEY,
  LICENSE_RECORD_KEY,
} from './constants'

export async function readSetting(key) {
  const record = await db.settings.get(key)
  return record?.value ?? null
}

export async function writeSetting(key, value) {
  await db.settings.put({ key, value, updatedAt: new Date().toISOString() })
}

export async function deleteSetting(key) {
  await db.settings.delete(key)
}

export async function readLicenseRecord() {
  return readSetting(LICENSE_RECORD_KEY)
}

export async function writeLicenseRecord(record) {
  await writeSetting(LICENSE_RECORD_KEY, record)
}

export async function clearLicenseRecord() {
  await deleteSetting(LICENSE_RECORD_KEY)
}

export async function getDevMode() {
  const value = await readSetting(LICENSE_DEV_MODE_KEY)
  return Boolean(value?.enabled)
}

export async function setDevMode(enabled) {
  await writeSetting(LICENSE_DEV_MODE_KEY, {
    enabled: Boolean(enabled),
    enabledAt: enabled ? new Date().toISOString() : null,
  })
}

/** Masa toleransi offline dalam hari (dapat diubah administrator). */
export async function getOfflineGraceDays() {
  const value = await readSetting(LICENSE_GRACE_KEY)
  const days = Number(value)
  return Number.isInteger(days) && days >= 0 ? days : DEFAULT_OFFLINE_GRACE_DAYS
}
