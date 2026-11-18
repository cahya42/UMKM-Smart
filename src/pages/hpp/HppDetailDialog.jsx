import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { getProductCostDetail } from '../../database/repositories/hppRepo'
import { formatDateTime, formatLongDate } from '../../utils/dates'
import { formatNumber, formatPercent, formatRupiah } from '../../utils/money'
import { COST_TYPE_LABELS } from '../../utils/hpp'

export default function HppDetailDialog({ productCostId, onClose }) {
  const data = useLiveQuery(async () => {
    if (!productCostId) return null
    return getProductCostDetail(productCostId)
  }, [productCostId])

  useEffect(() => {
    if (!productCostId) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [productCostId, onClose])

  if (!productCostId) return null

  const isLoading = data === undefined
  const record = data?.record
  const difference = record ? record.unitCost - record.previousHpp : 0

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label={record ? `Detail HPP ${record.productName}` : 'Detail perhitungan HPP'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h3>{record?.productName ?? 'Memuat perhitungan...'}</h3>
            <p className="muted">
              {record ? `${record.businessType} - berlaku ${formatLongDate(record.effectiveDate)}` : ''}
            </p>
          </div>
          <button type="button" className="icon-button icon-button--sm" onClick={onClose} aria-label="Tutup detail">
            <X size={17} />
          </button>
        </div>

        <div className="modal__content">
          {isLoading ? (
            <p className="muted">Memuat detail perhitungan...</p>
          ) : !record ? (
            <p className="muted">Perhitungan tidak ditemukan atau sudah dihapus.</p>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 14 }}>
                <Badge tone={record.appliedToProduct ? 'green' : 'gray'}>
                  {record.appliedToProduct ? 'Diterapkan ke produk' : 'Tidak diterapkan'}
                </Badge>
                <Badge tone="blue">{data.components?.length ?? 0} komponen</Badge>
              </div>

              <p className="modal__section-title">Ringkasan</p>
              <dl className="info-list">
                <div>
                  <dt>Jumlah unit per batch</dt>
                  <dd>{formatNumber(record.batchQuantity)}</dd>
                </div>
                <div>
                  <dt>Total biaya batch</dt>
                  <dd>{formatRupiah(record.totalCost)}</dd>
                </div>
                <div>
                  <dt>HPP per unit</dt>
                  <dd>
                    <strong>{formatRupiah(record.unitCost)}</strong>
                  </dd>
                </div>
                <div>
                  <dt>HPP sebelumnya</dt>
                  <dd>{formatRupiah(record.previousHpp)}</dd>
                </div>
                <div>
                  <dt>Selisih HPP</dt>
                  <dd>
                    {difference === 0
                      ? 'Tidak berubah'
                      : `${difference > 0 ? 'Naik' : 'Turun'} ${formatRupiah(Math.abs(difference))}`}
                  </dd>
                </div>
                <div>
                  <dt>Harga jual simulasi</dt>
                  <dd>{record.sellingPrice > 0 ? formatRupiah(record.sellingPrice) : 'Belum diisi'}</dd>
                </div>
                <div>
                  <dt>Margin kotor</dt>
                  <dd>{record.sellingPrice > 0 ? formatPercent(record.marginPercent) : '-'}</dd>
                </div>
                <div>
                  <dt>Markup</dt>
                  <dd>{record.sellingPrice > 0 ? formatPercent(record.markupPercent) : '-'}</dd>
                </div>
                <div>
                  <dt>Dicatat</dt>
                  <dd>{formatDateTime(record.createdAt)}</dd>
                </div>
              </dl>

              <p className="modal__section-title" style={{ marginTop: 20 }}>
                Komponen biaya
              </p>
              <div className="table-wrap">
                <table className="table table--right">
                  <thead>
                    <tr>
                      <th>Jenis</th>
                      <th>Nama</th>
                      <th>Jumlah</th>
                      <th>Harga satuan</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.components ?? []).map((component) => (
                      <tr key={component.id}>
                        <td>{COST_TYPE_LABELS[component.costType] ?? component.costType}</td>
                        <td>
                          {component.name}
                          {component.unitLabel ? <span className="text-soft"> ({component.unitLabel})</span> : null}
                        </td>
                        <td className="num">{formatNumber(component.quantity)}</td>
                        <td className="table__amount">{formatRupiah(component.unitCost)}</td>
                        <td className="table__amount">{formatRupiah(component.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right' }}>
                        Total
                      </td>
                      <td className="table__amount">
                        <strong>{formatRupiah(record.totalCost)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {record.note ? (
                <>
                  <p className="modal__section-title" style={{ marginTop: 20 }}>
                    Catatan
                  </p>
                  <p className="muted">{record.note}</p>
                </>
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
