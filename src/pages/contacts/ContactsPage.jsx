import { Pencil, Plus, Power, Search, Trash2, Truck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'
import {
  CONTACT_KINDS,
  deleteContact,
  getContactUsage,
  listContacts,
  setContactActive,
} from '../../database/repositories/contactRepo'
import { formatRupiah } from '../../utils/money'
import ContactFormDialog from './ContactFormDialog'

const CONFIG = {
  [CONTACT_KINDS.PELANGGAN]: {
    title: 'Pelanggan',
    icon: Users,
    description:
      'Simpan kontak pelanggan agar nota dapat dihubungkan ke orang yang tepat. Data ini hanya kontak; belum ada piutang atau saldo pelanggan.',
    usageLabel: 'Nota',
    valueLabel: 'Total belanja',
    emptyDescription:
      'Tambahkan pelanggan pertama Anda, atau langsung buat dari formulir penjualan saat mencatat nota.',
  },
  [CONTACT_KINDS.PEMASOK]: {
    title: 'Pemasok',
    icon: Truck,
    description:
      'Simpan kontak pemasok untuk menandai asal barang masuk. Data ini hanya kontak; pembelian tunai dicatat lewat menu Persediaan.',
    usageLabel: 'Barang masuk',
    valueLabel: 'Nilai pembelian',
    emptyDescription:
      'Tambahkan pemasok pertama Anda, lalu pilih namanya saat mencatat barang masuk di menu Persediaan.',
  },
}

export default function ContactsPage({ kind = CONTACT_KINDS.PELANGGAN }) {
  const config = CONFIG[kind] ?? CONFIG[CONTACT_KINDS.PELANGGAN]
  const toast = useToast()
  const Icon = config.icon
  const noun = config.title.toLowerCase()

  const [filters, setFilters] = useState({ search: '', status: 'aktif' })
  // undefined = dialog tertutup, null = kontak baru, objek = sedang diubah.
  const [formContact, setFormContact] = useState(undefined)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const data = useLiveQuery(async () => {
    const [contacts, usage] = await Promise.all([listContacts(kind), getContactUsage(kind)])
    return { contacts, usage }
  }, [kind])

  const rows = useMemo(() => {
    if (!data) return []
    const search = filters.search.trim().toLowerCase()

    return data.contacts.filter((contact) => {
      if (filters.status === 'aktif' && contact.isActive === false) return false
      if (filters.status === 'nonaktif' && contact.isActive !== false) return false
      if (search) {
        const haystack = `${contact.name ?? ''} ${contact.phone ?? ''} ${contact.email ?? ''}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })
  }, [data, filters])

  async function handleToggleActive(contact) {
    try {
      await setContactActive(kind, contact.id, contact.isActive === false)
      toast.push(
        contact.isActive === false
          ? `${config.title} ${contact.name} diaktifkan kembali.`
          : `${config.title} ${contact.name} dinonaktifkan. Riwayat transaksinya tetap tersimpan.`,
      )
    } catch (error) {
      toast.push(error?.message ?? 'Status gagal diubah.', { tone: 'error' })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteContact(kind, deleteTarget.id)
      toast.push(`${config.title} ${deleteTarget.name} dihapus permanen.`, { tone: 'info' })
      setDeleteTarget(null)
    } catch (error) {
      toast.push(error?.message ?? 'Data gagal dihapus.', { tone: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  if (!data) {
    return (
      <>
        <PageHeader title={config.title} description={config.description} />
        <Card>
          <CardBody>
            <p className="muted">Memuat {noun}...</p>
          </CardBody>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <Button icon={Plus} onClick={() => setFormContact(null)}>
            Tambah {noun}
          </Button>
        }
      />

      <Card>
        <CardBody>
          <div className="toolbar toolbar--plain">
            <div className="toolbar__filters" style={{ flex: 1 }}>
              <div className="toolbar__search">
                <Search size={16} aria-hidden="true" />
                <input
                  className="input"
                  type="search"
                  placeholder={`Cari nama, telepon, atau email ${noun}`}
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  aria-label={`Cari ${noun}`}
                />
              </div>

              <select
                className="select"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                aria-label={`Filter status ${noun}`}
              >
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
                <option value="semua">Semua status</option>
              </select>
            </div>

            <span className="muted">
              {rows.length} dari {data.contacts.length} {noun}
            </span>
          </div>

          {data.contacts.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={`Belum ada ${noun}`}
              description={config.emptyDescription}
              action={
                <Button icon={Plus} onClick={() => setFormContact(null)}>
                  Tambah {noun} pertama
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Search}
              title={`Tidak ada ${noun} yang cocok`}
              description="Ubah kata kunci atau filter status untuk melihat data lain."
            />
          ) : (
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="table table--right">
                <thead>
                  <tr>
                    <th>{config.title}</th>
                    <th>Kontak</th>
                    <th>{config.usageLabel}</th>
                    <th>{config.valueLabel}</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((contact) => {
                    const usage = data.usage.get(contact.id) ?? { count: 0, total: 0 }
                    return (
                      <tr key={contact.id}>
                        <td>
                          <p className="product-cell__name">{contact.name}</p>
                          {contact.note ? <p className="product-cell__meta">{contact.note}</p> : null}
                        </td>
                        <td>
                          <p>{contact.phone || <span className="text-soft">-</span>}</p>
                          {contact.email ? <p className="product-cell__meta">{contact.email}</p> : null}
                        </td>
                        <td className="num">{usage.count}</td>
                        <td className="table__amount">
                          {usage.total > 0 ? formatRupiah(usage.total) : <span className="text-soft">-</span>}
                        </td>
                        <td>
                          <Badge tone={contact.isActive === false ? 'gray' : 'green'}>
                            {contact.isActive === false ? 'Nonaktif' : 'Aktif'}
                          </Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title="Ubah data"
                              aria-label={`Ubah ${contact.name}`}
                              onClick={() => setFormContact(contact)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title={contact.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}
                              aria-label={
                                contact.isActive === false ? `Aktifkan ${contact.name}` : `Nonaktifkan ${contact.name}`
                              }
                              onClick={() => handleToggleActive(contact)}
                            >
                              <Power size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-button--sm"
                              title={usage.count > 0 ? 'Sudah dipakai transaksi, tidak dapat dihapus' : 'Hapus permanen'}
                              aria-label={`Hapus ${contact.name}`}
                              onClick={() => setDeleteTarget(contact)}
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

      <ContactFormDialog
        kind={kind}
        open={formContact !== undefined}
        contact={formContact}
        onClose={() => setFormContact(undefined)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Hapus ${noun} ini?`}
        description={
          deleteTarget
            ? `${config.title} "${deleteTarget.name}" akan dihapus permanen. Data yang sudah dipakai transaksi tidak dapat dihapus; nonaktifkan saja agar riwayat tetap utuh.`
            : ''
        }
        confirmLabel={`Hapus ${noun}`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
