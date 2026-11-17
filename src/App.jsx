import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProfilePage from './pages/profile/ProfilePage'
import ProductsPage from './pages/products/ProductsPage'
import InventoryPage from './pages/inventory/InventoryPage'
import SettingsPage from './pages/settings/SettingsPage'
import ActivationPage from './pages/activation/ActivationPage'
import ComingSoonPage from './pages/ComingSoonPage'
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

            <Route path="produk" element={<ProductsPage />} />
            <Route path="persediaan" element={<InventoryPage />} />

            {/* Modul tahap berikutnya: navigasi dan tabel sudah siap, fitur menyusul. */}
            <Route
              path="hpp"
              element={
                <ComingSoonPage
                  title="Kalkulator HPP"
                  stage={3}
                  description="Hitung HPP per unit untuk usaha produksi, perdagangan, dan jasa, lengkap dengan simulasi harga jual dan margin."
                />
              }
            />
            <Route
              path="penjualan"
              element={
                <ComingSoonPage
                  title="Penjualan"
                  stage={4}
                  description="Catat transaksi penjualan, kurangi stok otomatis, dan terima kas pada akun yang dipilih."
                />
              }
            />
            <Route
              path="pengeluaran"
              element={
                <ComingSoonPage
                  title="Pengeluaran Usaha"
                  stage={4}
                  description="Catat biaya operasional dengan kategori, sumber kas, keterangan, dan bukti transaksi."
                />
              }
            />
            <Route
              path="kas"
              element={
                <ComingSoonPage
                  title="Kas & Rekening"
                  stage={5}
                  description="Kelola akun tunai, rekening bank, dan e-wallet, termasuk transfer antarakun dan riwayat mutasi."
                />
              }
            />
            <Route
              path="pelanggan"
              element={
                <ComingSoonPage
                  title="Pelanggan"
                  stage={4}
                  description="Simpan kontak pelanggan untuk kebutuhan transaksi dan analisis pelanggan."
                />
              }
            />
            <Route
              path="pemasok"
              element={
                <ComingSoonPage
                  title="Pemasok"
                  stage={4}
                  description="Simpan kontak pemasok beserta jenis barang atau jasa yang dipasok."
                />
              }
            />
            <Route
              path="laporan"
              element={
                <ComingSoonPage
                  title="Laporan Usaha"
                  stage={5}
                  description="Laporan penjualan, pengeluaran, laba rugi sederhana, arus kas, persediaan, HPP, dan produk terlaris dengan ekspor Excel/PDF."
                />
              }
            />
            <Route
              path="advisor"
              element={
                <ComingSoonPage
                  title="SMART ADVISOR"
                  stage={6}
                  description="Asisten konsultasi usaha berbasis AI yang menganalisis ringkasan data usaha Anda dan menyusun prioritas tindakan."
                />
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </LicenseProvider>
  )
}
