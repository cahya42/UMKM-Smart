import { ClipboardList } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import { listMovementsForProduct } from '../../database/repositories/stockRepo'
import { buildStockCard, MOVEMENT_LABELS, MOVEMENT_TONES } from '../../utils/inventory'
import { formatLongDate, getPeriodRange, toDateKey } from '../../utils/dates'
import { formatNumber } from '../../utils/money'

export default function StockCard({ products, units, initialProductId, loading }) {
  const today = toDateKey()
  const [productId, setProductId] = useState(
    initialProductId || products[0]?.id || '',
  )
  const [range, setRange] = useState({ start: getPeriodRange('month').startDate, end: today })

  const unitMap = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units])

  // Produk baru tersedia setelah live query selesai, dan tautan dari detail
  // produk dapat mengganti produk yang sedang dilihat.
  useEffect(() => {
    if (initialProductId) setProductId(initialProductId)
  }, [initialProductId])

  useEffect(() => {
    if (!productId && products.length > 0) setProductId(products[0].id)
  }, [productId, products])

  const movements = useLiveQuery(
    async () => (productId ? listMovementsForProduct(productId) : []),
    [productId],
    null,
  )

  const card = useMemo(
    () => buildStockCard(movements ?? [], range.start, range.end),
    [movements, range],
  )

  const product = products.find((item) => item.id === productId)
  const unitName = product ? unitMap.get(product.unitId) ?? '' : ''
  const rangeInvalid = range.start > range.end

  return (
    <Card>
      <CardHeader
        title="Kartu stok"
        subtitle="Riwayat masuk, keluar, dan saldo stok per produk"
        icon={ClipboardList}
      />
      <CardBody>
        {loading ? (
          <p className="muted">Memuat produk...</p>
        ) : products.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Belum ada produk berstok"
            description="Tambahkan produk barang dengan lacak stok aktif pada menu Produk."
          />
        ) : (
          <>
            <div className="toolbar toolbar--plain">
              <div className="toolbar__filters" style={{ flex: 1 }}>
                <select
                  className="select"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  aria-label="Pilih produk untuk kartu stok"
                  style={{ minWidth: 240 }}
                >
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <label className="row" style={{ gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  Dari
                  <input
                    type="date"
                    className="input input--sm"
                    value={range.start}
                    max={range.end || undefined}
                    onChange={(event) => setRange({ ...range, start: event.target.value })}
                  />
                </label>
                <label className="row" style={{ gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                  Sampai
                  <input
                    type="date"
                    className="input input--sm"
                    value={range.end}
                    min={range.start || undefined}
                    onChange={(event) => setRange({ ...range, end: event.target.value })}
                  />
                </label>
              </div>
            </div>

            {rangeInvalid ? (
              <div className="alert alert--warning" style={{ marginTop: 14 }}>
                <ClipboardList size={17} />
                <div>Tanggal awal melewati tanggal akhir. Perbaiki rentang tanggal untuk melihat kartu stok.</div>
              </div>
            ) : null}

            <div className="summary-pills" style={{ marginTop: 16 }}>
              <span className="summary-pill">
                Saldo awal periode
                <strong>
                  {formatNumber(card.openingBalance)} {unitName}
                </strong>
              </span>
              <span className="summary-pill">
                Total masuk
                <strong>{formatNumber(card.totalIn)}</strong>
              </span>
              <span className="summary-pill">
                Total keluar
                <strong>{formatNumber(card.totalOut)}</strong>
              </span>
              <span className="summary-pill">
                Saldo akhir periode
                <strong>
                  {formatNumber(card.closingBalance)} {unitName}
                </strong>
              </span>
            </div>

            <div style={{ marginTop: 16 }}>
              {movements === null ? (
                <p className="muted">Memuat kartu stok...</p>
              ) : card.rows.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Belum ada pergerakan pada periode ini"
                  description="Ubah rentang tanggal atau catat barang masuk untuk mulai mengisi kartu stok."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table table--right">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Jenis</th>
                        <th>Keterangan</th>
                        <th>Masuk</th>
                        <th>Keluar</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.rows.map((movement) => {
                        const delta = Number(movement.change ?? 0)
                        return (
                          <tr key={movement.id}>
                            <td>{formatLongDate(movement.date)}</td>
                            <td>
                              <Badge tone={MOVEMENT_TONES[movement.type] ?? 'gray'}>
                                {MOVEMENT_LABELS[movement.type] ?? movement.type}
                              </Badge>
                            </td>
                            <td className="muted">
                              {movement.note || movement.reason || movement.supplierName || '-'}
                            </td>
                            <td className="num">{delta > 0 ? formatNumber(delta) : '-'}</td>
                            <td className="num">{delta < 0 ? formatNumber(Math.abs(delta)) : '-'}</td>
                            <td className="num">{formatNumber(movement.balanceAfter)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}
