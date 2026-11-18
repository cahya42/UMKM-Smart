import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const previewHost = process.env.PREVIEW_HOST

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': versi baru menunggu persetujuan pengguna, bukan langsung mengambil alih
      // saat aplikasi sedang dipakai mencatat transaksi.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'UMKM SMART - Manajemen Usaha',
        short_name: 'UMKM SMART',
        description:
          'Aplikasi manajemen usaha dan asisten konsultan AI untuk UMKM. Data usaha disimpan di perangkat.',
        lang: 'id',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7faf8',
        theme_color: '#14532d',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Hanya aset aplikasi yang dicache. Permintaan lisensi dan proxy AI tetap
        // ke jaringan agar data dan kunci tidak pernah tersimpan di cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    // Hanya host preview yang diberikan untuk mesin ini, tidak pernah wildcard.
    allowedHosts: previewHost ? [previewHost] : undefined,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
