import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { getSaleDetail } from '../../database/repositories/saleRepo'
import { formatDateTime, formatLongDate } from '../../utils/dates'
import { formatNumber, formatPercent, formatRupiah } from '../../utils/money'
import { PAYMENT_LABELS, SALE_STATUS_LABELS } from '../../utils/sales'

export default function SaleDetailDialog({ saleId, onClose }) {
  const data = useLiveQuery(async () => {
    if (!saleId) return null
    return getSaleDetail(saleId)
  }, [saleId])

  useEffect(() => {
    if (!saleId) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saleId, onClose])

  if (!saleId) return null

  const isLoading = data === undefined
  const sale = data?.sale
  const margin = sale
    ? sale.total > 0
      ? ((sale.total - sale.totalCost) / sale.total) * 100
      : 0
    : 0

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={sale ? `Detail penjualan ${sale.invoiceNumber}` : 'Detail penjualan'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h3>{sale?.invoiceNumber ?? 'Memuat nota...'}</h3>
            {sale ? <p className="muted">{formatLongDate(sale.date)}</p> : null}
          </div>
          <button type="button" className="icon-button icon-button--sm" onClick={onClose} aria-label="Tutup detail">
            <X size={17} />
          </button>
        </div>

        <div className="modal__content">
          {isLoading ? (
            <p className="muted">Memuat detail penjualan...</p>
          ) : !sale ? (
            <p className="muted">Penjualan tidak ditemukan.</p>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 14 }}>
                <Badge tone={sale.status === 'dibatalkan' ? 'gray' : 'green'}>
                  {SALE_STATUS_LABELS[sale.status] ?? sale.status}
                </Badge>
                <Badge tone="blue">{PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}</Badge>
                <Badge tone="gray">{data.accountName}</Badge>
              </div>

              <dl className="info-list">
                <div>
                  <dt>Pelanggan</dt>
                  <dd>{sale.customerName || 'Pelanggan umum'}</dd>
                </div>
                <div>
                  <dt>Jumlah item</dt>
                  <dd>{formatNumber(sale.itemCount ?? data.items.length)}</dd>
                </div>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatRupiah(sale.subtotal)}</dd>
                </div>
                <div>
                  <dt>Diskon</dt>
                  <dd>{formatRupiah(sale.discount)}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>
                    <strong>{formatRupiah(sale.total)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>HPP terjual</dt>
                  <dd>{formatRupiah(sale.totalCost)}</dd>
                </div>
                <div>
                  <dt>Laba kotor</dt>
                  <dd>{formatRupiah(sale.total - sale.totalCost)}</dd>
                </div>
                <div>
                  <dt>Margin kotor</dt>
                  <dd>{formatPercent(margin)}</dd>
                </div>
                <div>
                  <dt>Dicatat</dt>
                  <dd>{formatDateTime(sale.createdAt)}</dd>
                </div>
              </dl>

              <p className="modal__section-title" style={{ marginTop: 20 }}>
                Item
              </p>
              <div className="table-wrap">
                <table className="table table--right">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Jumlah</th>
                      <th>Harga</th>
                      <th>Diskon</th>
                      <th>Subtotal</th>
                      <th>HPP/unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td className="num">{formatNumber(item.qty)}</td>
                        <td className="table__amount">{formatRupiah(item.price)}</td>
                        <td className="table__amount">{formatRupiah(item.discount)}</td>
                        <td className="table__amount">{formatRupiah(item.subtotal)}</td>
                        <td className="table__amount">{formatRupiah(item.costPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sale.note ? (
                <>
                  <p className="modal__section-title" style={{ marginTop: 20 }}>
                    Catatan
                  </p>
                  <p className="muted">{sale.note}</p>
                </>
              ) : null}

              {sale.status === 'dibatalkan' ? (
                <div className="alert alert--warning" style={{ marginTop: 20 }}>
                  <span>
                    Dibatalkan {formatDateTime(sale.canceledAt)}. Alasan: {sale.cancelReason || '-'}. Stok dan kas sudah
                    dikembalikan melalui transaksi pembalik.
                  </span>
                </div>
              ) : null}

              <div className="form-actions">
                <Button variant="secondary" onClick={onClose}>
                  Tutup
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
