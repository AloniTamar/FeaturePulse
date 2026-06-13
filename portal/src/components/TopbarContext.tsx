import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface TopbarCtx {
  actions: ReactNode
  setActions: (a: ReactNode) => void
}

const Ctx = createContext<TopbarCtx>({ actions: null, setActions: () => {} })

export function TopbarProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null)
  const setActions = useCallback((a: ReactNode) => setActionsState(a), [])
  return <Ctx.Provider value={{ actions, setActions }}>{children}</Ctx.Provider>
}

export function useTopbar() {
  return useContext(Ctx)
}
