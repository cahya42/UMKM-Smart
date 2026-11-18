import { Eye, Search, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import { Card, CardBody } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import { cancelSale, listSales } from '../../database/repositories/saleRepo'
import { formatLongDate, toDateKey } from '../../utils/dates'
import { formatRupiah } from '../../utils/money'
import { PAYMENT_LABELS, PAYMENT_TONES, SALE_STATUS_LABELS } from '../../utils/sales'
import SaleDetailDialog from './SaleDetailDialog'

export default function SaleList() {
  const toast = useToast()
  const [filters, setFilters] = useState({ month: toDateKey().slice(0, 7), status: 'semua', search: '' })
  const [detailId, setDetailId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [canceling, setCanceling] = useState(false)

  const data = useLiveQuery(async () => {
    const [sales, accounts] = await Promise.all([listSales({ month: filters.month }), db.cash_accounts.toArray()])
    const ids = sales.map((sale) => sale.id)
    const items = ids.length > 0 ? await db.sale_items.where('saleId').anyOf(ids).toArray() : []

    const itemsBySale = new Map()
    for (const item of items) {
      const list = itemsBySale.get(item.saleId) ?? []
      list.push(item)
      itemsBySale.set(item.saleId, list)
    }

    return { sales, accounts, itemsBySale }
  }, [filters.month])

  const rows = useMemo(() => {
    if (!data) return []
    const search = filters.search.trim().toLowerCase()

    return data.sales.filter((sale) => {
      if (filters.status !== 'semua' && sale.status !== filters.status) return false
      if (search) {
        const haystack = `${sale.invoiceNumber} ${sale.customerName ?? ''}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [data, filters])

  const accountMap = useMemo(
    () => new Map((data?.accounts ?? []).map((account) => [account.id, account.name])),
    [data],
  )

  function openCancel(sale) {
    setReason('')
    setCancelTarget(sale)
  }

  async function handleCancel() {
    if (!cancelTarget) return
    if (reason.trim().length < 3) {
      toast.push('Alasan pembatalan minimal 3 karakter.', { tone: 'error' })
      return
    }

    setCanceling(true)
    try {
      await cancelSale(cancelTarget.id, reason)
      toast.push(`Penjualan ${cancelTarget.invoiceNumber} dibatalkan. Stok dan kas sudah dikembalikan.`)
      setCancelTarget(null)
      setReason('')
    } catch (error) {
      toast.push(error?.message ?? 'Penjualan gagal dibatalkan.', { tone: 'error' })
    } finally {
      setCanceling(false)
    }
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="muted">Memuat penjualan...</p>
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
              <div className="toolbar__search">
                <Search size={16} aria-hidden="true" />
                <input
                  className="input"
                  type="search"
                  placeholder="Cari nomor nota atau pelanggan"
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  aria-label="Cari penjualan"
                />
              </div>

              <input
                className="input"
                type="month"
                value={filters.month}
                onChange={(event) => setFilters({ ...filters, month: event.target.value })}
                aria-label="Bulan penjualan"
                style={{ width: 'auto' }}
              />

              <select
                className="select"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                aria-label="Status penjualan"
              >
                <option value="semua">Semua status</option>
                <option value="selesai">Selesai</option>
                <option value="dibatalkan">Dibatalkan</option>
              </select>
            </div>

            <span className="muted">{rows.length} nota</span>
          </div>

          {data.sales.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Belum ada penjualan bulan ini"
              description="Catat transaksi pertama Anda. Stok produk dan saldo kas akan menyesuaikan secara otomatis."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ada nota yang cocok"
              description="Ubah bulan, status, atau kata kunci pencarian."
            />
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table table--right">
                <thead>
                  <tr>
                    <th>No. nota</th>
                    <th>Tanggal</th>
                    <th>Pelanggan</th>
                    <th>Item</th>
                    <th>Total</th>
                    <th>Metode</th>
                    <th>Akun kas</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.invoiceNumber}</td>
                      <td>{formatLongDate(sale.date)}</td>
                      <td>{sale.customerName || <span className="text-soft">Pelanggan umum</span>}</td>
                      <td className="num">{sale.itemCount ?? data.itemsBySale.get(sale.id)?.length ?? 0}</td>
                      <td className="table__amount">{formatRupiah(sale.total)}</td>
                      <td>
                        <Badge tone={PAYMENT_TONES[sale.paymentMethod] ?? 'gray'}>
                          {PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                        </Badge>
                      </td>
                      <td className="muted">{accountMap.get(sale.cashAccountId) ?? '-'}</td>
                      <td>
                        <Badge tone={sale.status === 'dibatalkan' ? 'gray' : 'green'}>
                          {SALE_STATUS_LABELS[sale.status] ?? sale.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-button icon-button--sm"
                            title="Lihat detail"
                            aria-label={`Lihat detail ${sale.invoiceNumber}`}
                            onClick={() => setDetailId(sale.id)}
                          >
                            <Eye size={15} />
                          </button>
                          {sale.status !== 'dibatalkan' ? (
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Batalkan penjualan"
                              aria-label={`Batalkan ${sale.invoiceNumber}`}
                              onClick={() => openCancel(sale)}
                            >
                              <XCircle size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <SaleDetailDialog saleId={detailId} onClose={() => setDetailId(null)} />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Batalkan penjualan ini?"
        description={
          cancelTarget
            ? `Nota ${cancelTarget.invoiceNumber} sebesar ${formatRupiah(cancelTarget.total)} akan ditandai dibatalkan. Stok produk dikembalikan dan kas dicatat keluar dengan transaksi pembalik. Riwayat nota tidak dihapus.`
            : ''
        }
        confirmLabel="Batalkan penjualan"
        loading={canceling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      >
        <Field label="Alasan pembatalan" htmlFor="saleCancelReason" required hint="Minimal 3 karakter, tersimpan di audit log.">
          <textarea
            id="saleCancelReason"
            className="textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: salah input jumlah"
            maxLength={200}
            rows={2}
          />
        </Field>
      </ConfirmDialog>
    </>
  )
}
