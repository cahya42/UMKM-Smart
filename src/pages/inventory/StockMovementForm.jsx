import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Plus, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../database/db'
import { recordStockMovement } from '../../database/repositories/stockRepo'
import ContactFormDialog from '../contacts/ContactFormDialog'
import { formatNumber, toQuantity } from '../../utils/money'
import { toDateKey } from '../../utils/dates'
import { OUT_REASONS } from '../../utils/inventory'
import { stockMovementSchema, toFieldErrors } from '../../utils/validation'

const MODE_CONFIG = {
  masuk: {
    title: 'Catat barang masuk',
    description: 'Gunakan saat membeli atau menerima barang dari pemasok.',
    icon: ArrowDownToLine,
    quantityLabel: 'Jumlah masuk',
    submitLabel: 'Simpan barang masuk',
  },
  keluar: {
    title: 'Catat barang keluar',
    description: 'Untuk barang rusak, hilang, pemakaian internal, atau retur ke pemasok. Penjualan dicatat di menu Penjualan.',
    icon: ArrowUpFromLine,
    quantityLabel: 'Jumlah keluar',
    submitLabel: 'Simpan barang keluar',
  },
  penyesuaian: {
    title: 'Penyesuaian stok (stock opname)',
    description: 'Masukkan jumlah stok hasil hitung fisik. Selisih dengan catatan akan dicatat sebagai penyesuaian.',
    icon: ClipboardCheck,
    quantityLabel: 'Stok hasil hitung',
    submitLabel: 'Simpan penyesuaian',
  },
}

const EMPTY_FORM = {
  productId: '',
  quantity: '',
  date: toDateKey(),
  note: '',
  unitCost: '',
  supplierName: '',
  supplierId: '',
  reason: '',
}

