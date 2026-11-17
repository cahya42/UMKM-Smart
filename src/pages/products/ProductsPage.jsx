import { useState } from 'react'
import { Plus } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import ProductList from './ProductList'
import ProductFormDialog from './ProductFormDialog'
import ProductDetailDialog from './ProductDetailDialog'
import CategoryManager from './CategoryManager'
import UnitManager from './UnitManager'

const TABS = [
  { value: 'produk', label: 'Daftar Produk' },
  { value: 'kategori', label: 'Kategori' },
  { value: 'satuan', label: 'Satuan' },
]

export default function ProductsPage() {
  const [tab, setTab] = useState('produk')
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [detailProductId, setDetailProductId] = useState(null)

  function openCreate() {
    setEditingProduct(null)
    setFormOpen(true)
  }

  function openEdit(product) {
    setEditingProduct(product)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingProduct(null)
  }

  return (
    <>
      <PageHeader
        title="Produk"
        description="Kelola barang dan jasa yang Anda jual. Stok tidak diubah dari sini; setiap perubahan stok dicatat di menu Persediaan agar kartu stok tetap utuh."
        actions={tab === 'produk' ? <Button icon={Plus} onClick={openCreate}>Tambah produk</Button> : null}
      />

      <div className="segmented" role="tablist" aria-label="Bagian produk" style={{ marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`segmented__button ${tab === item.value ? 'segmented__button--active' : ''}`.trim()}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'produk' ? (
        <ProductList onCreate={openCreate} onEdit={openEdit} onDetail={(product) => setDetailProductId(product.id)} />
      ) : null}
      {tab === 'kategori' ? <CategoryManager /> : null}
      {tab === 'satuan' ? <UnitManager /> : null}

      <ProductFormDialog open={formOpen} product={editingProduct} onClose={closeForm} />

      <ProductDetailDialog
        productId={detailProductId}
        onClose={() => setDetailProductId(null)}
        onEdit={(product) => {
          setDetailProductId(null)
          openEdit(product)
        }}
      />
    </>
  )
}
