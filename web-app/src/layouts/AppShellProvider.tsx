/* eslint-disable react-refresh/only-export-components */
import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react'

interface AppShellContextValue {
  isSidebarCollapsed: boolean
  isMobileSidebarOpen: boolean
  toggleSidebar(): void
  openMobileSidebar(): void
  closeMobileSidebar(): void
}

const AppShellContext = createContext<AppShellContextValue | null>(null)

export function AppShellProvider({ children }: PropsWithChildren) {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const value = useMemo(() => ({
    isSidebarCollapsed, isMobileSidebarOpen,
    toggleSidebar: () => setSidebarCollapsed((current) => !current),
    openMobileSidebar: () => setMobileSidebarOpen(true),
    closeMobileSidebar: () => setMobileSidebarOpen(false),
  }), [isMobileSidebarOpen, isSidebarCollapsed])
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  const value = useContext(AppShellContext)
  if (!value) throw new Error('useAppShell must be used inside AppShellProvider.')
  return value
}
