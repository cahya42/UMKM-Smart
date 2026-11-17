import { Building2, ImagePlus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Field } from '../../components/ui/Field'
import Badge from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { getBusinessProfile, saveBusinessProfile } from '../../database/repositories/businessProfileRepo'
import { BUSINESS_TYPES, businessProfileSchema, toFieldErrors } from '../../utils/validation'

const EMPTY_FORM = {
  businessName: '',
  ownerName: '',
  businessType: '',
  address: '',
  phone: '',
  email: '',
  description: '',
  startDate: '',
  logoDataUrl: null,
}

const MAX_LOGO_BYTES = 400 * 1024

export default function ProfilePage() {
  const toast = useToast()
  const query = useLiveQuery(async () => ({ profile: await getBusinessProfile() }), [])
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!query || hydrated) return
    if (query.profile) {
      setForm({
        businessName: query.profile.businessName ?? '',
        ownerName: query.profile.ownerName ?? '',
        businessType: query.profile.businessType ?? '',
        address: query.profile.address ?? '',
        phone: query.profile.phone ?? '',
        email: query.profile.email ?? '',
        description: query.profile.description ?? '',
        startDate: query.profile.startDate ?? '',
        logoDataUrl: query.profile.logoDataUrl ?? null,
      })
    }
    setHydrated(true)
  }, [query, hydrated])

  const isNew = Boolean(query) && !query.profile

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.push('Berkas logo harus berupa gambar (JPG atau PNG).', { tone: 'error' })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.push('Ukuran gambar logo maksimal 400 KB. Perkecil gambar terlebih dahulu.', { tone: 'error' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      updateField('logoDataUrl', String(reader.result))
      toast.push('Logo dipilih. Tekan Simpan untuk menyimpan perubahan.', { tone: 'info' })
    }
    reader.onerror = () => toast.push('Gambar tidak dapat dibaca. Coba berkas lain.', { tone: 'error' })
    reader.readAsDataURL(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const parsed = businessProfileSchema.safeParse(form)

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      toast.push('Periksa kembali data yang ditandai merah.', { tone: 'error' })
      return
    }

    setSaving(true)
    try {
      await saveBusinessProfile({ ...parsed.data, logoDataUrl: form.logoDataUrl })
      toast.push(isNew ? 'Profil usaha berhasil dibuat.' : 'Profil usaha berhasil diperbarui.')
      setHydrated(false)
    } catch (error) {
      toast.push(error?.message ?? 'Profil usaha gagal disimpan.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Profil Usaha"
        description="Data ini dipakai pada laporan, bukti transaksi, dan konteks analisis SMART ADVISOR. Tidak ada batasan berapa kali profil dapat diperbarui."
        actions={query?.profile?.updatedAt ? <Badge tone="gray">Diperbarui {new Date(query.profile.updatedAt).toLocaleDateString('id-ID')}</Badge> : null}
      />

      <div className="grid grid--sidebar">
        <Card>
          <CardHeader
            title="Identitas usaha"
            subtitle="Isi data sesuai kondisi usaha Anda saat ini"
            icon={Building2}
          />
          <CardBody>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid">
                <Field
                  label="Nama usaha"
                  htmlFor="businessName"
                  required
                  error={errors.businessName}
                  className="form-grid__full"
                >
                  <input
                    id="businessName"
                    className={`input ${errors.businessName ? 'input--error' : ''}`.trim()}
                    value={form.businessName}
                    onChange={(event) => updateField('businessName', event.target.value)}
                    placeholder="Contoh: Warung Sari Rasa"
                    maxLength={80}
                    autoComplete="organization"
                  />
                </Field>

                <Field label="Nama pemilik" htmlFor="ownerName" error={errors.ownerName}>
                  <input
                    id="ownerName"
                    className={`input ${errors.ownerName ? 'input--error' : ''}`.trim()}
                    value={form.ownerName}
                    onChange={(event) => updateField('ownerName', event.target.value)}
                    placeholder="Nama pemilik usaha"
                    maxLength={80}
                    autoComplete="name"
                  />
                </Field>

                <Field label="Jenis usaha" htmlFor="businessType" required error={errors.businessType}>
                  <select
                    id="businessType"
                    className={`select ${errors.businessType ? 'select--error' : ''}`.trim()}
                    value={form.businessType}
                    onChange={(event) => updateField('businessType', event.target.value)}
                  >
                    <option value="">Pilih jenis usaha</option>
                    {BUSINESS_TYPES.map((type) => (
                      <option value={type} key={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Tanggal mulai usaha"
                  htmlFor="startDate"
                  error={errors.startDate}
                  hint="Boleh dikosongkan jika tidak diingat."
                >
                  <input
                    id="startDate"
                    type="date"
                    className={`input ${errors.startDate ? 'input--error' : ''}`.trim()}
                    value={form.startDate}
                    onChange={(event) => updateField('startDate', event.target.value)}
                  />
                </Field>

                <Field label="Nomor telepon" htmlFor="phone" error={errors.phone}>
                  <input
                    id="phone"
                    className={`input ${errors.phone ? 'input--error' : ''}`.trim()}
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    placeholder="0812xxxxxxx"
                    maxLength={30}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </Field>

                <Field label="Email usaha" htmlFor="email" error={errors.email}>
                  <input
                    id="email"
                    type="email"
                    className={`input ${errors.email ? 'input--error' : ''}`.trim()}
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="usaha@email.com"
                    maxLength={120}
                    autoComplete="email"
                  />
                </Field>

                <Field
                  label="Alamat usaha"
                  htmlFor="address"
                  error={errors.address}
                  className="form-grid__full"
                >
                  <textarea
                    id="address"
                    className={`textarea ${errors.address ? 'textarea--error' : ''}`.trim()}
                    value={form.address}
                    onChange={(event) => updateField('address', event.target.value)}
                    placeholder="Jalan, nomor, kelurahan, kota"
                    maxLength={300}
                    rows={2}
                  />
                </Field>

                <Field
                  label="Deskripsi usaha"
                  htmlFor="description"
                  error={errors.description}
                  hint="Ceritakan singkat produk/jasa yang Anda jual. Berguna untuk analisis AI."
                  className="form-grid__full"
                >
                  <textarea
                    id="description"
                    className={`textarea ${errors.description ? 'textarea--error' : ''}`.trim()}
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    placeholder="Contoh: Menjual nasi campur dan minuman dingin, buka setiap hari pukul 08.00-21.00."
                    maxLength={600}
                    rows={3}
                  />
                </Field>

                <Field
                  label="Logo usaha"
                  htmlFor="logo"
                  className="form-grid__full"
                  hint="Opsional, maksimal 400 KB. Gambar disimpan di perangkat ini."
                >
                  <div className="logo-upload">
                    <span className="logo-preview">
                      {form.logoDataUrl ? (
                        <img src={form.logoDataUrl} alt="Logo usaha" />
                      ) : (
                        <ImagePlus size={22} aria-hidden="true" />
                      )}
                    </span>
                    <div className="row">
                      <input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        style={{ display: 'none' }}
                      />
                      <Button variant="secondary" size="sm" onClick={() => document.getElementById('logo')?.click()}>
                        Pilih gambar
                      </Button>
                      {form.logoDataUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => updateField('logoDataUrl', null)}
                        >
                          Hapus logo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Field>
              </div>

              <div className="form-actions">
                <Button type="submit" icon={Save} loading={saving}>
                  {isNew ? 'Simpan profil usaha' : 'Simpan perubahan'}
                </Button>
                <span className="form-note">Perubahan tercatat pada audit log aplikasi.</span>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="stack">
          <Card>
            <CardHeader title="Mengapa profil penting?" icon={Building2} />
            <CardBody>
              <ul className="stack" style={{ gap: 10, paddingLeft: 18, margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
                <li>Nama usaha tampil di sidebar, laporan, dan bukti transaksi.</li>
                <li>Jenis usaha menentukan rumus HPP yang dipakai pada Tahap 3.</li>
                <li>Deskripsi membantu SMART ADVISOR memahami konteks usaha Anda.</li>
                <li>Logo dipakai pada kop laporan PDF dan bukti penjualan.</li>
              </ul>
            </CardBody>
          </Card>

          <div className="alert alert--info">
            <Building2 size={17} />
            <div>
              <strong>Data tersimpan di perangkat ini.</strong>
              <p>
                Profil dan transaksi disimpan di IndexedDB browser. Jika data browser dihapus, data ikut
                hilang. Fitur backup dan pemulihan tersedia pada Tahap 7.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
