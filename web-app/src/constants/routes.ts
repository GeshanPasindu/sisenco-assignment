export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  reports: '/reports',
  tasks: '/tasks',
  projects: '/projects',
  users: '/users',
  notifications: '/notifications',
  profile: '/profile',
  changePassword: '/change-password',
  login: '/login',
} as const

export const PAGE_TITLES: Record<string, string> = {
  [ROUTES.home]: 'Dashboard',
  [ROUTES.dashboard]: 'Dashboard',
  [ROUTES.reports]: 'Reports',
  [ROUTES.tasks]: 'Tasks',
  [ROUTES.projects]: 'Projects',
  [ROUTES.users]: 'Users',
  [ROUTES.notifications]: 'Notifications',
  [ROUTES.profile]: 'My profile',
  [ROUTES.changePassword]: 'Change password',
}
