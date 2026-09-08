import { describe, expect, it } from 'vitest'
import { getVisibleSidebarItems, sidebarConfig } from './sidebar.config'

describe('sidebar configuration', () => {
  it('shows users only to managers with the team-user permission', () => {
    expect(getVisibleSidebarItems('TEAM_MEMBER', ['user:read_team'], sidebarConfig).some((item) => item.id === 'users')).toBe(false)
    expect(getVisibleSidebarItems('MANAGER_ADMIN', [], sidebarConfig).some((item) => item.id === 'users')).toBe(false)
    expect(getVisibleSidebarItems('MANAGER_ADMIN', ['user:read_team'], sidebarConfig).some((item) => item.id === 'users')).toBe(true)
  })

  it('requires the configured feature permissions', () => {
    expect(getVisibleSidebarItems('TEAM_MEMBER', ['notification:read_own'], sidebarConfig).map((item) => item.id)).toEqual(['notifications'])
  })
})
