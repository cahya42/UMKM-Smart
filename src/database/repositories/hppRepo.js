import { db } from '../db'
import { formatRupiah, toQuantity, toRupiah } from '../../utils/money'
import { calculateUnitCost, componentSubtotal, marginPercent, markupPercent, summarizeComponents } from '../../utils/hpp'
import { addAuditLog } from './auditLogRepo'

/**
 * Setiap perhitungan HPP disimpan sebagai satu record `product_costs` beserta
 * komponennya di `cost_components`. Riwayat tidak diubah atau dihapus: koreksi
 * dilakukan dengan perhitungan baru agar dapat diaudit.
 */

function normalizeComponent(input) {
  const quantity = toQuantity(input.quantity)
  const unitCost = toRupiah(input.unitCost)

  return {
    costType: input.costType,
    name: (input.name ?? '').trim(),
    quantity,
    unitLabel: (input.unitLabel ?? '').trim(),
    unitCost,
    subtotal: componentSubtotal({ quantity, unitCost }),
  }
}

/**
 * Menyimpan hasil kalkulator HPP.
 * Bila `applyToProduct` benar, HPP produk ikut diperbarui dan perubahan
 * tercatat pada riwayat harga produk dalam transaksi yang sama.
 */
export async function saveProductCost(input) {
  const components = (input.components ?? [])
    .filter((component) => (component.name ?? '').trim() !== '')
    .map(normalizeComponent)

  if (components.length === 0) {
    throw new Error('Tambahkan minimal satu komponen biaya.')
  }
  if (components.some((component) => !(component.quantity > 0))) {
    throw new Error('Jumlah setiap komponen biaya harus lebih dari 0.')
  }

  const batchQuantity = toQuantity(input.batchQuantity)
  if (!(batchQuantity > 0)) {
    throw new Error('Jumlah unit per batch harus lebih dari 0.')
  }

  const summary = summarizeComponents(components)
  const unitCost = calculateUnitCost(summary.totalCost, batchQuantity)
  const sellingPrice = toRupiah(input.sellingPrice)
  const targetMargin = Number(input.targetMargin) || 0
  const applyToProduct = input.applyToProduct !== false

  return db.transaction(
    'rw',
    db.products,
    db.product_costs,
    db.cost_components,
    db.product_price_history,
    db.audit_logs,
    async (tx) => {
      const product = await tx.table('products').get(input.productId)
      if (!product) throw new Error('Produk tidak ditemukan.')

      const previousHpp = toRupiah(product.hpp)
      const now = new Date().toISOString()
      const costId = crypto.randomUUID()

      const record = {
        id: costId,
        productId: product.id,
        productName: product.name,
        businessType: input.businessType,
        effectiveDate: input.effectiveDate,
        batchQuantity,
        materialCost: summary.materialCost,
        laborCost: summary.laborCost,
        overheadCost: summary.overheadCost,
        otherCost: summary.otherCost,
        totalCost: summary.totalCost,
        unitCost,
        previousHpp,
        sellingPrice,
        targetMargin,
        marginPercent: marginPercent(sellingPrice, unitCost),
        markupPercent: markupPercent(sellingPrice, unitCost),
        appliedToProduct: applyToProduct,
        note: (input.note ?? '').trim(),
        createdAt: now,
        updatedAt: now,
      }

      await tx.table('product_costs').add(record)
      await tx.table('cost_components').bulkAdd(
        components.map((component) => ({
          id: crypto.randomUUID(),
          productCostId: costId,
          productId: product.id,
          createdAt: now,
          ...component,
        })),
      )

      const hppChanged = unitCost !== previousHpp

      if (applyToProduct && hppChanged) {
        await tx.table('products').update(product.id, { hpp: unitCost, updatedAt: now })

        await tx.table('product_price_history').add({
          id: crypto.randomUUID(),
          productId: product.id,
          purchasePrice: toRupiah(product.purchasePrice),
          sellingPrice: toRupiah(product.sellingPrice),
          hpp: unitCost,
          source: 'hpp_calculator',
          note: `HPP dari kalkulator ${formatRupiah(previousHpp)} -> ${formatRupiah(unitCost)}`,
          changedAt: now,
        })

        await addAuditLog(
          {
            action: 'price_change',
            entity: 'product',
            entityId: product.id,
            description: `Mengubah HPP ${product.name} dari ${formatRupiah(previousHpp)} menjadi ${formatRupiah(unitCost)}`,
            metadata: { source: 'hpp_calculator', productCostId: costId },
          },
          tx,
        )
      }

      await addAuditLog(
        {
          action: 'hpp_calculate',
          entity: 'product_cost',
          entityId: costId,
          description: `Menghitung HPP ${product.name}: ${formatRupiah(unitCost)} per unit dari ${components.length} komponen`,
          metadata: {
            productId: product.id,
            totalCost: summary.totalCost,
            batchQuantity,
            unitCost,
            applied: applyToProduct && hppChanged,
          },
        },
        tx,
      )

      return { record, components, applied: applyToProduct && hppChanged }
    },
  )
}

/** Riwayat perhitungan HPP, terbaru lebih dulu. `productId` bersifat opsional. */
export async function listProductCosts({ productId } = {}) {
  const rows = productId
    ? await db.product_costs.where('productId').equals(productId).toArray()
    : await db.product_costs.toArray()

  return rows.sort((a, b) =>
    `${b.effectiveDate ?? ''}${b.createdAt ?? ''}`.localeCompare(`${a.effectiveDate ?? ''}${a.createdAt ?? ''}`),
  )
}

/** Satu perhitungan beserta komponennya untuk dialog detail. */
export async function getProductCostDetail(productCostId) {
  const record = await db.product_costs.get(productCostId)
  if (!record) return null

  const components = await db.cost_components.where('productCostId').equals(productCostId).toArray()
  components.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))

  return { record, components }
}
