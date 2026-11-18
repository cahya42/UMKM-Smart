import { Loader2, Store } from 'lucide-react'

export default function LoadingScreen({ message = 'Menyiapkan aplikasi...' }) {
  return (
    <div className="splash" role="status">
      <span className="splash__logo" aria-hidden="true">
        <Store size={26} />
      </span>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>UMKM SMART</p>
      <Loader2 className="splash__spinner" size={20} aria-hidden="true" />
      <p style={{ fontSize: 13 }}>{message}</p>
    </div>
  )
}
