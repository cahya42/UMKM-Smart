import { Construction } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../components/ui/Badge'

export default function ComingSoonPage({ title, stage, description }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon__card">
        <span className="coming-soon__icon" aria-hidden="true">
          <Construction size={26} />
        </span>
        <div className="row" style={{ justifyContent: 'center', marginBottom: 10 }}>
          <Badge tone="amber">Belum aktif - Tahap {stage}</Badge>
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <p style={{ marginTop: 12 }}>
          Menu ini sudah tersedia pada navigasi dan tabel database-nya sudah disiapkan, tetapi fungsinya
          dibangun pada Tahap {stage}. Aplikasi tidak menampilkan data palsu.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
          <Link to="/" className="btn btn--secondary">
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
