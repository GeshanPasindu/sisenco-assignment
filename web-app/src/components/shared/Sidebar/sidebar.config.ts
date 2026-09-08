import type { RoleCode } from '../../../features/auth/types/auth.types'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'

export interface SidebarItemConfig { id: string; label: string; path: string; requiredRoles?: RoleCode[]; anyPermissions?: string[]; allPermissions?: string[]; end?: boolean }
export const sidebarConfig: SidebarItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', path: ROUTES.dashboard, anyPermissions: [PERMISSIONS.dashboardReadOwn, PERMISSIONS.dashboardReadTeam], end: true },
  { id: 'reports', label: 'Reports', path: ROUTES.reports, anyPermissions: [PERMISSIONS.reportReadOwn, PERMISSIONS.reportReadTeam] },
  { id: 'tasks', label: 'Tasks', path: ROUTES.tasks, anyPermissions: [PERMISSIONS.taskReadOwn, PERMISSIONS.taskManageTeam] },
  { id: 'projects', label: 'Projects', path: ROUTES.projects, allPermissions: [PERMISSIONS.projectRead] },
  { id: 'users', label: 'Users', path: ROUTES.users, requiredRoles: ['MANAGER_ADMIN'], allPermissions: [PERMISSIONS.userReadTeam] },
  { id: 'notifications', label: 'Notifications', path: ROUTES.notifications, allPermissions: [PERMISSIONS.notificationReadOwn] },
]

export function getVisibleSidebarItems(role: RoleCode | undefined, permissions: readonly string[], items = sidebarConfig) {
  return items.filter((item) =>
    (!item.requiredRoles || (role !== undefined && item.requiredRoles.includes(role))) &&
    (!item.allPermissions || item.allPermissions.every((code) => permissions.includes(code))) &&
    (!item.anyPermissions || item.anyPermissions.some((code) => permissions.includes(code))),
  )
}