export default function StockMovementForm({ mode, products, units, loading }) {
  const config = MODE_CONFIG[mode]
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)

  const suppliers = useLiveQuery(
    async () =>
      (await db.suppliers.toArray())
        .filter((supplier) => supplier.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [],
  ) ?? []

  useEffect(() => {
    setForm((current) => ({ ...EMPTY_FORM, productId: current.productId, date: toDateKey() }))
    setErrors({})
  }, [mode])

  const unitMap = new Map(units.map((unit) => [unit.id, unit.name]))
  const selected = products.find((product) => product.id === form.productId)
  const Icon = config.icon

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      productId: form.productId,
      type: mode,
      quantity: Number(form.quantity || 0),
      date: form.date,
      note: form.note,
      unitCost: Number(form.unitCost || 0),
      supplierName: form.supplierName,
      supplierId: form.supplierId,
      reason: form.reason,
    }

    const parsed = stockMovementSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      return
    }
    if ((mode === 'masuk' || mode === 'keluar') && parsed.data.quantity <= 0) {
      setErrors({ quantity: 'Jumlah harus lebih dari 0.' })
      return
    }

    setSaving(true)
    try {
      await recordStockMovement(parsed.data)
      toast.push(
        mode === 'masuk'
          ? 'Barang masuk dicatat dan stok diperbarui.'
          : mode === 'keluar'
            ? 'Barang keluar dicatat dan stok diperbarui.'
            : 'Penyesuaian stok dicatat.',
      )
      setForm((current) => ({
        ...EMPTY_FORM,
        productId: current.productId,
        date: toDateKey(),
      }))
      setErrors({})
    } catch (error) {
      toast.push(error?.message ?? 'Pergerakan stok gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Card>
      <CardHeader title={config.title} subtitle={config.description} icon={Icon} />
      <CardBody>
        {loading ? (
          <p className="muted">Memuat produk...</p>
        ) : products.length === 0 ? (
          <p className="muted">
            Belum ada produk barang yang melacak stok. Tambahkan produk terlebih dahulu di menu Produk.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <Field label="Produk" htmlFor="movementProduct" required error={errors.productId} className="form-grid__full">
                <select
                  id="movementProduct"
                  className={`select ${errors.productId ? 'select--error' : ''}`.trim()}
                  value={form.productId}
                  onChange={(event) => setField('productId', event.target.value)}
                >
                  <option value="">Pilih produk</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({formatNumber(product.stockQty)} {unitMap.get(product.unitId) ?? ''})
                    </option>
                  ))}
                </select>
              </Field>

              {selected ? (
                <div className="alert alert--info form-grid__full">
                  <Icon size={17} />
                  <div>
                    Stok {selected.name} saat ini <strong>{formatNumber(toQuantity(selected.stockQty))}</strong>{' '}
                    {unitMap.get(selected.unitId) ?? ''}.
                    {mode === 'penyesuaian' ? ' Masukkan hasil hitung fisik di bawah.' : ''}
                  </div>
                </div>
              ) : null}

              <Field label={config.quantityLabel} htmlFor="movementQuantity" required error={errors.quantity}>
                <input
                  id="movementQuantity"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`input ${errors.quantity ? 'input--error' : ''}`.trim()}
                  value={form.quantity}
                  onChange={(event) => setField('quantity', event.target.value)}
                  placeholder="0"
                />
              </Field>

              <Field label="Tanggal" htmlFor="movementDate" required error={errors.date}>
                <input
                  id="movementDate"
                  type="date"
                  className={`input ${errors.date ? 'input--error' : ''}`.trim()}
                  value={form.date}
                  onChange={(event) => setField('date', event.target.value)}
                  max={toDateKey()}
                />
              </Field>

              {mode === 'masuk' ? (
                <>
                  <Field
                    label="Harga beli per satuan"
                    htmlFor="movementUnitCost"
                    error={errors.unitCost}
                    hint="Opsional, hanya catatan pembelian. Harga produk diubah di menu Produk."
                  >
                    <input
                      id="movementUnitCost"
                      type="number"
                      min="0"
                      step="1"
                      className={`input ${errors.unitCost ? 'input--error' : ''}`.trim()}
                      value={form.unitCost}
                      onChange={(event) => setField('unitCost', event.target.value)}
                      placeholder="0"
                    />
                  </Field>

                  <Field
                    label="Pemasok"
                    htmlFor="movementSupplier"
                    error={errors.supplierName}
                    hint="Opsional. Pilih pemasok terdaftar agar barang masuk tercatat pada pemasok tersebut."
                  >
                    <div className="row" style={{ gap: 8 }}>
                      <select
                        id="movementSupplier"
                        className="select"
                        value={form.supplierId}
                        onChange={(event) => setField('supplierId', event.target.value)}
                      >
                        <option value="">Tanpa pemasok</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={() => setSupplierDialogOpen(true)}
                      >
                        Baru
                      </Button>
                    </div>
                  </Field>
                </>
              ) : null}

              {mode === 'keluar' ? (
                <Field label="Alasan" htmlFor="movementReason" error={errors.reason}>
                  <select
                    id="movementReason"
                    className="select"
                    value={form.reason}
                    onChange={(event) => setField('reason', event.target.value)}
                  >
                    <option value="">Pilih alasan</option>
                    {OUT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <Field label="Keterangan" htmlFor="movementNote" error={errors.note} className="form-grid__full">
                <textarea
                  id="movementNote"
                  className={`textarea ${errors.note ? 'textarea--error' : ''}`.trim()}
                  value={form.note}
                  onChange={(event) => setField('note', event.target.value)}
                  placeholder={
                    mode === 'masuk'
                      ? 'Contoh: nota pembelian nomor 123'
                      : mode === 'keluar'
                        ? 'Contoh: 2 bungkus rusak saat pengiriman'
                        : 'Contoh: hasil hitung fisik akhir bulan'
                  }
                  maxLength={200}
                  rows={2}
                />
              </Field>
            </div>

            <div className="form-actions">
              <Button type="submit" icon={Save} loading={saving}>
                {config.submitLabel}
              </Button>
              <span className="form-note">Catatan stok tersimpan permanen dan tidak dapat dihapus.</span>
            </div>
          </form>
        )}
      </CardBody>
    </Card>

    <ContactFormDialog
      kind="pemasok"
      open={supplierDialogOpen}
      onClose={() => setSupplierDialogOpen(false)}
      onSaved={(supplier) => setField('supplierId', supplier.id)}
    />
    </>
  )
}
