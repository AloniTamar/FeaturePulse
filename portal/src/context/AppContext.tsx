import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { api, type AppSummary } from '../api/client'

interface AppContextValue {
  apps: AppSummary[]
  activeApp: AppSummary | undefined
  reloadApps: () => Promise<void>
}

const AppContext = createContext<AppContextValue>({
  apps: [],
  activeApp: undefined,
  reloadApps: async () => {},
})

export function AppProvider({ children }: { children: ReactNode }) {
  const { appId } = useParams<{ appId?: string }>()
  const [apps, setApps] = useState<AppSummary[]>([])

  async function reloadApps() {
    try { setApps(await api.listApps()) } catch {}
  }

  useEffect(() => { reloadApps() }, [])

  useEffect(() => {
    if (appId) localStorage.setItem('fp_last_app_id', appId)
  }, [appId])

  const activeApp = apps.find(a => a.id === appId)

  return (
    <AppContext.Provider value={{ apps, activeApp, reloadApps }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
