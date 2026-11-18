import { AlertTriangle, Calculator, Plus, Save, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import { getBusinessProfile } from '../../database/repositories/businessProfileRepo'
import { saveProductCost } from '../../database/repositories/hppRepo'
import { toDateKey } from '../../utils/dates'
import { formatNumber, formatPercent, formatRupiah } from '../../utils/money'
import {
  COST_TYPES,
  calculateUnitCost,
  componentSubtotal,
  createEmptyComponent,
  marginPercent,
  markupPercent,
  profitPerUnit,
  recommendedSellingPrice,
  summarizeComponents,
} from '../../utils/hpp'
import { BUSINESS_TYPES, productCostSchema, toFieldErrors } from '../../utils/validation'

export default function HppCalculator() {
  const toast = useToast()

  const data = useLiveQuery(async () => {
    const [products, profile] = await Promise.all([db.products.toArray(), getBusinessProfile()])
    return {
      products: products.sort((a, b) => a.name.localeCompare(b.name, 'id')),
      profile,
    }
  }, [])

  const [productId, setProductId] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(toDateKey())
  const [batchQuantity, setBatchQuantity] = useState('1')
  const [components, setComponents] = useState(() => [createEmptyComponent()])
  const [sellingPrice, setSellingPrice] = useState('')
  const [targetMargin, setTargetMargin] = useState('30')
  const [note, setNote] = useState('')
  const [applyToProduct, setApplyToProduct] = useState(true)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const selectedProduct = useMemo(
    () => (data?.products ?? []).find((product) => product.id === productId) ?? null,
    [data, productId],
  )

  useEffect(() => {
    const profileType = data?.profile?.businessType
    if (!businessType && profileType) {
      setBusinessType(BUSINESS_TYPES.includes(profileType) ? profileType : 'Lainnya')
    }
  }, [data, businessType])

  // Baris yang benar-benar diisi ikut dihitung; baris kosong diabaikan.
  const rows = useMemo(
    () =>
      components.filter(
        (component) =>
          component.name.trim() !== '' || Number(component.unitCost) > 0 || Number(component.quantity) !== 1,
      ),
    [components],
  )

  const summary = useMemo(() => summarizeComponents(rows), [rows])
  const batch = Number(batchQuantity || 0)
  const unitCost = calculateUnitCost(summary.totalCost, batch)
  const selling = Number(sellingPrice || 0)
  const margin = marginPercent(selling, unitCost)
  const markup = markupPercent(selling, unitCost)
  const profit = profitPerUnit(selling, unitCost)
  const recommended = recommendedSellingPrice(unitCost, Number(targetMargin || 0))
  const previousHpp = Number(selectedProduct?.hpp || 0)
  const difference = unitCost - previousHpp

  function setField(name, value, setter) {
    setter(value)
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function handleProductChange(nextProductId) {
    setField('productId', nextProductId, setProductId)
    const product = (data?.products ?? []).find((item) => item.id === nextProductId)
    if (product) setSellingPrice(String(product.sellingPrice ?? 0))
  }

  function updateComponent(key, field, value) {
    setComponents((current) =>
      current.map((component) => (component.key === key ? { ...component, [field]: value } : component)),
    )
    setErrors((current) => {
      if (!current.components) return current
      const next = { ...current }
      delete next.components
      return next
    })
  }

  function addComponent() {
    setComponents((current) => [...current, createEmptyComponent()])
  }

  function removeComponent(key) {
    setComponents((current) => current.filter((component) => component.key !== key))
  }

  const purchaseLabel = selectedProduct?.type === 'jasa' ? 'Biaya dasar jasa' : 'Harga beli produk'
  const hasPurchaseRow = components.some(
    (component) => component.name.trim().toLowerCase() === purchaseLabel.toLowerCase(),
  )

  function addPurchaseComponent() {
    if (!selectedProduct || hasPurchaseRow) return
    setComponents((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        costType: 'bahan',
        name: purchaseLabel,
        quantity: '1',
        unitLabel: '',
        unitCost: String(selectedProduct.purchasePrice ?? 0),
      },
    ])
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      productId,
      businessType,
      effectiveDate,
      batchQuantity: Number(batchQuantity || 0),
      sellingPrice: Number(sellingPrice || 0),
      targetMargin: Number(targetMargin || 0),
      note,
      components: rows.map((component) => ({
        costType: component.costType,
        name: component.name,
        quantity: Number(component.quantity || 0),
        unitLabel: component.unitLabel,
        unitCost: Number(component.unitCost || 0),
      })),
    }

    const parsed = productCostSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push('Periksa kembali data perhitungan HPP yang ditandai merah.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      const result = await saveProductCost({ ...parsed.data, applyToProduct })
      toast.push(
        result.applied
          ? `HPP ${formatRupiah(result.record.unitCost)} per unit tersimpan dan diterapkan ke produk.`
          : `Perhitungan HPP ${formatRupiah(result.record.unitCost)} per unit tersimpan.`,
      )
      setComponents([createEmptyComponent()])
      setNote('')
      setErrors({})
    } catch (error) {
      toast.push(error?.message ?? 'Perhitungan HPP gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="muted">Memuat produk...</p>
        </CardBody>
      </Card>
    )
  }

  if (data.products.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={Calculator}
            title="Belum ada produk"
            description="Kalkulator HPP menghitung biaya per produk. Tambahkan produk terlebih dahulu di halaman Produk."
            action={
              <Link to="/produk" className="btn btn--primary">
                Buka halaman Produk
              </Link>
            }
          />
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="grid grid--sidebar">
      <Card>
        <CardHeader
          title="Perhitungan HPP"
          subtitle="Masukkan seluruh biaya untuk satu batch, lalu tentukan jumlah unit yang dihasilkan."
          icon={Calculator}
        />
        <CardBody>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <Field label="Produk" htmlFor="hppProduct" required error={errors.productId}>
                <select
                  id="hppProduct"
                  className={`select ${errors.productId ? 'select--error' : ''}`.trim()}
                  value={productId}
                  onChange={(event) => handleProductChange(event.target.value)}
                >
                  <option value="">Pilih produk</option>
                  {data.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.isActive === false ? ' (nonaktif)' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Jenis usaha" htmlFor="hppBusinessType" required error={errors.businessType}>
                <select
                  id="hppBusinessType"
                  className={`select ${errors.businessType ? 'select--error' : ''}`.trim()}
                  value={businessType}
                  onChange={(event) => setField('businessType', event.target.value, setBusinessType)}
                >
                  <option value="">Pilih jenis usaha</option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Tanggal berlaku"
                htmlFor="hppDate"
                required
                error={errors.effectiveDate}
                hint="Tanggal HPP ini mulai berlaku."
              >
                <input
                  id="hppDate"
                  type="date"
                  className={`input ${errors.effectiveDate ? 'input--error' : ''}`.trim()}
                  value={effectiveDate}
                  onChange={(event) => setField('effectiveDate', event.target.value, setEffectiveDate)}
                />
              </Field>

              <Field
                label="Jumlah unit per batch"
                htmlFor="hppBatch"
                required
                error={errors.batchQuantity}
                hint="Total biaya dibagi jumlah ini menjadi HPP per unit."
              >
                <input
                  id="hppBatch"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={`input ${errors.batchQuantity ? 'input--error' : ''}`.trim()}
                  value={batchQuantity}
                  onChange={(event) => setField('batchQuantity', event.target.value, setBatchQuantity)}
                  placeholder="1"
                />
              </Field>

              <div className="field form-grid__full">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="field__label">Komponen biaya</span>
                  <div className="row" style={{ gap: 8 }}>
                    {selectedProduct ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={addPurchaseComponent}
                        disabled={hasPurchaseRow}
                      >
                        Isi {purchaseLabel.toLowerCase()}
                      </Button>
                    ) : null}
                    <Button variant="secondary" size="sm" icon={Plus} onClick={addComponent}>
                      Tambah komponen
                    </Button>
                  </div>
                </div>

                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table className="table component-table">
                    <thead>
                      <tr>
                        <th>Jenis</th>
                        <th>Nama komponen</th>
                        <th>Jumlah</th>
                        <th>Satuan</th>
                        <th>Harga satuan</th>
                        <th>Subtotal</th>
                        <th aria-label="Aksi" />
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((component) => (
                        <tr key={component.key}>
                          <td>
                            <select
                              className="select"
                              value={component.costType}
                              aria-label="Jenis komponen biaya"
                              onChange={(event) => updateComponent(component.key, 'costType', event.target.value)}
                            >
                              {COST_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="component-table__name">
                            <input
                              className="input"
                              value={component.name}
                              aria-label="Nama komponen"
                              placeholder="Contoh: Ayam fillet"
                              maxLength={80}
                              onChange={(event) => updateComponent(component.key, 'name', event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={component.quantity}
                              aria-label="Jumlah komponen"
                              onChange={(event) => updateComponent(component.key, 'quantity', event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              value={component.unitLabel}
                              aria-label="Satuan komponen"
                              placeholder="kg"
                              maxLength={20}
                              onChange={(event) => updateComponent(component.key, 'unitLabel', event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              step="1"
                              value={component.unitCost}
                              aria-label="Harga satuan komponen"
                              onChange={(event) => updateComponent(component.key, 'unitCost', event.target.value)}
                            />
                          </td>
                          <td className="table__amount">{formatRupiah(componentSubtotal(component))}</td>
                          <td>
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Hapus komponen"
                              aria-label="Hapus komponen"
                              onClick={() => removeComponent(component.key)}
                              disabled={components.length === 1}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'right' }}>
                          Total biaya batch
                        </td>
                        <td className="table__amount">
                          <strong>{formatRupiah(summary.totalCost)}</strong>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {errors.components ? (
                  <p className="field__error" role="alert">
                    {errors.components}
                  </p>
                ) : (
                  <p className="field__hint">
                    Subtotal = jumlah x harga satuan. Total dibagi jumlah unit menjadi HPP per unit.
                  </p>
                )}
              </div>

              <Field
                label="Harga jual (simulasi)"
                htmlFor="hppSelling"
                error={errors.sellingPrice}
                hint="Tidak mengubah harga jual produk; hanya untuk simulasi margin."
              >
                <input
                  id="hppSelling"
                  type="number"
                  min="0"
                  step="1"
                  className={`input ${errors.sellingPrice ? 'input--error' : ''}`.trim()}
                  value={sellingPrice}
                  onChange={(event) => setField('sellingPrice', event.target.value, setSellingPrice)}
                  placeholder="0"
                />
              </Field>

              <Field
                label="Target margin (%)"
                htmlFor="hppTargetMargin"
                error={errors.targetMargin}
                hint="Dipakai untuk menghitung harga jual rekomendasi."
              >
                <input
                  id="hppTargetMargin"
                  type="number"
                  min="0"
                  max="99"
                  step="0.1"
                  className={`input ${errors.targetMargin ? 'input--error' : ''}`.trim()}
                  value={targetMargin}
                  onChange={(event) => setField('targetMargin', event.target.value, setTargetMargin)}
                />
              </Field>

              <div className="field form-grid__full">
                <span className="field__label">Simulasi margin</span>
                <div className="summary-pills">
                  <span className="summary-pill">
                    Margin kotor
                    <strong>{formatPercent(margin)}</strong>
                  </span>
                  <span className="summary-pill">
                    Markup
                    <strong>{formatPercent(markup)}</strong>
                  </span>
                  <span className="summary-pill">
                    Laba per unit
                    <strong>{formatRupiah(profit)}</strong>
                  </span>
                  <span className="summary-pill">
                    Harga untuk target
                    <strong>{recommended > 0 ? formatRupiah(recommended) : '-'}</strong>
                  </span>
                </div>
                {recommended > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <Button variant="ghost" size="sm" icon={Wand2} onClick={() => setSellingPrice(String(recommended))}>
                      Pakai harga rekomendasi
                    </Button>
                  </div>
                ) : null}
              </div>

              <Field label="Catatan perhitungan" htmlFor="hppNote" error={errors.note} className="form-grid__full">
                <textarea
                  id="hppNote"
                  className={`textarea ${errors.note ? 'textarea--error' : ''}`.trim()}
                  value={note}
                  onChange={(event) => setField('note', event.target.value, setNote)}
                  placeholder="Contoh: harga bahan dari pasar per 18 November, batch 20 porsi."
                  maxLength={300}
                  rows={2}
                />
              </Field>

              <div className="field form-grid__full">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={applyToProduct}
                    onChange={(event) => setApplyToProduct(event.target.checked)}
                  />
                  <span>
                    Terapkan HPP ke produk
                    <small>
                      HPP produk diperbarui dan perubahan tercatat di riwayat harga. Matikan bila hanya ingin menyimpan
                      perhitungan.
                    </small>
                  </span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <Button type="submit" icon={Save} loading={saving}>
                {applyToProduct ? 'Simpan & terapkan HPP' : 'Simpan perhitungan'}
              </Button>
              <span className="form-note">
                {unitCost > 0
                  ? `HPP ${formatRupiah(unitCost)} per unit dari ${rows.length} komponen.`
                  : 'Isi minimal satu komponen biaya untuk menghitung HPP.'}
              </span>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="hpp-sidebar">
        <Card>
          <CardHeader title="Ringkasan biaya" subtitle="Satu batch" icon={Calculator} />
          <CardBody>
            <dl className="info-list">
              <div>
                <dt>Total biaya batch</dt>
                <dd>{formatRupiah(summary.totalCost)}</dd>
              </div>
              <div>
                <dt>Jumlah unit</dt>
                <dd>{formatNumber(batch > 0 ? batch : 0)}</dd>
              </div>
              <div>
                <dt>HPP per unit</dt>
                <dd>
                  <strong>{formatRupiah(unitCost)}</strong>
                </dd>
              </div>
            </dl>

            <div className="summary-pills" style={{ marginTop: 12 }}>
              {COST_TYPES.map((type) => (
                <span className="summary-pill" key={type.value}>
                  {type.label}
                  <strong>{formatRupiah(summary[type.value])}</strong>
                </span>
              ))}
            </div>

            {rows.length === 0 ? (
              <p className="form-note" style={{ marginTop: 10 }}>
                <AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />
                Belum ada komponen biaya yang diisi.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Perbandingan HPP" subtitle="Hasil hitung vs produk" />
          <CardBody>
            {selectedProduct ? (
              <dl className="info-list">
                <div>
                  <dt>HPP produk saat ini</dt>
                  <dd>{formatRupiah(previousHpp)}</dd>
                </div>
                <div>
                  <dt>HPP hasil perhitungan</dt>
                  <dd>
                    <strong>{formatRupiah(unitCost)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Selisih</dt>
                  <dd>
                    {difference === 0
                      ? 'Tidak berubah'
                      : `${difference > 0 ? 'Naik' : 'Turun'} ${formatRupiah(Math.abs(difference))}`}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {unitCost <= 0 ? (
                      <Badge tone="gray">Belum dihitung</Badge>
                    ) : difference > 0 ? (
                      <Badge tone="amber">HPP naik</Badge>
                    ) : difference < 0 ? (
                      <Badge tone="green">HPP turun</Badge>
                    ) : (
                      <Badge tone="gray">Sama dengan produk</Badge>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="muted">Pilih produk untuk membandingkan HPP lama dengan hasil perhitungan.</p>
            )}

            {selling > 0 && unitCost > selling ? (
              <p className="form-note" style={{ marginTop: 10 }}>
                <AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />
                Harga jual simulasi lebih rendah dari HPP, sehingga laba per unit negatif.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
