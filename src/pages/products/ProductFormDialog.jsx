import { ImagePlus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { listCategories, listUnits } from '../../database/repositories/catalogRepo'
import { createProduct, updateProduct } from '../../database/repositories/productRepo'
import { formatNumber, formatPercent, formatRupiah, grossMargin } from '../../utils/money'
import { productSchema, toFieldErrors } from '../../utils/validation'

const EMPTY_FORM = {
  name: '',
  sku: '',
  type: 'barang',
  categoryId: '',
  unitId: '',
  purchasePrice: '',
  sellingPrice: '',
  hpp: '',
  stockQty: '',
  minStock: '',
  trackStock: true,
  note: '',
  imageDataUrl: null,
}

const MAX_IMAGE_BYTES = 400 * 1024

export default function ProductFormDialog({ open, product, onClose }) {
  const toast = useToast()
  const isEdit = Boolean(product)

  const lookup = useLiveQuery(
    async () => ({ categories: await listCategories(), units: await listUnits() }),
    [],
  )

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (product) {
      setForm({
        name: product.name ?? '',
        sku: product.sku ?? '',
        type: product.type ?? 'barang',
        categoryId: product.categoryId ?? '',
        unitId: product.unitId ?? '',
        purchasePrice: product.purchasePrice ?? 0,
        sellingPrice: product.sellingPrice ?? 0,
        hpp: product.hpp ?? 0,
        stockQty: product.stockQty ?? 0,
        minStock: product.minStock ?? 0,
        trackStock: product.trackStock !== false,
        note: product.note ?? '',
        imageDataUrl: product.imageDataUrl ?? null,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
  }, [open, product])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const margin = useMemo(() => grossMargin(Number(form.sellingPrice || 0), Number(form.hpp || 0)), [form.sellingPrice, form.hpp])

  if (!open) return null

  const isBarang = form.type === 'barang'
  const showStockFields = isBarang && form.trackStock

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.push('Foto produk harus berupa gambar (JPG atau PNG).', { tone: 'error' })
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.push('Ukuran foto maksimal 400 KB. Perkecil gambar terlebih dahulu.', { tone: 'error' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => setField('imageDataUrl', String(reader.result))
    reader.onerror = () => toast.push('Foto tidak dapat dibaca. Coba berkas lain.', { tone: 'error' })
    reader.readAsDataURL(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      name: form.name,
      sku: form.sku,
      type: form.type,
      categoryId: form.categoryId,
      unitId: form.unitId,
      purchasePrice: Number(form.purchasePrice || 0),
      sellingPrice: Number(form.sellingPrice || 0),
      hpp: Number(form.hpp || 0),
      stockQty: Number(form.stockQty || 0),
      minStock: Number(form.minStock || 0),
      note: form.note,
    }

    const parsed = productSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push('Periksa kembali data produk yang ditandai merah.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      const data = { ...parsed.data, imageDataUrl: form.imageDataUrl, trackStock: form.trackStock }
      if (isEdit) {
        await updateProduct(product.id, data)
        toast.push('Produk berhasil diperbarui.')
      } else {
        await createProduct(data)
        toast.push('Produk berhasil ditambahkan.')
      }
      onClose()
    } catch (error) {
      toast.push(error?.message ?? 'Produk gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Ubah produk' : 'Tambah produk'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h3>{isEdit ? 'Ubah produk' : 'Tambah produk'}</h3>
            <p className="muted">
              {isEdit
                ? 'Perubahan harga otomatis tercatat pada riwayat harga dan HPP produk.'
                : 'Isi informasi produk. SKU boleh dikosongkan dan akan dibuat otomatis.'}
            </p>
          </div>
          <button type="button" className="icon-button icon-button--sm" onClick={onClose} aria-label="Tutup formulir">
            <X size={17} />
          </button>
        </div>

        <form className="modal__content" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <Field
              label="Nama produk"
              htmlFor="productName"
              required
              error={errors.name}
              className="form-grid__full"
            >
              <input
                id="productName"
                className={`input ${errors.name ? 'input--error' : ''}`.trim()}
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="Contoh: Nasi Ayam Geprek"
                maxLength={100}
              />
            </Field>

            <Field label="SKU / kode produk" htmlFor="productSku" error={errors.sku} hint="Opsional. Dibuat otomatis jika kosong.">
              <input
                id="productSku"
                className={`input ${errors.sku ? 'input--error' : ''}`.trim()}
                value={form.sku}
                onChange={(event) => setField('sku', event.target.value)}
                placeholder="PRD-0001"
                maxLength={40}
              />
            </Field>

            <Field label="Jenis produk" htmlFor="productType" required error={errors.type}>
              <select
                id="productType"
                className={`select ${errors.type ? 'select--error' : ''}`.trim()}
                value={form.type}
                onChange={(event) => setField('type', event.target.value)}
              >
                <option value="barang">Barang</option>
                <option value="jasa">Jasa</option>
              </select>
            </Field>

            <Field label="Kategori" htmlFor="productCategory" error={errors.categoryId}>
              <select
                id="productCategory"
                className="select"
                value={form.categoryId}
                onChange={(event) => setField('categoryId', event.target.value)}
              >
                <option value="">Tanpa kategori</option>
                {(lookup?.categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Satuan" htmlFor="productUnit" required error={errors.unitId}>
              <select
                id="productUnit"
                className={`select ${errors.unitId ? 'select--error' : ''}`.trim()}
                value={form.unitId}
                onChange={(event) => setField('unitId', event.target.value)}
              >
                <option value="">Pilih satuan</option>
                {(lookup?.units ?? []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={isBarang ? 'Harga beli per satuan' : 'Biaya dasar per unit'}
              htmlFor="productPurchase"
              error={errors.purchasePrice}
              hint="Dipakai sebagai dasar perhitungan HPP jenis perdagangan."
            >
              <input
                id="productPurchase"
                type="number"
                min="0"
                step="1"
                className={`input ${errors.purchasePrice ? 'input--error' : ''}`.trim()}
                value={form.purchasePrice}
                onChange={(event) => setField('purchasePrice', event.target.value)}
                placeholder="0"
              />
            </Field>

            <Field label="Harga jual" htmlFor="productSelling" error={errors.sellingPrice}>
              <input
                id="productSelling"
                type="number"
                min="0"
                step="1"
                className={`input ${errors.sellingPrice ? 'input--error' : ''}`.trim()}
                value={form.sellingPrice}
                onChange={(event) => setField('sellingPrice', event.target.value)}
                placeholder="0"
              />
            </Field>

            <Field
              label="HPP per unit"
              htmlFor="productHpp"
              error={errors.hpp}
              hint="Boleh dikosongkan. Kalkulator HPP (Tahap 3) akan mengisi angka ini."
            >
              <input
                id="productHpp"
                type="number"
                min="0"
                step="1"
                className={`input ${errors.hpp ? 'input--error' : ''}`.trim()}
                value={form.hpp}
                onChange={(event) => setField('hpp', event.target.value)}
                placeholder="0"
              />
            </Field>

            <div className="field form-grid__full">
              <span className="field__label">Margin saat ini</span>
              <div className="summary-pills">
                <span className="summary-pill">
                  Margin kotor
                  <strong>{formatPercent(margin)}</strong>
                </span>
                <span className="summary-pill">
                  Laba per unit
                  <strong>{formatRupiah(Number(form.sellingPrice || 0) - Number(form.hpp || 0))}</strong>
                </span>
              </div>
            </div>

            {isBarang ? (
              <div className="field form-grid__full">
                <span className="field__label">Persediaan</span>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={form.trackStock}
                    onChange={(event) => setField('trackStock', event.target.checked)}
                  />
                  <span>
                    Lacak stok produk ini
                    <small>Matikan untuk barang yang stoknya tidak perlu dipantau.</small>
                  </span>
                </label>
              </div>
            ) : null}

            {showStockFields ? (
              <>
                {isEdit ? (
                  <Field
                    label="Stok saat ini"
                    htmlFor="productStockReadonly"
                    hint="Stok tidak diubah dari formulir ini. Gunakan menu Persediaan agar tercatat di kartu stok."
                  >
                    <input
                      id="productStockReadonly"
                      className="input"
                      value={`${formatNumber(product.stockQty ?? 0)}`}
                      readOnly
                      disabled
                    />
                  </Field>
                ) : (
                  <Field label="Stok awal" htmlFor="productStock" error={errors.stockQty} hint="Boleh 0 jika stok belum dihitung.">
                    <input
                      id="productStock"
                      type="number"
                      min="0"
                      step="0.01"
                      className={`input ${errors.stockQty ? 'input--error' : ''}`.trim()}
                      value={form.stockQty}
                      onChange={(event) => setField('stockQty', event.target.value)}
                      placeholder="0"
                    />
                  </Field>
                )}

                <Field
                  label="Stok minimum"
                  htmlFor="productMinStock"
                  error={errors.minStock}
                  hint="Peringatan muncul saat stok mencapai angka ini."
                >
                  <input
                    id="productMinStock"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`input ${errors.minStock ? 'input--error' : ''}`.trim()}
                    value={form.minStock}
                    onChange={(event) => setField('minStock', event.target.value)}
                    placeholder="0"
                  />
                </Field>
              </>
            ) : null}

            <Field label="Catatan produk" htmlFor="productNote" error={errors.note} className="form-grid__full">
              <textarea
                id="productNote"
                className={`textarea ${errors.note ? 'textarea--error' : ''}`.trim()}
                value={form.note}
                onChange={(event) => setField('note', event.target.value)}
                placeholder="Contoh: porsi besar, tanpa sambal, atau bahan baku utama."
                maxLength={300}
                rows={2}
              />
            </Field>

            <Field label="Foto produk" htmlFor="productImage" className="form-grid__full" hint="Opsional, maksimal 400 KB.">
              <div className="logo-upload">
                <span className="logo-preview">
                  {form.imageDataUrl ? (
                    <img src={form.imageDataUrl} alt="Foto produk" />
                  ) : (
                    <ImagePlus size={22} aria-hidden="true" />
                  )}
                </span>
                <div className="row">
                  <input
                    id="productImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => document.getElementById('productImage')?.click()}
                  >
                    Pilih foto
                  </Button>
                  {form.imageDataUrl ? (
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setField('imageDataUrl', null)}>
                      Hapus foto
                    </Button>
                  ) : null}
                </div>
              </div>
            </Field>
          </div>

          <div className="form-actions">
            <Button type="submit" icon={Save} loading={saving}>
              {isEdit ? 'Simpan perubahan' : 'Simpan produk'}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <span className="form-note">
              {isEdit ? 'Stok hanya berubah lewat menu Persediaan.' : 'Stok awal akan tercatat di kartu stok.'}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
