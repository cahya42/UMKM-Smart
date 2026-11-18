import { db } from '../db'
import { addAuditLog } from './auditLogRepo'

export const BUSINESS_PROFILE_ID = 'primary'

/** Profil usaha tunggal (Single Business Edition). */
export async function getBusinessProfile() {
  const profile = await db.business_profile.get(BUSINESS_PROFILE_ID)
  return profile ?? null
}

/**
 * Menyimpan profil usaha. Profil dan audit log ditulis dalam satu transaksi
 * agar tidak ada data setengah tersimpan.
 */
export async function saveBusinessProfile(input) {
  const timestamp = new Date().toISOString()

  return db.transaction('rw', db.business_profile, db.audit_logs, async (tx) => {
    const existing = await tx.table('business_profile').get(BUSINESS_PROFILE_ID)

    const record = {
      id: BUSINESS_PROFILE_ID,
      businessName: input.businessName.trim(),
      ownerName: input.ownerName?.trim() ?? '',
      businessType: input.businessType,
      address: input.address?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      logoDataUrl: input.logoDataUrl ?? null,
      description: input.description?.trim() ?? '',
      startDate: input.startDate || null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }

    await tx.table('business_profile').put(record)

    await addAuditLog(
      {
        action: existing ? 'update' : 'create',
        entity: 'business_profile',
        entityId: BUSINESS_PROFILE_ID,
        description: existing ? 'Memperbarui profil usaha' : 'Membuat profil usaha',
        metadata: { businessName: record.businessName },
      },
      tx,
    )

    return record
  })
}
