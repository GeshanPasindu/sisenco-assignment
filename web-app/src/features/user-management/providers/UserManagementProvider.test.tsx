import { act, cleanup, renderHook } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserManagementProvider, useUserManagement } from './UserManagementProvider'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('user-management pagination', () => {
  it('keeps the selected page after the search debounce and resets it when the search changes', () => {
    vi.useFakeTimers()

    const { result, rerender } = renderHook(({ search }) => {
      const state = useUserManagement()
      const { setQ } = state

      useEffect(() => {
        const timer = window.setTimeout(() => setQ(search), 300)
        return () => window.clearTimeout(timer)
      }, [search, setQ])

      return state
    }, { initialProps: { search: '' }, wrapper: UserManagementProvider })

    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.setPage(3))
    act(() => vi.advanceTimersByTime(300))

    expect(result.current.page).toBe(3)

    rerender({ search: 'Alex' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current.page).toBe(3)
    act(() => vi.advanceTimersByTime(1))

    expect(result.current.page).toBe(1)
    expect(result.current.q).toBe('Alex')
  })
})
