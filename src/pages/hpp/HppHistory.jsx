import { Calculator, Eye, History, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import { Card, CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { db } from '../../database/db'
import { listProductCosts } from '../../database/repositories/hppRepo'
import { formatLongDate } from '../../utils/dates'
import { formatNumber, formatPercent, formatRupiah } from '../../utils/money'
import HppDetailDialog from './HppDetailDialog'

export default function HppHistory() {
  const [productId, setProductId] = useState('')
  const [detailId, setDetailId] = useState(null)

  const data = useLiveQuery(async () => {
    const [costs, products] = await Promise.all([listProductCosts(), db.products.toArray()])
    return {
      costs,
      products: products.sort((a, b) => a.name.localeCompare(b.name, 'id')),
    }
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    return productId ? data.costs.filter((cost) => cost.productId === productId) : data.costs
  }, [data, productId])

  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="muted">Memuat riwayat HPP...</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardBody>
          <div className="toolbar toolbar--plain">
            <div className="toolbar__filters" style={{ flex: 1 }}>
              <select
                className="select"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                aria-label="Filter produk"
              >
                <option value="">Semua produk</option>
                {data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="muted">
              {rows.length} perhitungan{productId ? ' untuk produk ini' : ''}
            </span>
          </div>

          {data.costs.length === 0 ? (
            <EmptyState
              icon={Calculator}
              title="Belum ada perhitungan HPP"
              description="Hasil kalkulator HPP akan tersimpan di sini beserta komponen biayanya, sehingga Anda dapat menelusuri perubahan HPP dari waktu ke waktu."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Belum ada perhitungan untuk produk ini"
              description="Pilih produk lain atau hitung HPP baru pada tab Kalkulator HPP."
            />
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table table--right">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Produk</th>
                    <th>Jenis usaha</th>
                    <th>Unit</th>
                    <th>Total biaya</th>
                    <th>HPP/unit</th>
                    <th>Harga jual</th>
                    <th>Margin</th>
                    <th>Diterapkan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((cost) => (
                    <tr key={cost.id}>
                      <td>{formatLongDate(cost.effectiveDate)}</td>
                      <td>{cost.productName}</td>
                      <td className="muted">{cost.businessType}</td>
                      <td className="num">{formatNumber(cost.batchQuantity)}</td>
                      <td className="table__amount">{formatRupiah(cost.totalCost)}</td>
                      <td className="table__amount">{formatRupiah(cost.unitCost)}</td>
                      <td className="table__amount">
                        {cost.sellingPrice > 0 ? formatRupiah(cost.sellingPrice) : <span className="text-soft">-</span>}
                      </td>
                      <td>{cost.sellingPrice > 0 ? formatPercent(cost.marginPercent) : <span className="text-soft">-</span>}</td>
                      <td>
                        <Badge tone={cost.appliedToProduct ? 'green' : 'gray'}>
                          {cost.appliedToProduct ? 'Ya' : 'Tidak'}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-button icon-button--sm"
                            title="Lihat detail"
                            aria-label={`Lihat detail HPP ${cost.productName}`}
                            onClick={() => setDetailId(cost.id)}
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="form-note" style={{ marginTop: 12 }}>
            <History size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true" />
            Riwayat HPP tidak dapat diubah atau dihapus. Koreksi dilakukan dengan perhitungan baru.
          </p>
        </CardBody>
      </Card>

      <HppDetailDialog productCostId={detailId} onClose={() => setDetailId(null)} />
    </>
  )
}
