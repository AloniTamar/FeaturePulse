import { useCallback, useRef, useEffect, useState } from 'react'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type CronState = 'idle' | 'loading' | 'ok' | 'error'

export function useCron(_appId: string) {
  const [cronState, setCronState] = useState<CronState>('idle')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const runCron = useCallback(async () => {
    if (cronState === 'loading') return
    setCronState('loading')
    const token = localStorage.getItem('fp_token')
    try {
      const res = await fetch(`${BASE}/api/v1/cron`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error('failed')
      setCronState('ok')
    } catch {
      setCronState('error')
    } finally {
      setTimeout(() => { if (mountedRef.current) setCronState('idle') }, 3000)
    }
  }, [cronState])

  return { cronState, runCron }
}
