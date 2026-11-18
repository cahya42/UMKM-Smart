import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProfilePage from './pages/profile/ProfilePage'
import ProductsPage from './pages/products/ProductsPage'
import InventoryPage from './pages/inventory/InventoryPage'
import HppPage from './pages/hpp/HppPage'
import SalesPage from './pages/sales/SalesPage'
import SaleForm from './pages/sales/SaleForm'
import ExpensesPage from './pages/expenses/ExpensesPage'
import CashPage from './pages/cash/CashPage'
import ReportsPage from './pages/reports/ReportsPage'
import ContactsPage from './pages/contacts/ContactsPage'
import SettingsPage from './pages/settings/SettingsPage'
import BackupPage from './pages/backup/BackupPage'
import AdvisorPage from './pages/advisor/AdvisorPage'
import ActivationPage from './pages/activation/ActivationPage'
import { LicenseProvider, useLicense } from './services/license/LicenseContext'
import LoadingScreen from './components/ui/LoadingScreen'

/** Menahan akses ke modul usaha sampai lisensi aktif atau mode pengembangan dibuka. */
function RequireLicense() {
  const license = useLicense()

  if (license.loading) return <LoadingScreen message="Memeriksa lisensi..." />
  if (!license.unlocked) return <Navigate to="/aktivasi" replace />

  return <Outlet />
}

export default function App() {
  return (
    <LicenseProvider>
      <Routes>
        <Route path="/aktivasi" element={<ActivationPage />} />

        <Route element={<RequireLicense />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="profil" element={<ProfilePage />} />
            <Route path="pengaturan" element={<SettingsPage />} />
            <Route path="backup" element={<BackupPage />} />

            <Route path="produk" element={<ProductsPage />} />
            <Route path="persediaan" element={<InventoryPage />} />
            <Route path="hpp" element={<HppPage />} />
            <Route path="penjualan" element={<SalesPage />} />
            <Route path="penjualan/baru" element={<SaleForm />} />
            <Route path="pengeluaran" element={<ExpensesPage />} />
            <Route path="kas" element={<CashPage />} />
            <Route path="laporan" element={<ReportsPage />} />

            <Route path="pelanggan" element={<ContactsPage kind="pelanggan" />} />
            <Route path="pemasok" element={<ContactsPage kind="pemasok" />} />

            <Route path="advisor" element={<AdvisorPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </LicenseProvider>
  )
}
