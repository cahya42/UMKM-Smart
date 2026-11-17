import { Search, Boxes, ClipboardList } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../../components/ui/Badge'
import { Card, CardBody } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import { formatNumber, formatRupiah, toQuantity } from '../../utils/money'
import { stockUnitValue } from '../../utils/inventory'

export default function StockSummary({ products, units, onOpenCard, loading }) {
  const [search, setSearch] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)

  const unitMap = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units])
  const stockProducts = useMemo(() => products.filter((product) => product.type === 'barang' && product.trackStock !== false), [products])

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return stockProducts.filter((product) => {
      if (keyword && !`${product.name} ${product.sku ?? ''}`.toLowerCase().includes(keyword)) return false
      if (onlyLow) {
        const stock = toQuantity(product.stockQty)
        if (stock > toQuantity(product.minStock)) return false
      }
      return true
    })
  }, [stockProducts, search, onlyLow])

  return (
    <Card>
      <CardBody>
        <div className="toolbar toolbar--plain">
          <div className="toolbar__filters" style={{ flex: 1 }}>
            <div className="toolbar__search">
              <Search size={16} aria-hidden="true" />
              <input
                className="input"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari produk"
                aria-label="Cari produk pada persediaan"
              />
            </div>
            <label className="check-row check-row--inline">
              <input type="checkbox" checked={onlyLow} onChange={(event) => setOnlyLow(event.target.checked)} />
              <span>Hanya stok menipis atau habis</span>
            </label>
          </div>
          <span className="muted">{visible.length} produk</span>
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p className="muted">Memuat persediaan...</p>
          ) : stockProducts.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Belum ada produk berstok"
              description="Tambahkan produk berjenis barang dengan opsi lacak stok aktif pada menu Produk."
            />
          ) : visible.length === 0 ? (
            <EmptyState icon={Search} title="Tidak ada produk yang cocok" description="Ubah kata kunci atau matikan filter stok menipis." />
          ) : (
            <div className="table-wrap">
              <table className="table table--right">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Stok</th>
                    <th>Minimum</th>
                    <th>Nilai stok</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((product) => {
                    const stock = toQuantity(product.stockQty)
                    const minimum = toQuantity(product.minStock)
                    const unitName = unitMap.get(product.unitId) ?? ''
                    const status = stock <= 0 ? 'Habis' : stock <= minimum ? 'Menipis' : 'Aman'
                    const tone = status === 'Habis' ? 'red' : status === 'Menipis' ? 'amber' : 'green'

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="product-cell">
                            <div>
                              <p className="product-cell__name">{product.name}</p>
                              <p className="product-cell__meta">{product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="num">
                          {formatNumber(stock)} {unitName}
                        </td>
                        <td className="num">
                          {formatNumber(minimum)} {unitName}
                        </td>
                        <td className="table__amount">{formatRupiah(Math.round(stock * stockUnitValue(product)))}</td>
                        <td>
                          <Badge tone={tone}>{status}</Badge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => onOpenCard(product.id)}
                          >
                            <ClipboardList size={14} aria-hidden="true" />
                            Kartu stok
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
