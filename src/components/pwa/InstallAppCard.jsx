import { CheckCircle2, Download, MonitorSmartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import { Card, CardBody, CardHeader } from '../ui/Card'
import { useToast } from '../ui/Toast'
import { getInstallState, promptInstall, subscribeInstallState } from '../../services/pwa/installPrompt'

const MANUAL_STEPS = [
  {
    title: 'Chrome atau Edge di komputer',
    steps: [
      'Buka menu browser (ikon tiga titik atau tiga garis di kanan atas).',
      'Pilih "Pasang UMKM SMART" atau "Aplikasi" lalu "Pasang situs ini".',
      'Konfirmasi "Pasang"; aplikasi muncul sebagai jendela sendiri dan ikon di desktop.',
    ],
  },
  {
    title: 'Chrome di Android',
    steps: [
      'Buka menu tiga titik di kanan atas.',
      'Pilih "Tambahkan ke layar utama" atau "Pasang aplikasi".',
      'Ketuk "Pasang"; ikon UMKM SMART muncul di layar utama.',
    ],
  },
  {
    title: 'Safari di iPhone atau iPad',
    steps: [
      'Ketuk tombol Bagikan di bagian bawah layar.',
      'Pilih "Tambahkan ke Layar Utama".',
      'Ketuk "Tambah"; UMKM SMART terbuka dari ikon di layar utama.',
    ],
  },
]

/** Panduan manual saat browser tidak menawarkan pemasangan otomatis. */
function InstallGuideDialog({ open, installed, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Panduan memasang aplikasi"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{installed ? 'Aplikasi sudah terpasang' : 'Pasang aplikasi secara manual'}</h3>
        <p>
          {installed
            ? 'UMKM SMART sudah berjalan sebagai aplikasi terpasang. Jika ingin memasangnya di perangkat lain, ikuti langkah sesuai browser yang dipakai.'
            : 'Browser ini belum menawarkan pemasangan otomatis. Ikuti langkah sesuai browser yang Anda pakai.'}
        </p>
        <div className="install-guide">
          {MANUAL_STEPS.map((group) => (
            <div className="install-guide__group" key={group.title}>
              <h4>{group.title}</h4>
              <ol>
                {group.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="install-guide__note">
          Data usaha tetap tersimpan di browser perangkat ini, baik dibuka dari tab biasa maupun sebagai aplikasi.
        </p>
        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Tombol "Pasang aplikasi": memakai event beforeinstallprompt bila tersedia,
 * dan menampilkan panduan manual bila event itu tidak ada atau aplikasi sudah terpasang.
 */
export default function InstallAppCard() {
  const toast = useToast()
  const [installState, setInstallState] = useState(getInstallState)
  const [guideOpen, setGuideOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => subscribeInstallState(setInstallState), [])

  async function handleInstall() {
    if (!installState.canInstall) {
      setGuideOpen(true)
      return
    }

    setInstalling(true)
    try {
      const outcome = await promptInstall()
      if (outcome === 'accepted') {
        toast.push('Aplikasi sedang dipasang. Ikon UMKM SMART akan muncul di perangkat ini.', { tone: 'success' })
      } else if (outcome === 'error' || outcome === 'unavailable') {
        toast.push('Browser tidak menyelesaikan pemasangan. Ikuti panduan manual berikut.', { tone: 'info' })
        setGuideOpen(true)
      }
    } finally {
      setInstalling(false)
    }
  }

  const statusText = installState.installed
    ? 'Aplikasi sudah terpasang di perangkat ini dan bisa dibuka dari ikonnya.'
    : installState.canInstall
      ? 'Browser ini mendukung pemasangan langsung. Aplikasi terbuka di jendela sendiri dan data tetap tersimpan di perangkat.'
      : 'Browser ini belum menawarkan pemasangan otomatis. Tombol di samping menampilkan panduan manual sesuai browser.'

  return (
    <>
      <Card>
        <CardHeader
          title="Pasang aplikasi"
          subtitle="Akses lebih cepat tanpa membuka browser"
          icon={MonitorSmartphone}
          action={
            installState.installed ? (
              <span className="badge badge--green">
                <CheckCircle2 size={14} aria-hidden="true" />
                Terpasang
              </span>
            ) : null
          }
        />
        <CardBody>
          <p>{statusText}</p>
          <div className="row" style={{ marginTop: 14 }}>
            <Button icon={Download} loading={installing} onClick={handleInstall}>
              Pasang aplikasi
            </Button>
            {installState.canInstall ? (
              <Button variant="ghost" onClick={() => setGuideOpen(true)}>
                Panduan pemasangan
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <InstallGuideDialog
        open={guideOpen}
        installed={installState.installed}
        onClose={() => setGuideOpen(false)}
      />
    </>
  )
}
