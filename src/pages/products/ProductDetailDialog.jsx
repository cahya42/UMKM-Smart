import { ArrowRight, Package, Pencil, X } from 'lucide-react'
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { listCategories, listUnits } from '../../database/repositories/catalogRepo'
import { getProduct, getProductPriceHistory } from '../../database/repositories/productRepo'
import { listMovementsForProduct } from '../../database/repositories/stockRepo'
import { formatLongDate, formatDateTime } from '../../utils/dates'
import { formatNumber, formatPercent, formatRupiah, grossMargin, toQuantity } from '../../utils/money'
import { MOVEMENT_LABELS, MOVEMENT_TONES, isStockProduct, stockUnitValue } from '../../utils/inventory'

export default function ProductDetailDialog({ productId, onClose, onEdit }) {
  const data = useLiveQuery(async () => {
    if (!productId) return null
    const product = await getProduct(productId)
    if (!product) return null

    const [categories, units, history, movements] = await Promise.all([
      listCategories(),
      listUnits(),
      getProductPriceHistory(productId, 8),
      listMovementsForProduct(productId),
    ])

    const recentMovements = movements
      .sort((a, b) => `${b.date} ${b.createdAt ?? ''}`.localeCompare(`${a.date} ${a.createdAt ?? ''}`))
      .slice(0, 5)

    return {
      product,
      history,
      recentMovements,
      categoryName: categories.find((category) => category.id === product.categoryId)?.name ?? 'Tanpa kategori',
      unitName: units.find((unit) => unit.id === product.unitId)?.name ?? '-',
    }
  }, [productId])

  useEffect(() => {
    if (!productId) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [productId, onClose])

  if (!productId) return null

  const isLoading = data === undefined
  const product = data?.product
  const margin = product ? grossMargin(product.sellingPrice, product.hpp) : 0

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={product ? `Detail ${product.name}` : 'Detail produk'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h3>{product?.name ?? 'Memuat produk...'}</h3>
            {product ? (
              <p className="muted">
                {product.sku} - {data.categoryName}
              </p>
            ) : null}
          </div>
          <button type="button" className="icon-button icon-button--sm" onClick={onClose} aria-label="Tutup detail">
            <X size={17} />
          </button>
        </div>

        <div className="modal__content">
          {isLoading ? (
            <p className="muted">Memuat detail produk...</p>
          ) : !product ? (
            <p className="muted">Produk tidak ditemukan atau sudah dihapus.</p>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 16 }}>
                <Badge tone={product.isActive === false ? 'gray' : 'green'}>
                  {product.isActive === false ? 'Nonaktif' : 'Aktif'}
                </Badge>
                <Badge tone="blue">{product.type === 'barang' ? 'Barang' : 'Jasa'}</Badge>
                <Badge tone="gray">Satuan: {data.unitName}</Badge>
              </div>

              <p className="modal__section-title">Harga & margin</p>
              <dl className="info-list">
                <div>
                  <dt>Harga beli / biaya dasar</dt>
                  <dd>{formatRupiah(product.purchasePrice)}</dd>
                </div>
                <div>
                  <dt>Harga jual</dt>
                  <dd>{formatRupiah(product.sellingPrice)}</dd>
                </div>
                <div>
                  <dt>HPP per unit</dt>
                  <dd>{product.hpp > 0 ? formatRupiah(product.hpp) : 'Belum diisi'}</dd>
                </div>
                <div>
                  <dt>Margin kotor</dt>
                  <dd>{product.hpp > 0 ? formatPercent(margin) : '-'}</dd>
                </div>
                <div>
                  <dt>Laba per unit</dt>
                  <dd>{product.hpp > 0 ? formatRupiah(product.sellingPrice - product.hpp) : '-'}</dd>
                </div>
                <div>
                  <dt>Terakhir diubah</dt>
                  <dd>{formatDateTime(product.updatedAt)}</dd>
                </div>
              </dl>

              {isStockProduct(product) ? (
                <>
                  <p className="modal__section-title" style={{ marginTop: 20 }}>
                    Persediaan
                  </p>
                  <dl className="info-list">
                    <div>
                      <dt>Stok tersedia</dt>
                      <dd>
                        {formatNumber(toQuantity(product.stockQty))} {data.unitName}
                      </dd>
                    </div>
                    <div>
                      <dt>Stok minimum</dt>
                      <dd>
                        {formatNumber(toQuantity(product.minStock))} {data.unitName}
                      </dd>
                    </div>
                    <div>
                      <dt>Status stok</dt>
                      <dd>
                        {toQuantity(product.stockQty) <= 0 ? (
                          <Badge tone="red">Habis</Badge>
                        ) : toQuantity(product.stockQty) <= toQuantity(product.minStock) ? (
                          <Badge tone="amber">Menipis</Badge>
                        ) : (
                          <Badge tone="green">Aman</Badge>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Nilai persediaan</dt>
                      <dd>{formatRupiah(Math.round(toQuantity(product.stockQty) * stockUnitValue(product)))}</dd>
                    </div>
                  </dl>
                </>
              ) : null}

              <p className="modal__section-title" style={{ marginTop: 20 }}>
                Riwayat harga & HPP
              </p>
              {data.history.length === 0 ? (
                <p className="muted">Belum ada riwayat perubahan harga.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table table--right">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Harga beli</th>
                        <th>Harga jual</th>
                        <th>HPP</th>
                        <th>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((entry) => (
                        <tr key={entry.id}>
                          <td>{formatLongDate(entry.changedAt.slice(0, 10))}</td>
                          <td className="table__amount">{formatRupiah(entry.purchasePrice)}</td>
                          <td className="table__amount">{formatRupiah(entry.sellingPrice)}</td>
                          <td className="table__amount">{formatRupiah(entry.hpp)}</td>
                          <td className="muted">{entry.note || (entry.source === 'create' ? 'Harga awal' : '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isStockProduct(product) ? (
                <>
                  <p className="modal__section-title" style={{ marginTop: 20 }}>
                    Pergerakan stok terakhir
                  </p>
                  {data.recentMovements.length === 0 ? (
                    <p className="muted">Belum ada pergerakan stok.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="table table--right">
                        <thead>
                          <tr>
                            <th>Tanggal</th>
                            <th>Jenis</th>
                            <th>Keterangan</th>
                            <th>Perubahan</th>
                            <th>Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recentMovements.map((movement) => (
                            <tr key={movement.id}>
                              <td>{formatLongDate(movement.date)}</td>
                              <td>
                                <Badge tone={MOVEMENT_TONES[movement.type] ?? 'gray'}>
                                  {MOVEMENT_LABELS[movement.type] ?? movement.type}
                                </Badge>
                              </td>
                              <td className="muted">{movement.note || movement.reason || '-'}</td>
                              <td className="num">
                                {movement.change > 0 ? '+' : ''}
                                {formatNumber(movement.change)}
                              </td>
                              <td className="num">{formatNumber(movement.balanceAfter)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}

              <div className="form-actions">
                <Button icon={Pencil} onClick={() => onEdit(product)}>
                  Ubah produk
                </Button>
                {isStockProduct(product) ? (
                  <Link
                    to={`/persediaan?tab=kartu&produk=${product.id}`}
                    className="btn btn--secondary"
                    onClick={onClose}
                  >
                    Buka kartu stok
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : null}
                <Button variant="ghost" onClick={onClose}>
                  Tutup
                </Button>
              </div>

              <p className="form-note" style={{ marginTop: 10 }}>
                <Package size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                Produk ini {product.type === 'barang' ? 'menyimpan stok' : 'tidak menyimpan stok'} karena berjenis{' '}
                {product.type}.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
