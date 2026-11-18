import { Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { CONTACT_KINDS, createContact, updateContact } from '../../database/repositories/contactRepo'
import { contactSchema, toFieldErrors } from '../../utils/validation'

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', note: '' }

const LABELS = {
  [CONTACT_KINDS.PELANGGAN]: {
    label: 'Pelanggan',
    namePlaceholder: 'Contoh: Bu Sari',
    notePlaceholder: 'Contoh: pelanggan tetap, langganan mingguan',
  },
  [CONTACT_KINDS.PEMASOK]: {
    label: 'Pemasok',
    namePlaceholder: 'Contoh: Toko Beras Makmur',
    notePlaceholder: 'Contoh: pemasok beras dan minyak, antar tiap Senin',
  },
}

function toForm(contact) {
  if (!contact) return EMPTY_FORM
  return {
    name: contact.name ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    address: contact.address ?? '',
    note: contact.note ?? '',
  }
}

export default function ContactFormDialog({ kind = CONTACT_KINDS.PELANGGAN, open, contact = null, onClose, onSaved }) {
  const toast = useToast()
  const labels = LABELS[kind] ?? LABELS[CONTACT_KINDS.PELANGGAN]
  const noun = labels.label.toLowerCase()
  const isEdit = Boolean(contact)

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(toForm(contact))
    setErrors({})
  }, [open, contact])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const parsed = contactSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push(`Periksa kembali data ${noun} yang ditandai merah.`, { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      const saved = isEdit
        ? await updateContact(kind, contact.id, parsed.data)
        : await createContact(kind, parsed.data)

      toast.push(
        isEdit
          ? `Data ${noun} ${saved.name} diperbarui.`
          : `${labels.label} ${saved.name} ditambahkan.`,
      )
      onSaved?.(saved)
      onClose?.()
    } catch (error) {
      toast.push(error?.message ?? `Data ${noun} gagal disimpan.`, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Ubah ${noun}` : `Tambah ${noun}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h3>
              {isEdit ? 'Ubah' : 'Tambah'} {noun}
            </h3>
            <p className="muted">Hanya data kontak. Tidak ada piutang atau utang yang dicatat di sini.</p>
          </div>
          <button type="button" className="icon-button icon-button--sm" onClick={onClose} aria-label="Tutup formulir">
            <X size={17} />
          </button>
        </div>

        <form className="modal__content" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <Field label={`Nama ${noun}`} htmlFor="contactName" required error={errors.name} className="form-grid__full">
              <input
                id="contactName"
                className={`input ${errors.name ? 'input--error' : ''}`.trim()}
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder={labels.namePlaceholder}
                maxLength={80}
              />
            </Field>

            <Field label="Nomor telepon" htmlFor="contactPhone" error={errors.phone} hint="Opsional.">
              <input
                id="contactPhone"
                className={`input ${errors.phone ? 'input--error' : ''}`.trim()}
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
                placeholder="0812xxxxxxx"
                maxLength={30}
              />
            </Field>

            <Field label="Email" htmlFor="contactEmail" error={errors.email} hint="Opsional.">
              <input
                id="contactEmail"
                type="email"
                className={`input ${errors.email ? 'input--error' : ''}`.trim()}
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                placeholder="nama@contoh.com"
                maxLength={80}
              />
            </Field>

            <Field label="Alamat" htmlFor="contactAddress" error={errors.address} hint="Opsional." className="form-grid__full">
              <textarea
                id="contactAddress"
                className={`textarea ${errors.address ? 'textarea--error' : ''}`.trim()}
                value={form.address}
                onChange={(event) => setField('address', event.target.value)}
                placeholder="Alamat singkat atau patokan lokasi"
                maxLength={200}
                rows={2}
              />
            </Field>

            <Field label="Catatan" htmlFor="contactNote" error={errors.note} hint="Opsional." className="form-grid__full">
              <textarea
                id="contactNote"
                className="textarea"
                value={form.note}
                onChange={(event) => setField('note', event.target.value)}
                placeholder={labels.notePlaceholder}
                maxLength={200}
                rows={2}
              />
            </Field>
          </div>

          <div className="form-actions">
            <Button type="submit" icon={Save} loading={saving}>
              {isEdit ? 'Simpan perubahan' : `Simpan ${noun}`}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <span className="form-note">Nama {noun} tidak boleh sama dengan data yang sudah ada.</span>
          </div>
        </form>
      </div>
    </div>
  )
}
