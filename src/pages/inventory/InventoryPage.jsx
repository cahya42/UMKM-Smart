import { AlertTriangle, ArrowLeftRight, Boxes, PackageCheck, Wallet } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import StockSummary from './StockSummary'
import StockMovementForm from './StockMovementForm'
import StockCard from './StockCard'
import { db } from '../../database/db'
import { listRecentMovements } from '../../database/repositories/stockRepo'
import { summarizeInventory, isStockProduct, MOVEMENT_LABELS, MOVEMENT_TONES } from '../../utils/inventory'
import { formatNumber, formatRupiah } from '../../utils/money'
import { formatLongDate } from '../../utils/dates'

const TABS = [
  { value: 'ringkasan', label: 'Ringkasan stok' },
  { value: 'masuk', label: 'Barang masuk' },
  { value: 'keluar', label: 'Barang keluar' },
  { value: 'penyesuaian', label: 'Penyesuaian' },
  { value: 'kartu', label: 'Kartu stok' },
]

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((item) => item.value === searchParams.get('tab')) ? searchParams.get('tab') : 'ringkasan'
  const selectedProductId = searchParams.get('produk') ?? ''

  const data = useLiveQuery(async () => {
    const [products, units, recentMovements] = await Promise.all([
      db.products.toArray(),
      db.units.toArray(),
      listRecentMovements(8),
    ])
    const productMap = new Map(products.map((product) => [product.id, product]))
    return {
      products: products.sort((a, b) => a.name.localeCompare(b.name, 'id')),
      units,
      productMap,
      recentMovements,
    }
  }, [])

  function changeTab(next) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    if (next !== 'kartu') params.delete('produk')
    setSearchParams(params)
  }

  function openStockCard(productId) {
    const params = new URLSearchParams()
    params.set('tab', 'kartu')
    params.set('produk', productId)
    setSearchParams(params)
  }

  const summary = summarizeInventory(data?.products ?? [])
  const stockProducts = (data?.products ?? []).filter(isStockProduct)
  const movementMode = ['masuk', 'keluar', 'penyesuaian'].includes(tab) ? tab : null

  return (
    <>
      <PageHeader
        title="Persediaan"
        description="Catat barang masuk, barang keluar, dan hasil stock opname. Setiap perubahan stok masuk ke kartu stok dan tidak bisa dihapus, hanya dikoreksi dengan catatan baru."
        actions={
          summary.alertCount > 0 ? (
            <Badge tone="amber">
              <AlertTriangle size={13} aria-hidden="true" /> {summary.alertCount} produk perlu perhatian
            </Badge>
          ) : (
            <Badge tone="green">
              <PackageCheck size={13} aria-hidden="true" /> Stok terkendali
            </Badge>
          )
        }
      />

      <div className="segmented" role="tablist" aria-label="Bagian persediaan" style={{ marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`segmented__button ${tab === item.value ? 'segmented__button--active' : ''}`.trim()}
            onClick={() => changeTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <StatCard
          label="Nilai persediaan"
          value={formatRupiah(summary.totalValue)}
          hint="Taksiran: stok x HPP (atau harga beli)"
          icon={Wallet}
          tone="cash"
        />
        <StatCard
          label="Produk berstok"
          value={`${summary.count} produk`}
          hint="Produk barang aktif yang stoknya dilacak"
          icon={Boxes}
        />
        <StatCard
          label="Stok menipis"
          value={`${summary.lowStock.length} produk`}
          hint="Sudah mencapai batas minimum"
          icon={AlertTriangle}
          tone={summary.lowStock.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Stok habis"
          value={`${summary.outOfStock.length} produk`}
          hint="Stok nol atau minus tidak diizinkan"
          icon={ArrowLeftRight}
          tone={summary.outOfStock.length > 0 ? 'expense' : 'default'}
        />
      </div>

      {tab === 'ringkasan' ? (
        <StockSummary products={data?.products ?? []} units={data?.units ?? []} onOpenCard={openStockCard} loading={!data} />
      ) : null}

      {movementMode ? (
        <div className="grid grid--sidebar">
          <StockMovementForm
            mode={movementMode}
            products={stockProducts}
            units={data?.units ?? []}
            loading={!data}
          />

          <Card>
            <CardHeader title="Pergerakan terakhir" subtitle="8 catatan stok terbaru" icon={ArrowLeftRight} />
            <CardBody>
              {!data ? (
                <p className="muted">Memuat riwayat...</p>
              ) : data.recentMovements.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="Belum ada pergerakan stok"
                  description="Catatan barang masuk, keluar, dan penyesuaian akan muncul di sini."
                />
              ) : (
                <ul className="activity-list">
                  {data.recentMovements.map((movement) => {
                    const product = data.productMap.get(movement.productId)
                    return (
                      <li className="activity-item" key={movement.id}>
                        <div className="activity-item__body">
                          <p className="activity-item__title">{product?.name ?? 'Produk dihapus'}</p>
                          <p className="activity-item__meta">
                            {formatLongDate(movement.date)}
                            {movement.note ? ` - ${movement.note}` : ''}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Badge tone={MOVEMENT_TONES[movement.type] ?? 'gray'}>
                            {MOVEMENT_LABELS[movement.type] ?? movement.type}
                          </Badge>
                          <p className="activity-item__meta num" style={{ marginTop: 4 }}>
                            {movement.change > 0 ? '+' : ''}
                            {formatNumber(movement.change)} {'->'} {formatNumber(movement.balanceAfter)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'kartu' ? (
        <StockCard
          products={stockProducts}
          units={data?.units ?? []}
          initialProductId={selectedProductId}
          loading={!data}
        />
      ) : null}
    </>
  )
}
