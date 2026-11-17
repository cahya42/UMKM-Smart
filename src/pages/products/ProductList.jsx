import { Pencil, Plus, Power, Search, Trash2, Eye, Package } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import { deleteProduct, setProductActive } from '../../database/repositories/productRepo'
import { formatNumber, formatPercent, formatRupiah, grossMargin, toQuantity } from '../../utils/money'

export default function ProductList({ onCreate, onEdit, onDetail }) {
  const toast = useToast()
  const [filters, setFilters] = useState({ search: '', categoryId: '', type: '', status: 'aktif' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const data = useLiveQuery(async () => {
    const [products, categories, units] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
      db.units.toArray(),
    ])
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
    const unitMap = new Map(units.map((unit) => [unit.id, unit.name]))
    return { products, categories, units, categoryMap, unitMap }
  }, [])

  const visibleProducts = useMemo(() => {
    if (!data) return []
    const search = filters.search.trim().toLowerCase()

    return data.products
      .filter((product) => {
        if (filters.status === 'aktif' && product.isActive === false) return false
        if (filters.status === 'nonaktif' && product.isActive !== false) return false
        if (filters.type && product.type !== filters.type) return false
        if (filters.categoryId && product.categoryId !== filters.categoryId) return false
        if (search) {
          const haystack = `${product.name} ${product.sku ?? ''}`.toLowerCase()
          if (!haystack.includes(search)) return false
        }
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [data, filters])

  async function handleToggleActive(product) {
    try {
      await setProductActive(product.id, product.isActive === false)
      toast.push(
        product.isActive === false
          ? `Produk ${product.name} diaktifkan kembali.`
          : `Produk ${product.name} dinonaktifkan. Datanya tetap tersimpan.`,
      )
    } catch (error) {
      toast.push(error?.message ?? 'Status produk gagal diubah.', { tone: 'error' })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProduct(deleteTarget.id)
      toast.push(`Produk ${deleteTarget.name} dihapus permanen.`, { tone: 'info' })
      setDeleteTarget(null)
    } catch (error) {
      toast.push(error?.message ?? 'Produk gagal dihapus.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="muted">Memuat produk...</p>
        </CardBody>
      </Card>
    )
  }

  const hasAnyProduct = data.products.length > 0

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
                  placeholder="Cari nama atau SKU produk"
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  aria-label="Cari produk"
                />
              </div>

              <select
                className="select"
                value={filters.categoryId}
                onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}
                aria-label="Filter kategori"
              >
                <option value="">Semua kategori</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={filters.type}
                onChange={(event) => setFilters({ ...filters, type: event.target.value })}
                aria-label="Filter jenis produk"
              >
                <option value="">Semua jenis</option>
                <option value="barang">Barang</option>
                <option value="jasa">Jasa</option>
              </select>

              <select
                className="select"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                aria-label="Filter status produk"
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
                <option value="semua">Semua status</option>
              </select>
            </div>

            <span className="muted">
              {visibleProducts.length} dari {data.products.length} produk
            </span>
          </div>

          {!hasAnyProduct ? (
            <EmptyState
              icon={Package}
              title="Belum ada produk"
              description="Tambahkan produk pertama Anda. Untuk usaha jasa, pilih jenis Jasa agar tidak ada pencatatan stok."
              action={
                <Button icon={Plus} onClick={onCreate}>
                  Tambah produk pertama
                </Button>
              }
            />
          ) : visibleProducts.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Tidak ada produk yang cocok"
              description="Ubah kata kunci atau filter untuk melihat produk lain."
            />
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table table--right">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Jenis</th>
                    <th>Harga jual</th>
                    <th>HPP</th>
                    <th>Margin</th>
                    <th>Stok</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => {
                    const stock = toQuantity(product.stockQty)
                    const minimum = toQuantity(product.minStock)
                    const isBarang = product.type === 'barang'
                    const isLow = isBarang && product.trackStock !== false && stock <= minimum
                    const margin = grossMargin(product.sellingPrice, product.hpp)

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="product-cell">
                            <span className="product-thumb">
                              {product.imageDataUrl ? (
                                <img src={product.imageDataUrl} alt="" />
                              ) : (
                                <Package size={18} aria-hidden="true" />
                              )}
                            </span>
                            <div>
                              <p className="product-cell__name">{product.name}</p>
                              <p className="product-cell__meta">
                                {product.sku}
                                {product.categoryId ? ` - ${data.categoryMap.get(product.categoryId) ?? '-'}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>{isBarang ? 'Barang' : 'Jasa'}</td>
                        <td className="table__amount">{formatRupiah(product.sellingPrice)}</td>
                        <td className="table__amount">
                          {product.hpp > 0 ? formatRupiah(product.hpp) : <span className="text-soft">-</span>}
                        </td>
                        <td>{product.hpp > 0 ? formatPercent(margin) : <span className="text-soft">-</span>}</td>
                        <td className="num">
                          {!isBarang || product.trackStock === false ? (
                            <span className="text-soft">Tanpa stok</span>
                          ) : (
                            <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                              {formatNumber(stock)} {data.unitMap.get(product.unitId) ?? ''}
                              {isLow ? <Badge tone={stock <= 0 ? 'red' : 'amber'}>{stock <= 0 ? 'Habis' : 'Menipis'}</Badge> : null}
                            </span>
                          )}
                        </td>
                        <td>
                          <Badge tone={product.isActive === false ? 'gray' : 'green'}>
                            {product.isActive === false ? 'Nonaktif' : 'Aktif'}
                          </Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Lihat detail"
                              aria-label={`Lihat detail ${product.name}`}
                              onClick={() => onDetail(product)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Ubah produk"
                              aria-label={`Ubah ${product.name}`}
                              onClick={() => onEdit(product)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title={product.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}
                              aria-label={product.isActive === false ? `Aktifkan ${product.name}` : `Nonaktifkan ${product.name}`}
                              onClick={() => handleToggleActive(product)}
                            >
                              <Power size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Hapus permanen"
                              aria-label={`Hapus ${product.name}`}
                              onClick={() => setDeleteTarget(product)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus produk ini?"
        description={
          deleteTarget
            ? `Produk "${deleteTarget.name}" akan dihapus permanen. Produk dengan riwayat penjualan atau pergerakan stok selain stok awal tidak dapat dihapus; nonaktifkan saja agar riwayat tetap utuh.`
            : ''
        }
        confirmLabel="Hapus produk"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
