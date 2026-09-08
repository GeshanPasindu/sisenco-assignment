/* eslint-disable react-refresh/only-export-components */
import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react'
import type { AccountStatus, RoleCode } from '../../auth/types/auth.types'

interface UserManagementContextValue { q: string; roleCode?: RoleCode; accountStatus?: AccountStatus; page: number; selectedUserId: string | null; createOpen: boolean; setQ(value: string): void; setRoleCode(value?: RoleCode): void; setAccountStatus(value?: AccountStatus): void; setPage(value: number): void; selectUser(id: string | null): void; setCreateOpen(value: boolean): void }
const Context = createContext<UserManagementContextValue | null>(null)
export function UserManagementProvider({ children }: PropsWithChildren) {
  const [q, setQState] = useState(''); const [roleCode, setRoleCodeState] = useState<RoleCode>(); const [accountStatus, setAccountStatusState] = useState<AccountStatus>(); const [page, setPage] = useState(1); const [selectedUserId, selectUser] = useState<string | null>(null); const [createOpen, setCreateOpen] = useState(false)
  const setQ = useCallback((value: string) => { setQState(value); setPage(1) }, [])
  const value = useMemo(() => ({ q, roleCode, accountStatus, page, selectedUserId, createOpen, setQ, setRoleCode: (value?: RoleCode) => { setRoleCodeState(value); setPage(1) }, setAccountStatus: (value?: AccountStatus) => { setAccountStatusState(value); setPage(1) }, setPage, selectUser, setCreateOpen }), [accountStatus, createOpen, page, q, roleCode, selectedUserId, setQ])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useUserManagement() { const value = useContext(Context); if (!value) throw new Error('useUserManagement must be used inside UserManagementProvider.'); return value }
