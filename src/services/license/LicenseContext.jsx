import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { enableDevMode, getLicenseStatus } from './licenseService'

const LicenseContext = createContext(null)

const INITIAL_STATE = {
  loading: true,
  unlocked: false,
  devMode: false,
  status: null,
  payload: null,
  record: null,
  error: null,
}

export function LicenseProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE)

  const refresh = useCallback(async () => {
    try {
      const snapshot = await getLicenseStatus()
      setState({ loading: false, ...snapshot })
      return snapshot
    } catch (error) {
      setState({
        ...INITIAL_STATE,
        loading: false,
        status: { state: 'error', label: 'Status lisensi tidak dapat dibaca' },
        error: error?.message ?? 'Status lisensi tidak dapat dibaca.',
      })
      return null
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateDevMode = useCallback(
    async (enabled) => {
      await enableDevMode(enabled)
      return refresh()
    },
    [refresh],
  )

  const value = useMemo(
    () => ({ ...state, refresh, updateDevMode }),
    [state, refresh, updateDevMode],
  )

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
}

export function useLicense() {
  const context = useContext(LicenseContext)
  if (!context) throw new Error('useLicense harus dipakai di dalam LicenseProvider')
  return context
}
