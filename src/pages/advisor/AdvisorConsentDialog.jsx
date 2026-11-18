import { Cpu, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { ADVISOR_EXCLUDED_DATA } from '../../services/ai/advisorContext'

/**
 * Dialog persetujuan sebelum ringkasan dikirim.
 * Pengguna melihat seluruh teks yang akan dikirim, daftar data yang tidak
 * pernah disertakan, lalu menyatakan setuju secara eksplisit.
 */
export default function AdvisorConsentDialog({
  open,
  context,
  question,
  external,
  provider,
  model,
  loading,
  onCancel,
  onConfirm,
}) {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (open) setChecked(false)
  }, [open, question])

  if (!open || !context) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!loading) onCancel?.()
      }}
    >
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Persetujuan kirim ringkasan"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h3>{external ? 'Kirim ringkasan ini ke layanan AI?' : 'Buat analisis lokal dari ringkasan ini?'}</h3>
            <p>
              {external
                ? `Ringkasan akan dikirim ke ${provider} (${model}) melalui proxy AI. Periksa isinya lebih dulu.`
                : 'Layanan AI belum terhubung, jadi tidak ada data yang dikirim. Analisis dihitung di perangkat ini.'}
            </p>
          </div>
          <span className="advisor-consent__icon" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
        </div>

        <div className="modal__content">
          <div className={`alert ${external ? 'alert--warning' : 'alert--info'}`}>
            <ShieldCheck size={17} />
            <div>
              <strong>
                {external
                  ? 'Data meninggalkan perangkat ini hanya setelah Anda menyetujui'
                  : 'Tidak ada data yang meninggalkan perangkat'}
              </strong>
              <p>
                {external
                  ? 'Hanya ringkasan angka di bawah yang dikirim. Isi database, kontak pelanggan, dan kredensial tidak disertakan.'
                  : 'Analisis lokal memakai angka yang sama tanpa memanggil layanan luar.'}
              </p>
            </div>
          </div>

          <h4 className="modal__section-title">Pertanyaan</h4>
          <p className="advisor-consent__question">{question}</p>

          <h4 className="modal__section-title">Ringkasan yang disertakan</h4>
          <ul className="advisor-consent__list">
            {context.counts.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>{item.detail}</strong>
              </li>
            ))}
          </ul>

          <h4 className="modal__section-title">Tidak pernah dikirim</h4>
          <ul className="advisor-consent__excluded">
            {ADVISOR_EXCLUDED_DATA.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h4 className="modal__section-title">Pratinjau lengkap ({context.text.length} karakter)</h4>
          <pre className="advisor-preview">{context.text}</pre>

          {external ? (
            <label className="check-row">
              <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
              <span>
                Saya sudah membaca seluruh pratinjau dan setuju mengirimkannya ke {provider} melalui proxy AI.
              </span>
            </label>
          ) : (
            <p className="form-note">
              Persetujuan ini hanya untuk analisis lokal. Tidak ada permintaan jaringan yang dibuat.
            </p>
          )}
        </div>

        <div className="modal__actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
          <Button
            icon={external ? Send : Cpu}
            loading={loading}
            disabled={external && !checked}
            onClick={onConfirm}
          >
            {external ? 'Setujui & kirim' : 'Buat analisis lokal'}
          </Button>
        </div>
      </div>
    </div>
  )
}
