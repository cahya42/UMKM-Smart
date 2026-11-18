import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Calculator,
  FileSpreadsheet,
  FileText,
  Receipt,
  Repeat,
  TrendingUp,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import PeriodFilter from '../dashboard/PeriodFilter'
import { formatLongDate, getPeriodRange, toDateKey } from '../../utils/dates'
import { buildReport, REPORTS } from '../../utils/reports'
import { exportReportToExcel, exportReportToPdf } from '../../utils/export'

const REPORT_ICONS = {
  'laba-rugi': TrendingUp,
  penjualan: Receipt,
  pengeluaran: Wallet,
  'arus-kas': ArrowLeftRight,
  'saldo-kas': WalletCards,
  persediaan: Boxes,
  hpp: Calculator,
  'produk-terlaris': BarChart3,
  'mutasi-stok': Repeat,
}

const TODAY = toDateKey()
const MONTH_START = getPeriodRange('month').startDate

export default function ReportsPage() {
  const toast = useToast()
  const [reportId, setReportId] = useState('laba-rugi')
  const [period, setPeriod] = useState('month')
  const [custom, setCustom] = useState({ start: MONTH_START, end: TODAY })
  const [exporting, setExporting] = useState('')

  const data = useLiveQuery(async () => {
    const [
      sales,
      saleItems,
      expenses,
      cashAccounts,
      cashTransactions,
      products,
      units,
      movements,
      productCosts,
      expenseCategories,
    ] = await Promise.all([
      db.sales.toArray(),
      db.sale_items.toArray(),
      db.expenses.toArray(),
      db.cash_accounts.toArray(),
      db.cash_transactions.toArray(),
      db.products.toArray(),
      db.units.toArray(),
      db.stock_movements.toArray(),
      db.product_costs.toArray(),
      db.expense_categories.toArray(),
    ])

    return {
      sales,
      saleItems,
      expenses,
      cashAccounts,
      cashTransactions,
      products,
      units,
      movements,
      productCosts,
      expenseCategories,
    }
  }, [])

  const range = useMemo(() => getPeriodRange(period, custom), [period, custom])
  const report = useMemo(
    () => (data ? buildReport(reportId, data, range) : null),
    [data, reportId, range],
  )

  async function handleExport(kind) {
    if (!report) return
    setExporting(kind)
    try {
      if (kind === 'excel') {
        await exportReportToExcel(report)
        toast.push('Laporan Excel diunduh.')
      } else {
        await exportReportToPdf(report)
        toast.push('Laporan PDF diunduh.')
      }
    } catch (error) {
      toast.push(error?.message ?? 'Ekspor laporan gagal.', { tone: 'error' })
    } finally {
      setExporting('')
    }
  }

  return (
    <>
      <PageHeader
        title="Laporan Usaha"
        description="Sembilan laporan dihitung dari data lokal pada perangkat ini. Unduh sebagai Excel untuk analisis lanjutan atau PDF untuk arsip."
      />

      <PeriodFilter
        period={period}
        onPeriodChange={setPeriod}
        custom={custom}
        onCustomChange={setCustom}
      />

      <div className="grid grid--sidebar">
        <Card>
          <CardHeader title="Pilih laporan" subtitle="9 laporan tersedia" icon={FileText} />
          <CardBody>
            <div className="report-menu">
              {REPORTS.map((item) => {
                const Icon = REPORT_ICONS[item.id] ?? FileText
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`report-menu__item ${reportId === item.id ? 'report-menu__item--active' : ''}`.trim()}
                    aria-pressed={reportId === item.id}
                    onClick={() => setReportId(item.id)}
                  >
                    <span className="report-menu__icon">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <div className="stack">
          <Card>
            <CardHeader
              title={report?.label ?? 'Laporan'}
              subtitle={report?.periodLabel ?? range.label}
              icon={REPORT_ICONS[reportId] ?? FileText}
              action={
                <div className="row" style={{ gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={FileSpreadsheet}
                    loading={exporting === 'excel'}
                    disabled={!report || Boolean(exporting)}
                    onClick={() => handleExport('excel')}
                  >
                    Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={FileText}
                    loading={exporting === 'pdf'}
                    disabled={!report || Boolean(exporting)}
                    onClick={() => handleExport('pdf')}
                  >
                    PDF
                  </Button>
                </div>
              }
            />
            <CardBody>
              {!report ? (
                <p className="muted">Memuat laporan...</p>
              ) : (
                <>
                  {report.summary.length > 0 ? (
                    <div className="stat-grid" style={{ marginBottom: 16 }}>
                      {report.summary.map((item) => (
                        <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
                      ))}
                    </div>
                  ) : null}

                  <div className="table-wrap">
                    <table className="table table--right">
                      <thead>
                        <tr>
                          {report.columns.map((column) => (
                            <th key={column.key} className={column.align === 'right' ? 'num' : undefined}>
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((row, index) => (
                          <tr key={`${report.id}-${index}`}>
                            {report.columns.map((column) => (
                              <td
                                key={column.key}
                                className={column.align === 'right' ? 'table__amount' : undefined}
                              >
                                {row[column.key] ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="form-note" style={{ marginTop: 12 }}>
                    {report.description} Dihitung dari data lokal sampai {formatLongDate(range.endDate)}. Laporan
                    tidak mengirim data ke internet.
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
