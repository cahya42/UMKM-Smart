import { CalendarDays, Menu, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Sidebar from './Sidebar'
import { findNavItem } from './navigation'
import { useLicense } from '../services/license/LicenseContext'
import { getBusinessProfile } from '../database/repositories/businessProfileRepo'
import { formatLongDate, toDateKey } from '../utils/dates'
import Badge from '../components/ui/Badge'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const license = useLicense()
  const navItem = findNavItem(location.pathname)

  const profileData = useLiveQuery(async () => ({ profile: await getBusinessProfile() }), [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const licenseTone =
    license.status?.state === 'active'
      ? 'green'
      : license.status?.state === 'offline_grace'
        ? 'amber'
        : license.devMode
          ? 'amber'
          : 'gray'

  return (
    <div className="app-shell">
      <Sidebar
        businessName={profileData?.profile?.businessName}
        onNavigate={() => setSidebarOpen(false)}
      />

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Tutup menu navigasi"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button topbar__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu navigasi"
          >
            <Menu size={19} />
          </button>

          <div className="topbar__title">
            <p className="topbar__eyebrow">{profileData?.profile?.businessName || 'UMKM SMART'}</p>
            <h1>{navItem.label}</h1>
          </div>

          <div className="topbar__right">
            <span className="topbar__date">
              <CalendarDays size={15} aria-hidden="true" />
              {formatLongDate(toDateKey())}
            </span>
            <Badge tone={licenseTone}>{license.status?.label ?? 'Memeriksa lisensi'}</Badge>
          </div>
        </header>

        {license.devMode ? (
          <div className="dev-banner" role="status">
            <ShieldAlert size={17} aria-hidden="true" />
            <span>
              <strong>Mode pengembangan aktif.</strong> Aplikasi terbuka tanpa lisensi sah. Data yang Anda
              masukkan tetap tersimpan, tetapi mode ini bukan aktivasi resmi.
            </span>
          </div>
        ) : null}

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
