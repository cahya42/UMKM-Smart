import { CheckCircle2, KeyRound, Lock, ServerCog, ShieldCheck, Store } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { useLicense } from '../../services/license/LicenseContext'
import {
  activateLicense,
  isLicenseServerConfigured,
  isPublicKeyConfigured,
} from '../../services/license/licenseService'
import { licenseActivationSchema, toFieldErrors } from '../../utils/validation'

export default function ActivationPage() {
  const license = useLicense()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', token: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [devDialogOpen, setDevDialogOpen] = useState(false)
  const [enablingDev, setEnablingDev] = useState(false)

  const serverConfigured = isLicenseServerConfigured()
  const publicKeyConfigured = isPublicKeyConfigured()
  const canActivateOnline = serverConfigured && publicKeyConfigured

  function updateField(name, value) {
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
    setServerError('')

    const parsed = licenseActivationSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      const payload = await activateLicense(parsed.data)
      await license.refresh()
      toast.push(`Lisensi aktif untuk ${payload.email}. Aplikasi dapat dipakai offline.`)
      navigate('/', { replace: true })
    } catch (error) {
      setServerError(error?.message ?? 'Aktivasi gagal. Periksa email dan token lisensi Anda.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEnableDevMode() {
    setEnablingDev(true)
    try {
      await license.updateDevMode(true)
      setDevDialogOpen(false)
      toast.push('Mode pengembangan aktif. Aplikasi terbuka tanpa lisensi sah.', { tone: 'info' })
      navigate('/', { replace: true })
    } catch (error) {
      toast.push(error?.message ?? 'Mode pengembangan gagal diaktifkan.', { tone: 'error' })
    } finally {
      setEnablingDev(false)
    }
  }

  return (
    <div className="auth-screen">
      <aside className="auth-aside">
        <div>
          <div className="auth-brand">
            <span className="auth-brand__logo" aria-hidden="true">
              <Store size={24} />
            </span>
            <div>
              <strong>UMKM SMART</strong>
              <span>Manajemen Usaha</span>
            </div>
          </div>

          <div style={{ marginTop: 44 }}>
            <h2>Kelola usaha lebih rapi, tanpa istilah akuntansi yang rumit.</h2>
            <p>
              Aktivasi sekali, lalu aplikasi siap dipakai. Data usaha Anda tersimpan di perangkat ini, bukan
              di server kami.
            </p>

            <ul className="auth-features">
              <li>
                <CheckCircle2 size={16} />
                <span>Produk, stok, HPP, penjualan, pengeluaran, dan kas dalam satu aplikasi.</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Laporan laba rugi sederhana yang membedakan omzet, laba, dan saldo kas.</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>SMART ADVISOR membantu menganalisis data usaha dan menyusun prioritas.</span>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <span>Fungsi pencatatan tetap berjalan tanpa internet setelah aktivasi.</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="auth-aside__foot">
          Single Business Edition - satu lisensi untuk satu unit usaha pada satu perangkat.
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {license.loading ? (
            <p className="muted">Memeriksa status lisensi...</p>
          ) : license.unlocked ? (
            <>
              <h1>Aplikasi sudah aktif</h1>
              <p className="auth-card__lead">
                {license.devMode
                  ? 'Aplikasi sedang berjalan dalam mode pengembangan, bukan aktivasi resmi.'
                  : `Lisensi terpasang untuk ${license.payload?.email ?? 'email pembeli'}.`}
              </p>
              <div className="row" style={{ marginTop: 18 }}>
                <Button onClick={() => navigate('/')}>Buka dashboard</Button>
                <Link to="/pengaturan" className="btn btn--secondary">
                  Pengaturan lisensi
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1>Aktivasi UMKM SMART</h1>
              <p className="auth-card__lead">
                Masukkan email pembeli dan token lisensi yang Anda terima. Aktivasi membutuhkan internet,
                setelah itu aplikasi dapat digunakan offline.
              </p>

              {!canActivateOnline ? (
                <div className="alert alert--warning" style={{ marginTop: 16 }}>
                  <ServerCog size={17} />
                  <div>
                    <strong>Server lisensi belum dikonfigurasi.</strong>
                    <p>
                      Aplikasi ini belum memiliki <code>VITE_LICENSE_API_URL</code> dan kunci publik lisensi,
                      sehingga aktivasi online belum bisa dilakukan. Hubungi penerbit aplikasi.
                    </p>
                  </div>
                </div>
              ) : null}

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                <Field label="Email pembeli" htmlFor="email" required error={errors.email}>
                  <input
                    id="email"
                    type="email"
                    className={`input ${errors.email ? 'input--error' : ''}`.trim()}
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="email@contoh.com"
                    autoComplete="email"
                    maxLength={120}
                  />
                </Field>

                <Field
                  label="Token lisensi"
                  htmlFor="token"
                  required
                  error={errors.token}
                  hint="Token dikirim penerbit setelah pembelian. Jangan bagikan token Anda."
                >
                  <input
                    id="token"
                    className={`input ${errors.token ? 'input--error' : ''}`.trim()}
                    value={form.token}
                    onChange={(event) => updateField('token', event.target.value)}
                    placeholder="UMKM-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={200}
                  />
                </Field>

                {serverError ? (
                  <div className="alert alert--danger" role="alert">
                    <Lock size={17} />
                    <div>
                      <strong>Aktivasi tidak berhasil.</strong>
                      <p>{serverError}</p>
                    </div>
                  </div>
                ) : null}

                <Button type="submit" icon={KeyRound} loading={submitting} disabled={!canActivateOnline}>
                  Aktifkan lisensi
                </Button>
              </form>

              <p className="auth-footnote">
                <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                Server lisensi hanya menyimpan data lisensi dan aktivasi perangkat. Data transaksi usaha tidak
                pernah dikirim ke server lisensi. Bukti aktivasi ditandatangani digital dan diverifikasi
                aplikasi menggunakan kunci publik; private key hanya ada di server.
              </p>

              <div className="auth-dev">
                <h3>Mode pengembangan (bukan aktivasi)</h3>
                <p>
                  Untuk pengujian sebelum server lisensi siap. Aplikasi terbuka tanpa lisensi sah dan
                  menampilkan penanda mode pengembangan.
                </p>
                <Button variant="secondary" size="sm" onClick={() => setDevDialogOpen(true)}>
                  Aktifkan mode pengembangan
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={devDialogOpen}
        title="Aktifkan mode pengembangan?"
        description="Mode ini membuka seluruh aplikasi tanpa lisensi sah dan hanya untuk pengembangan serta pengujian. Jangan gunakan untuk usaha sungguhan sebelum lisensi diaktifkan. Data yang Anda masukkan tetap tersimpan di perangkat ini."
        confirmLabel="Ya, aktifkan"
        tone="primary"
        loading={enablingDev}
        onConfirm={handleEnableDevMode}
        onCancel={() => setDevDialogOpen(false)}
      />
    </div>
  )
}
