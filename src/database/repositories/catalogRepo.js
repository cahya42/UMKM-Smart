import { db } from '../db'
import { addAuditLog } from './auditLogRepo'

/**
 * Kategori dan satuan produk. Keduanya data referensi yang boleh ditambah
 * pengguna, tetapi tidak boleh dihapus jika masih dipakai produk.
 */

export async function listCategories() {
  return db.categories.orderBy('name').toArray()
}

export async function createCategory({ name }) {
  const cleanName = name.trim()

  return db.transaction('rw', db.categories, db.audit_logs, async (tx) => {
    const existing = await tx.table('categories').toArray()
    const duplicate = existing.some((category) => category.name.toLowerCase() === cleanName.toLowerCase())
    if (duplicate) throw new Error(`Kategori "${cleanName}" sudah ada.`)

    const now = new Date().toISOString()
    const record = {
      id: crypto.randomUUID(),
      name: cleanName,
      type: 'produk',
      createdAt: now,
      updatedAt: now,
    }
    await tx.table('categories').add(record)
    await addAuditLog(
      {
        action: 'create',
        entity: 'category',
        entityId: record.id,
        description: `Menambah kategori ${record.name}`,
      },
      tx,
    )
    return record
  })
}

export async function updateCategory(categoryId, { name }) {
  const cleanName = name.trim()

  return db.transaction('rw', db.categories, db.audit_logs, async (tx) => {
    const category = await tx.table('categories').get(categoryId)
    if (!category) throw new Error('Kategori tidak ditemukan.')

    const all = await tx.table('categories').toArray()
    const duplicate = all.some(
      (item) => item.id !== categoryId && item.name.toLowerCase() === cleanName.toLowerCase(),
    )
    if (duplicate) throw new Error(`Kategori "${cleanName}" sudah ada.`)

    const updated = { ...category, name: cleanName, updatedAt: new Date().toISOString() }
    await tx.table('categories').put(updated)
    await addAuditLog(
      {
        action: 'update',
        entity: 'category',
        entityId: categoryId,
        description: `Mengubah kategori ${category.name} menjadi ${cleanName}`,
      },
      tx,
    )
    return updated
  })
}

export async function deleteCategory(categoryId) {
  return db.transaction('rw', db.categories, db.products, db.audit_logs, async (tx) => {
    const category = await tx.table('categories').get(categoryId)
    if (!category) throw new Error('Kategori tidak ditemukan.')

    const usedBy = await tx.table('products').where('categoryId').equals(categoryId).count()
    if (usedBy > 0) {
      throw new Error(
        `Kategori "${category.name}" masih dipakai ${usedBy} produk. Pindahkan produk ke kategori lain terlebih dahulu.`,
      )
    }

    await tx.table('categories').delete(categoryId)
    await addAuditLog(
      {
        action: 'delete',
        entity: 'category',
        entityId: categoryId,
        description: `Menghapus kategori ${category.name}`,
      },
      tx,
    )
  })
}

export async function listUnits() {
  return db.units.orderBy('name').toArray()
}

export async function createUnit({ name, description = '' }) {
  const cleanName = name.trim()

  return db.transaction('rw', db.units, db.audit_logs, async (tx) => {
    const existing = await tx.table('units').toArray()
    const duplicate = existing.some((unit) => unit.name.toLowerCase() === cleanName.toLowerCase())
    if (duplicate) throw new Error(`Satuan "${cleanName}" sudah ada.`)

    const now = new Date().toISOString()
    const record = {
      id: crypto.randomUUID(),
      name: cleanName,
      description: description.trim(),
      createdAt: now,
      updatedAt: now,
    }
    await tx.table('units').add(record)
    await addAuditLog(
      {
        action: 'create',
        entity: 'unit',
        entityId: record.id,
        description: `Menambah satuan ${record.name}`,
      },
      tx,
    )
    return record
  })
}

export async function updateUnit(unitId, { name, description = '' }) {
  const cleanName = name.trim()

  return db.transaction('rw', db.units, db.audit_logs, async (tx) => {
    const unit = await tx.table('units').get(unitId)
    if (!unit) throw new Error('Satuan tidak ditemukan.')

    const all = await tx.table('units').toArray()
    const duplicate = all.some(
      (item) => item.id !== unitId && item.name.toLowerCase() === cleanName.toLowerCase(),
    )
    if (duplicate) throw new Error(`Satuan "${cleanName}" sudah ada.`)

    const updated = {
      ...unit,
      name: cleanName,
      description: description.trim(),
      updatedAt: new Date().toISOString(),
    }
    await tx.table('units').put(updated)
    await addAuditLog(
      {
        action: 'update',
        entity: 'unit',
        entityId: unitId,
        description: `Mengubah satuan ${unit.name} menjadi ${cleanName}`,
      },
      tx,
    )
    return updated
  })
}

export async function deleteUnit(unitId) {
  return db.transaction('rw', db.units, db.products, db.audit_logs, async (tx) => {
    const unit = await tx.table('units').get(unitId)
    if (!unit) throw new Error('Satuan tidak ditemukan.')

    const usedBy = await tx.table('products').where('unitId').equals(unitId).count()
    if (usedBy > 0) {
      throw new Error(
        `Satuan "${unit.name}" masih dipakai ${usedBy} produk. Pindahkan produk ke satuan lain terlebih dahulu.`,
      )
    }

    await tx.table('units').delete(unitId)
    await addAuditLog(
      {
        action: 'delete',
        entity: 'unit',
        entityId: unitId,
        description: `Menghapus satuan ${unit.name}`,
      },
      tx,
    )
  })
}
