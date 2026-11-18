import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../database/repositories/catalogRepo'
import { categorySchema } from '../../utils/validation'

export default function CategoryManager() {
  const toast = useToast()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const data = useLiveQuery(async () => {
    const [categories, products] = await Promise.all([listCategories(), db.products.toArray()])
    const counts = new Map()
    for (const product of products) {
      if (!product.categoryId) continue
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1)
    }
    return { categories, counts }
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    const parsed = categorySchema.safeParse({ name: newName })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Nama kategori tidak valid.')
      return
    }
    setBusy(true)
    try {
      await createCategory(parsed.data)
      setNewName('')
      setError('')
      toast.push('Kategori ditambahkan.')
    } catch (err) {
      setError(err?.message ?? 'Kategori gagal ditambahkan.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdate(category) {
    const parsed = categorySchema.safeParse({ name: editingName })
    if (!parsed.success) {
      toast.push(parsed.error.issues[0]?.message ?? 'Nama kategori tidak valid.', { tone: 'error' })
      return
    }
    try {
      await updateCategory(category.id, parsed.data)
      setEditingId(null)
      toast.push('Kategori diperbarui.')
    } catch (err) {
      toast.push(err?.message ?? 'Kategori gagal diperbarui.', { tone: 'error' })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteCategory(deleteTarget.id)
      toast.push(`Kategori ${deleteTarget.name} dihapus.`, { tone: 'info' })
      setDeleteTarget(null)
    } catch (err) {
      toast.push(err?.message ?? 'Kategori gagal dihapus.', { tone: 'error' })
    }
  }

  return (
    <Card>
      <CardHeader
        title="Kategori produk"
        subtitle="Kategori membantu filter produk dan analisis penjualan. Kategori yang masih dipakai tidak dapat dihapus."
        icon={Tags}
      />
      <CardBody>
        <form className="inline-form" onSubmit={handleCreate}>
          <input
            className={`input ${error ? 'input--error' : ''}`.trim()}
            value={newName}
            onChange={(event) => {
              setNewName(event.target.value)
              setError('')
            }}
            placeholder="Nama kategori baru, misalnya: Minuman"
            maxLength={60}
            aria-label="Nama kategori baru"
          />
          <Button type="submit" icon={Plus} loading={busy}>
            Tambah
          </Button>
        </form>
        {error ? <p className="field__error" style={{ marginTop: 8 }}>{error}</p> : null}

        <div style={{ marginTop: 18 }}>
          {!data ? (
            <p className="muted">Memuat kategori...</p>
          ) : data.categories.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="Belum ada kategori"
              description="Kategori bersifat opsional, tetapi memudahkan pencarian dan analisis produk."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Jumlah produk</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        {editingId === category.id ? (
                          <input
                            className="input input--sm"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            maxLength={60}
                            autoFocus
                            aria-label={`Nama kategori ${category.name}`}
                          />
                        ) : (
                          category.name
                        )}
                      </td>
                      <td>{data.counts.get(category.id) ?? 0} produk</td>
                      <td>
                        <div className="row-actions">
                          {editingId === category.id ? (
                            <>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                aria-label="Simpan nama kategori"
                                title="Simpan"
                                onClick={() => handleUpdate(category)}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                aria-label="Batal mengubah kategori"
                                title="Batal"
                                onClick={() => setEditingId(null)}
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                aria-label={`Ubah kategori ${category.name}`}
                                title="Ubah"
                                onClick={() => {
                                  setEditingId(category.id)
                                  setEditingName(category.name)
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                aria-label={`Hapus kategori ${category.name}`}
                                title="Hapus"
                                onClick={() => setDeleteTarget(category)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardBody>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus kategori ini?"
        description={
          deleteTarget
            ? `Kategori "${deleteTarget.name}" akan dihapus. Kategori yang masih dipakai produk tidak dapat dihapus.`
            : ''
        }
        confirmLabel="Hapus kategori"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  )
}
