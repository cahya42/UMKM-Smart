import { NavLink } from 'react-router-dom'
import { Store } from 'lucide-react'
import { NAV_GROUPS } from './navigation'
import { APP_VERSION } from '../services/license/constants'

export default function Sidebar({ businessName, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">
          <Store size={22} />
        </span>
        <div className="sidebar__brand-text">
          <strong>UMKM SMART</strong>
          <span>Manajemen Usaha</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Menu utama">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-group__label">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`.trim()}
                  title={item.stage ? `Tersedia pada Tahap ${item.stage}` : item.label}
                >
                  <Icon size={17} className="nav-link__icon" aria-hidden="true" />
                  <span className="nav-link__label">{item.label}</span>
                  {item.stage ? <span className="nav-link__stage">T{item.stage}</span> : null}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__license">
          <Store size={15} aria-hidden="true" />
          <div>
            <small>Usaha</small>
            <span>{businessName || 'Profil belum diisi'}</span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
          <span>Versi {APP_VERSION}</span>
          <span>Single Business Edition</span>
        </div>
      </div>
    </aside>
  )
}
