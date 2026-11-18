import {
  BarChart3,
  Boxes,
  DatabaseBackup,
  Calculator,
  CreditCard,
  LayoutDashboard,
  Package,
  Receipt,
  Settings2,
  Sparkles,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * Menu utama aplikasi. Urutan mengikuti alur kerja usaha:
 * dashboard -> profil -> operasional -> relasi -> analisis -> pengaturan.
 *
 * `stage` menandai modul yang fiturnya baru tersedia pada tahap berikutnya,
 * supaya pengguna tidak mengira modul sudah aktif padahal belum.
 */
export const NAV_GROUPS = [
  {
    label: 'Utama',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/profil', label: 'Profil Usaha', icon: Store },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { to: '/produk', label: 'Produk', icon: Package },
      { to: '/persediaan', label: 'Persediaan', icon: Boxes },
      { to: '/hpp', label: 'Kalkulator HPP', icon: Calculator },
      { to: '/penjualan', label: 'Penjualan', icon: Receipt },
      { to: '/pengeluaran', label: 'Pengeluaran', icon: Wallet },
      { to: '/kas', label: 'Kas & Rekening', icon: CreditCard },
    ],
  },
  {
    label: 'Relasi',
    items: [
      { to: '/pelanggan', label: 'Pelanggan', icon: Users },
      { to: '/pemasok', label: 'Pemasok', icon: Truck },
    ],
  },
  {
    label: 'Analisis',
    items: [
      { to: '/laporan', label: 'Laporan Usaha', icon: BarChart3 },
      { to: '/advisor', label: 'SMART ADVISOR', icon: Sparkles },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { to: '/pengaturan', label: 'Pengaturan', icon: Settings2 },
      { to: '/backup', label: 'Backup & Data', icon: DatabaseBackup },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

/** Mencari item menu yang cocok dengan path saat ini (untuk judul topbar). */
export function findNavItem(pathname) {
  if (pathname === '/') return ALL_NAV_ITEMS[0]
  const target = ALL_NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to))
  return target ?? { label: 'UMKM SMART', to: pathname }
}
