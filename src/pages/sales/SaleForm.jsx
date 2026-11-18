import { Plus, Save, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import ContactFormDialog from '../contacts/ContactFormDialog'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import { createSale } from '../../database/repositories/saleRepo'
import { computeCashBalances } from '../../utils/finance'
import { toDateKey } from '../../utils/dates'
import { formatNumber, formatPercent, formatRupiah, toQuantity } from '../../utils/money'
import { PAYMENT_METHODS, buildSaleTotals, lineSubtotal } from '../../utils/sales'
import { isStockProduct } from '../../utils/inventory'
import { saleSchema, toFieldErrors } from '../../utils/validation'

function createRow() {
  return { key: crypto.randomUUID(), productId: '', qty: '1', price: '', discount: '' }
}

export default function SaleForm() {
  const toast = useToast()
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const [products, accounts, cashTransactions, customers] = await Promise.all([
      db.products.toArray(),
      db.cash_accounts.toArray(),
      db.cash_transactions.toArray(),
      db.customers.toArray(),
    ])

    return {
      products: products
        .filter((product) => product.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
      customers: customers
        .filter((customer) => customer.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
      accounts: accounts.filter((account) => account.isActive !== false),
      cash: computeCashBalances(accounts, cashTransactions),
    }
  }, [])

  const [date, setDate] = useState(toDateKey())
  const [customerId, setCustomerId] = useState('')
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('tunai')
  const [cashAccountId, setCashAccountId] = useState('')
  const [discount, setDiscount] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState(() => [createRow()])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data) return
    if (!cashAccountId && data.accounts.length > 0) setCashAccountId(data.accounts[0].id)
  }, [data, cashAccountId])

  const rows = useMemo(
    () =>
      items.map((row) => {
        const product = (data?.products ?? []).find((item) => item.id === row.productId) ?? null
        const qty = Number(row.qty || 0)

        return {
          ...row,
          product,
          qty,
          price: Number(row.price || 0),
          discount: Number(row.discount || 0),
          costPrice: Number(product?.hpp || 0),
          subtotal: lineSubtotal(qty, row.price, row.discount),
        }
      }),
    [items, data],
  )

  const totals = useMemo(() => buildSaleTotals(rows, Number(discount || 0)), [rows, discount])
  const account = data?.cash.accounts.find((item) => item.id === cashAccountId) ?? null

  const stockWarnings = rows.filter(
    (row) => row.product && isStockProduct(row.product) && row.qty > toQuantity(row.product.stockQty),
  )

  function setField(name, value, setter) {
    setter(value)
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function updateRow(key, field, value) {
    setItems((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
    setErrors((current) => {
      if (!current.items) return current
      const next = { ...current }
      delete next.items
      return next
    })
  }

  function setRowProduct(key, productId) {
    const product = (data?.products ?? []).find((item) => item.id === productId)
    setItems((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              productId,
              price: product ? String(product.sellingPrice ?? 0) : '',
              discount: '',
              qty: row.qty || '1',
            }
          : row,
      ),
    )
    setErrors((current) => {
      if (!current.items) return current
      const next = { ...current }
      delete next.items
      return next
    })
  }

  function addRow() {
    setItems((current) => [...current, createRow()])
  }

  function removeRow(key) {
    setItems((current) => current.filter((row) => row.key !== key))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      date,
      customerId,
      paymentMethod,
      cashAccountId,
      discount: Number(discount || 0),
      note,
      items: items
        .filter((row) => row.productId)
        .map((row) => ({
          productId: row.productId,
          qty: Number(row.qty || 0),
          price: Number(row.price || 0),
          discount: Number(row.discount || 0),
        })),
    }

    const parsed = saleSchema.safeParse(payload)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push('Periksa kembali data penjualan yang ditandai merah.', { tone: 'error' })
      return
    }

    if (parsed.data.discount > totals.subtotal) {
      setErrors({ discount: 'Diskon penjualan melebihi subtotal.' })
      toast.push('Diskon penjualan melebihi subtotal.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      const sale = await createSale(parsed.data)
      toast.push(
        `Penjualan ${sale.invoiceNumber} sebesar ${formatRupiah(sale.total)} tersimpan. Stok dan kas sudah diperbarui.`,
      )
      navigate('/penjualan')
    } catch (error) {
      toast.push(error?.message ?? 'Penjualan gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="muted">Memuat data produk dan akun kas...</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid--sidebar">
        <div className="stack">
          <Card>
            <CardHeader
              title="Item penjualan"
              subtitle="Harga jual dapat diubah per transaksi; HPP diambil dari data produk saat ini."
              icon={ShoppingCart}
              action={
                <Button variant="secondary" size="sm" icon={Plus} onClick={addRow}>
                  Tambah baris
                </Button>
              }
            />
            <CardBody>
              {data.products.length === 0 ? (
                <p className="muted">
                  Belum ada produk aktif. Tambahkan produk terlebih dahulu di menu Produk.
                </p>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table table--right line-table">
                      <thead>
                        <tr>
                          <th>Produk</th>
                          <th>Jumlah</th>
                          <th>Harga jual</th>
                          <th>Diskon</th>
                          <th>Subtotal</th>
                          <th aria-label="Aksi" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.key}>
                            <td className="line-table__product">
                              <select
                                className="select"
                                value={row.productId}
                                aria-label="Produk"
                                onChange={(event) => setRowProduct(row.key, event.target.value)}
                              >
                                <option value="">Pilih produk</option>
                                {data.products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                    {isStockProduct(product)
                                      ? ` (stok ${formatNumber(product.stockQty)})`
                                      : ' (jasa)'}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={row.qty}
                                aria-label="Jumlah"
                                onChange={(event) => updateRow(row.key, 'qty', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="1"
                                value={row.price}
                                aria-label="Harga jual"
                                onChange={(event) => updateRow(row.key, 'price', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="1"
                                value={row.discount}
                                aria-label="Diskon baris"
                                onChange={(event) => updateRow(row.key, 'discount', event.target.value)}
                              />
                            </td>
                            <td className="table__amount">{formatRupiah(row.subtotal)}</td>
                            <td>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Hapus baris"
                                aria-label="Hapus baris"
                                onClick={() => removeRow(row.key)}
                                disabled={items.length === 1}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {errors.items ? (
                    <p className="field__error" role="alert" style={{ marginTop: 8 }}>
                      {errors.items}
                    </p>
                  ) : null}

                  {stockWarnings.length > 0 ? (
                    <div className="alert alert--warning" style={{ marginTop: 12 }}>
                      <span>
                        Stok tidak cukup untuk:{' '}
                        {stockWarnings
                          .map(
                            (row) =>
                              `${row.product.name} (tersedia ${formatNumber(row.product.stockQty)}, diminta ${formatNumber(row.qty)})`,
                          )
                          .join('; ')}
                        . Kurangi jumlah atau tambah stok lewat menu Persediaan.
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pembayaran" subtitle="Uang masuk dicatat ke akun kas yang dipilih." />
            <CardBody>
              <div className="form-grid">
                <Field label="Tanggal" htmlFor="saleDate" required error={errors.date}>
                  <input
                    id="saleDate"
                    type="date"
                    className={`input ${errors.date ? 'input--error' : ''}`.trim()}
                    value={date}
                    onChange={(event) => setField('date', event.target.value, setDate)}
                    max={toDateKey()}
                  />
                </Field>

                <Field label="Metode pembayaran" htmlFor="salePayment" required error={errors.paymentMethod}>
                  <select
                    id="salePayment"
                    className={`select ${errors.paymentMethod ? 'select--error' : ''}`.trim()}
                    value={paymentMethod}
                    onChange={(event) => setField('paymentMethod', event.target.value, setPaymentMethod)}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Pelanggan"
                  htmlFor="saleCustomer"
                  error={errors.customerId}
                  hint="Opsional. Pilih pelanggan terdaftar agar riwayat pembeliannya tercatat."
                >
                  <div className="row" style={{ gap: 8 }}>
                    <select
                      id="saleCustomer"
                      className={`select ${errors.customerId ? 'select--error' : ''}`.trim()}
                      value={customerId}
                      onChange={(event) => setField('customerId', event.target.value, setCustomerId)}
                    >
                      <option value="">Pelanggan umum</option>
                      {data.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Plus}
                      onClick={() => setCustomerDialogOpen(true)}
                    >
                      Baru
                    </Button>
                  </div>
                </Field>

                <Field label="Akun kas penerima" htmlFor="saleAccount" required error={errors.cashAccountId}>
                  <select
                    id="saleAccount"
                    className={`select ${errors.cashAccountId ? 'select--error' : ''}`.trim()}
                    value={cashAccountId}
                    onChange={(event) => setField('cashAccountId', event.target.value, setCashAccountId)}
                  >
                    <option value="">Pilih akun kas</option>
                    {data.accounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Diskon penjualan"
                  htmlFor="saleDiscount"
                  error={errors.discount}
                  hint="Potongan total nota, bukan per baris."
                >
                  <input
                    id="saleDiscount"
                    type="number"
                    min="0"
                    step="1"
                    className={`input ${errors.discount ? 'input--error' : ''}`.trim()}
                    value={discount}
                    onChange={(event) => setField('discount', event.target.value, setDiscount)}
                    placeholder="0"
                  />
                </Field>

                <Field label="Catatan" htmlFor="saleNote" error={errors.note} className="form-grid__full">
                  <textarea
                    id="saleNote"
                    className={`textarea ${errors.note ? 'textarea--error' : ''}`.trim()}
                    value={note}
                    onChange={(event) => setField('note', event.target.value, setNote)}
                    placeholder="Contoh: pesanan meja 3, tanpa sambal."
                    maxLength={200}
                    rows={2}
                  />
                </Field>
              </div>

              {data.accounts.length === 0 ? (
                <div className="alert alert--danger" style={{ marginTop: 12 }}>
                  <span>Belum ada akun kas aktif. Penjualan membutuhkan akun kas untuk mencatat uang masuk.</span>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader title="Ringkasan" subtitle="Belum tersimpan" />
            <CardBody>
              <dl className="info-list">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatRupiah(totals.subtotal)}</dd>
                </div>
                <div>
                  <dt>Diskon</dt>
                  <dd>{formatRupiah(totals.discount)}</dd>
                </div>
                <div>
                  <dt>Total dibayar</dt>
                  <dd>
                    <strong>{formatRupiah(totals.total)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>HPP terjual</dt>
                  <dd>{formatRupiah(totals.totalCost)}</dd>
                </div>
                <div>
                  <dt>Laba kotor</dt>
                  <dd>{formatRupiah(totals.profit)}</dd>
                </div>
                <div>
                  <dt>Margin kotor</dt>
                  <dd>{formatPercent(totals.margin)}</dd>
                </div>
              </dl>

              {account ? (
                <p className="form-note" style={{ marginTop: 10 }}>
                  Saldo {account.name} saat ini {formatRupiah(account.balance)}. Setelah transaksi menjadi{' '}
                  {formatRupiah(account.balance + totals.total)}.
                </p>
              ) : null}

              <div className="form-actions" style={{ marginTop: 16 }}>
                <Button type="submit" icon={Save} loading={saving} disabled={data.accounts.length === 0}>
                  Simpan penjualan
                </Button>
                <Link to="/penjualan" className="btn btn--secondary">
                  Batal
                </Link>
              </div>

              <p className="form-note" style={{ marginTop: 8 }}>
                Stok berkurang dan kas bertambah dalam satu transaksi. Pembatalan dilakukan dari daftar penjualan.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
      </form>

      <ContactFormDialog
        kind="pelanggan"
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        onSaved={(customer) => setCustomerId(customer.id)}
      />
    </>
  )
}
