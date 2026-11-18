import { Check, Pencil, Plus, Ruler, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { db } from '../../database/db'
import { createUnit, deleteUnit, listUnits, updateUnit } from '../../database/repositories/catalogRepo'
import { toFieldErrors, unitSchema } from '../../utils/validation'

const EMPTY = { name: '', description: '' }

export default function UnitManager() {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const data = useLiveQuery(async () => {
    const [units, products] = await Promise.all([listUnits(), db.products.toArray()])
    const counts = new Map()
    for (const product of products) {
      if (!product.unitId) continue
      counts.set(product.unitId, (counts.get(product.unitId) ?? 0) + 1)
    }
    return { units, counts }
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    const parsed = unitSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      return
    }
    setBusy(true)
    try {
      await createUnit(parsed.data)
      setForm(EMPTY)
      setErrors({})
      toast.push('Satuan ditambahkan.')
    } catch (error) {
      toast.push(error?.message ?? 'Satuan gagal ditambahkan.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdate(unit) {
    const parsed = unitSchema.safeParse(editForm)
    if (!parsed.success) {
      toast.push(parsed.error.issues[0]?.message ?? 'Data satuan tidak valid.', { tone: 'error' })
      return
    }
    try {
      await updateUnit(unit.id, parsed.data)
      setEditingId(null)
      toast.push('Satuan diperbarui.')
    } catch (error) {
      toast.push(error?.message ?? 'Satuan gagal diperbarui.', { tone: 'error' })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteUnit(deleteTarget.id)
      toast.push(`Satuan ${deleteTarget.name} dihapus.`, { tone: 'info' })
      setDeleteTarget(null)
    } catch (error) {
      toast.push(error?.message ?? 'Satuan gagal dihapus.', { tone: 'error' })
    }
  }

  return (
    <Card>
      <CardHeader
        title="Satuan produk"
        subtitle="Satuan dipakai pada produk, stok, dan laporan. Satuan yang masih dipakai tidak dapat dihapus."
        icon={Ruler}
      />
      <CardBody>
        <form className="inline-form" onSubmit={handleCreate}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <input
              className={`input ${errors.name ? 'input--error' : ''}`.trim()}
              value={form.name}
              onChange={(event) => {
                setForm({ ...form, name: event.target.value })
                setErrors({ ...errors, name: undefined })
              }}
              placeholder="Satuan baru, misalnya: dus"
              maxLength={20}
              aria-label="Nama satuan baru"
            />
            {errors.name ? <p className="field__error">{errors.name}</p> : null}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              className="input"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Keterangan (opsional)"
              maxLength={80}
              aria-label="Keterangan satuan baru"
            />
          </div>
          <Button type="submit" icon={Plus} loading={busy}>
            Tambah
          </Button>
        </form>

        <div style={{ marginTop: 18 }}>
          {!data ? (
            <p className="muted">Memuat satuan...</p>
          ) : data.units.length === 0 ? (
            <EmptyState icon={Ruler} title="Belum ada satuan" description="Tambahkan satuan yang Anda pakai, misalnya pcs atau kg." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Satuan</th>
                    <th>Keterangan</th>
                    <th>Jumlah produk</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.units.map((unit) => (
                    <tr key={unit.id}>
                      <td>
                        {editingId === unit.id ? (
                          <input
                            className="input input--sm"
                            value={editForm.name}
                            onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                            maxLength={20}
                            autoFocus
                            aria-label={`Nama satuan ${unit.name}`}
                          />
                        ) : (
                          unit.name
                        )}
                      </td>
                      <td>
                        {editingId === unit.id ? (
                          <input
                            className="input input--sm"
                            value={editForm.description}
                            onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                            maxLength={80}
                            aria-label={`Keterangan satuan ${unit.name}`}
                          />
                        ) : (
                          <span className="muted">{unit.description || '-'}</span>
                        )}
                      </td>
                      <td>{data.counts.get(unit.id) ?? 0} produk</td>
                      <td>
                        <div className="row-actions">
                          {editingId === unit.id ? (
                            <>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Simpan"
                                aria-label="Simpan satuan"
                                onClick={() => handleUpdate(unit)}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Batal"
                                aria-label="Batal mengubah satuan"
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
                                title="Ubah"
                                aria-label={`Ubah satuan ${unit.name}`}
                                onClick={() => {
                                  setEditingId(unit.id)
                                  setEditForm({ name: unit.name, description: unit.description ?? '' })
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Hapus"
                                aria-label={`Hapus satuan ${unit.name}`}
                                onClick={() => setDeleteTarget(unit)}
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
        title="Hapus satuan ini?"
        description={
          deleteTarget
            ? `Satuan "${deleteTarget.name}" akan dihapus. Satuan yang masih dipakai produk tidak dapat dihapus.`
            : ''
        }
        confirmLabel="Hapus satuan"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  )
}
