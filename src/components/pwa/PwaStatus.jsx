import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Indikator status aplikasi web:
 * - Offline: mengingatkan bahwa pencatatan tetap berjalan dan tersimpan lokal.
 * - Pembaruan: service worker versi baru menunggu; pengguna memilih kapan memuat ulang.
 * - Siap offline: konfirmasi sekali setelah aset selesai disimpan untuk pemakaian offline.
 */
export default function PwaStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [showReady, setShowReady] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Periksa versi baru setiap jam selama aplikasi terbuka.
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!offlineReady) return undefined
    setShowReady(true)
    const timer = setTimeout(() => {
      setShowReady(false)
      setOfflineReady(false)
    }, 6000)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  if (!online) {
    return (
      <div className="pwa-stack">
        <div className="pwa-pill pwa-pill--offline" role="status">
          <WifiOff size={15} aria-hidden="true" />
          <span>
            <strong>Mode offline.</strong> Pencatatan tetap berjalan dan tersimpan di perangkat ini.
          </span>
        </div>
      </div>
    )
  }

  if (needRefresh) {
    return (
      <div className="pwa-stack">
        <div className="pwa-card" role="status" aria-live="polite">
          <div className="pwa-card__body">
            <span className="pwa-card__icon">
              <Download size={17} aria-hidden="true" />
            </span>
            <div>
              <p className="pwa-card__title">Versi baru tersedia</p>
              <p className="pwa-card__text">
                Muat ulang untuk memakai versi terbaru. Data usaha Anda tidak terpengaruh.
              </p>
            </div>
          </div>
          <div className="pwa-card__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => updateServiceWorker(true)}>
              <RefreshCw size={14} aria-hidden="true" />
              Muat ulang
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setNeedRefresh(false)}>
              Nanti
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!showReady) return null

  return (
    <div className="pwa-stack">
      <div className="pwa-pill pwa-pill--ready" role="status">
        <Download size={15} aria-hidden="true" />
        <span>Aplikasi siap dipakai offline.</span>
        <button
          type="button"
          className="pwa-pill__close"
          aria-label="Tutup pemberitahuan"
          onClick={() => {
            setShowReady(false)
            setOfflineReady(false)
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
