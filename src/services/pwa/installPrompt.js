/**
 * Menyimpan event `beforeinstallprompt` yang dikirim browser sekali saat aplikasi
 * memenuhi syarat pemasangan. Event ini harus ditangkap sedini mungkin (impor di
 * main.jsx) agar tidak hilang sebelum halaman Pengaturan dibuka.
 */
const listeners = new Set()
let deferredPrompt = null
let installed = false

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  const standaloneQuery = window.matchMedia?.('(display-mode: standalone)')
  const minimalQuery = window.matchMedia?.('(display-mode: minimal-ui)')
  return Boolean(standaloneQuery?.matches || minimalQuery?.matches || window.navigator.standalone === true)
}

function buildState() {
  const standalone = isStandaloneMode()
  return {
    canInstall: Boolean(deferredPrompt) && !standalone,
    installed: installed || standalone,
  }
}

let current = buildState()

function emit() {
  current = buildState()
  listeners.forEach((listener) => listener(current))
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Tahan dialog bawaan browser; pengguna memulai pemasangan dari tombol aplikasi.
    event.preventDefault?.()
    deferredPrompt = event
    installed = false
    emit()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    emit()
  })

  const standaloneQuery = window.matchMedia?.('(display-mode: standalone)')
  standaloneQuery?.addEventListener?.('change', emit)
}

export function getInstallState() {
  return current
}

export function subscribeInstallState(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Menampilkan dialog pemasangan bawaan browser.
 * @returns {Promise<'accepted'|'dismissed'|'unavailable'|'error'>}
 */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable'

  const promptEvent = deferredPrompt
  deferredPrompt = null

  try {
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice?.outcome === 'accepted') installed = true
    return choice?.outcome ?? 'error'
  } catch {
    return 'error'
  } finally {
    emit()
  }
}
