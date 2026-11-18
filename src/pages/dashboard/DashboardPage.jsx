import {
  AlertTriangle,
  Boxes,
  Package,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import PeriodFilter from './PeriodFilter'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'
import { useDashboardData } from '../../hooks/useDashboardData'
import { formatRupiah, formatRupiahCompact } from '../../utils/money'
import { formatShortDate, getPeriodRange, toDateKey } from '../../utils/dates'

const TODAY_KEY = toDateKey()
const MONTH_START = getPeriodRange('month').startDate

export default function DashboardPage() {
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ start: MONTH_START, end: TODAY_KEY })

  const { data, range, isLoading } = useDashboardData({
    period,
    customStart: custom.start,
    customEnd: custom.end,
  })

  const summary = data?.summary
  const series = data?.series
  const hasSeriesData =
    series?.points?.some((point) => point.penjualan > 0 || point.pengeluaran > 0) ?? false

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan kondisi usaha Anda. Omzet adalah nilai penjualan, laba adalah sisa setelah biaya, dan saldo kas adalah uang yang benar-benar tersedia."
      />

      {isLoading ? (
        <div className="stat-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="skeleton skeleton--stat" key={index} />
          ))}
        </div>
      ) : data?.error ? (
        <div className="alert alert--danger" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Data dashboard tidak dapat dimuat.</strong>
            <p>{data.error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="quick-strip">
            <div className="quick-strip__item">
              <span>Penjualan hari ini</span>
              <strong>{formatRupiah(data.quick.today)}</strong>
            </div>
            <div className="quick-strip__item">
              <span>Penjualan bulan ini</span>
              <strong>{formatRupiah(data.quick.month)}</strong>
            </div>
            <div className="quick-strip__item">
              <span>Periode tampil</span>
              <strong>{range.label}</strong>
            </div>
          </div>

          <PeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            custom={custom}
            onCustomChange={setCustom}
          />

          <div className="stat-grid">
            <StatCard
              label="Omzet periode"
              value={formatRupiah(summary.omzet)}
              hint={`${summary.transactions} transaksi penjualan`}
              icon={Receipt}
            />
            <StatCard
              label="HPP periode"
              value={formatRupiah(summary.hpp)}
              hint="Biaya langsung barang/jasa terjual"
              icon={Package}
            />
            <StatCard
              label="Laba kotor"
              value={formatRupiah(summary.grossProfit)}
              hint={`Margin kotor ${summary.margin}%`}
              icon={TrendingUp}
              tone="profit"
            />
            <StatCard
              label="Estimasi laba bersih"
              value={formatRupiah(summary.netProfit)}
              hint="Laba kotor dikurangi biaya operasional"
              icon={TrendingDown}
              tone="profit"
            />
            <StatCard
              label="Pengeluaran periode"
              value={formatRupiah(summary.operatingExpenses)}
              hint={`${summary.expenseCount} catatan pengeluaran`}
              icon={Wallet}
              tone="expense"
            />
            <StatCard
              label="Saldo kas"
              value={formatRupiah(data.cash.total)}
              hint={`${data.cash.accounts.length} akun kas aktif`}
              icon={WalletCards}
              tone="cash"
            />
            <StatCard
              label="Produk aktif"
              value={`${data.activeProducts} produk`}
              hint="Produk yang tidak dinonaktifkan"
              icon={Package}
            />
            <StatCard
              label="Stok menipis"
              value={`${data.lowStock.length} produk`}
              hint="Stok sama dengan atau di bawah minimum"
              icon={Boxes}
              tone={data.lowStock.length > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="grid grid--2" style={{ marginBottom: 16 }}>
            <Card>
              <CardHeader
                title="Grafik penjualan"
                subtitle={`Nilai omzet per ${series?.granularity === 'bulan' ? 'bulan' : 'hari'}`}
                icon={TrendingUp}
                action={
                  <div className="chart-legend">
                    <span>
                      <i className="chart-legend__dot" style={{ background: '#16a34a' }} />
                      Omzet
                    </span>
                  </div>
                }
              />
              <CardBody>
                {hasSeriesData ? (
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series.points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9e5" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                          width={68}
                          tickFormatter={(value) => formatRupiahCompact(value)}
                        />
                        <Tooltip
                          formatter={(value) => [formatRupiah(value), 'Omzet']}
                          contentStyle={{ borderRadius: 10, borderColor: '#e3e9e5', fontSize: 12 }}
                        />
                        <Bar dataKey="penjualan" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={38} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    icon={Receipt}
                    title="Belum ada penjualan pada periode ini"
                    description="Grafik akan terisi otomatis setelah Anda mencatat penjualan pada Tahap 4."
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Grafik pengeluaran"
                subtitle={`Biaya operasional per ${series?.granularity === 'bulan' ? 'bulan' : 'hari'}`}
                icon={Wallet}
                action={
                  <div className="chart-legend">
                    <span>
                      <i className="chart-legend__dot" style={{ background: '#b42318' }} />
                      Pengeluaran
                    </span>
                  </div>
                }
              />
              <CardBody>
                {hasSeriesData ? (
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series.points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e9e5" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                          width={68}
                          tickFormatter={(value) => formatRupiahCompact(value)}
                        />
                        <Tooltip
                          formatter={(value) => [formatRupiah(value), 'Pengeluaran']}
                          contentStyle={{ borderRadius: 10, borderColor: '#e3e9e5', fontSize: 12 }}
                        />
                        <Bar dataKey="pengeluaran" fill="#b42318" radius={[6, 6, 0, 0]} maxBarSize={38} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    icon={Wallet}
                    title="Belum ada pengeluaran pada periode ini"
                    description="Grafik akan terisi setelah Anda mencatat pengeluaran usaha pada Tahap 4."
                  />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid--sidebar">
            <Card>
              <CardHeader title="Transaksi terbaru" subtitle="Penjualan dan pengeluaran terakhir" icon={Receipt} />
              <CardBody>
                {data.recent.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="Belum ada transaksi"
                    description="Transaksi penjualan dan pengeluaran akan muncul di sini setelah modul Tahap 4 selesai."
                  />
                ) : (
                  <ul className="activity-list">
                    {data.recent.map((item) => {
                      const isIncome = item.kind === 'penjualan'
                      return (
                        <li className="activity-item" key={item.id}>
                          <span
                            className={`activity-item__icon ${
                              isIncome ? 'activity-item__icon--in' : 'activity-item__icon--out'
                            }`}
                          >
                            {isIncome ? <Receipt size={17} /> : <Wallet size={17} />}
                          </span>
                          <div className="activity-item__body">
                            <p className="activity-item__title">
                              {item.title}
                              {item.canceled ? ' (dibatalkan)' : ''}
                            </p>
                            <p className="activity-item__meta">
                              {formatShortDate(item.date)} - {item.subtitle}
                            </p>
                          </div>
                          <span
                            className={`activity-item__amount ${
                              isIncome ? 'activity-item__amount--in' : 'activity-item__amount--out'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatRupiah(item.amount)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Stok menipis"
                subtitle="Produk yang perlu segera diisi ulang"
                icon={Boxes}
                action={
                  data.lowStock.length > 0 ? <Badge tone="amber">{data.lowStock.length} produk</Badge> : null
                }
              />
              <CardBody>
                {data.lowStock.length === 0 ? (
                  <EmptyState
                    icon={Boxes}
                    title="Belum ada peringatan stok"
                    description="Peringatan muncul jika stok produk barang mencapai batas minimum yang Anda tentukan."
                  />
                ) : (
                  <ul className="activity-list">
                    {data.lowStock.slice(0, 6).map((product) => (
                      <li className="activity-item" key={product.id}>
                        <span className="activity-item__icon activity-item__icon--out">
                          <Boxes size={17} />
                        </span>
                        <div className="activity-item__body">
                          <p className="activity-item__title">{product.name}</p>
                          <p className="activity-item__meta">
                            Stok {product.stockQty ?? 0} - minimum {product.minStock ?? 0}
                          </p>
                        </div>
                        <Badge tone="amber">Isi ulang</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
