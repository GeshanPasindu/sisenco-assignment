import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Header } from './Header'

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))

vi.mock('../../../layouts/AppShellProvider', () => ({
  useAppShell: () => ({ openMobileSidebar: vi.fn(), toggleSidebar: vi.fn() }),
}))

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'ada@example.com',
      role: { name: 'Administrator' },
    },
    hasPermission: () => false,
  }),
}))

vi.mock('../../../features/auth/hooks/useLogout', () => ({
  useLogout: () => ({ signOut, isLoggingOut: false }),
}))

vi.mock('../../../features/notifications/api/notificationsApi', () => ({
  useGetNotificationsQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useGetUnreadCountQuery: () => ({ data: undefined }),
  useMarkNotificationReadMutation: () => [vi.fn()],
  useMarkAllNotificationsReadMutation: () => [vi.fn(), { isLoading: false }],
}))

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
      <CurrentPath />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Header profile menu', () => {
  it('navigates to profile when the inactive notification menu is mounted', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/profile')
  })

  it('runs sign out when the inactive notification menu is mounted', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(signOut).toHaveBeenCalledOnce()
  })
})
