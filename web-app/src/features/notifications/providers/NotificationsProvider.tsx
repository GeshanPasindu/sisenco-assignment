/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch } from '../../../app/hooks'
import { env } from '../../../config/env'
import { useAuth } from '../../auth/hooks/useAuth'
import { notificationsApi } from '../api/notificationsApi'
import { dashboardApi } from '../../dashboard/api/dashboardApi'
import { createNotificationSocket, type NotificationSocket } from '../services/notificationSocket'
import type { NotificationDto } from '../types/notification.types'

export type NotificationConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING'
const NotificationsContext = createContext<NotificationConnectionStatus>('DISCONNECTED')

function isNotification(value: unknown): value is NotificationDto {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.type === 'string' && typeof item.title === 'string' && typeof item.message === 'string' && typeof item.createdAt === 'string' && (item.readAt === null || typeof item.readAt === 'string') && typeof item.actor === 'object' && item.actor !== null
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, accessToken } = useAuth()
  const dispatch = useAppDispatch()
  const socketRef = useRef<NotificationSocket | null>(null)
  const [status, setStatus] = useState<NotificationConnectionStatus>('DISCONNECTED')

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setStatus('DISCONNECTED')
      return
    }

    setStatus('CONNECTING')
    const socket = createNotificationSocket(env.apiBaseUrl, accessToken)
    socketRef.current = socket
    const reconcile = () => {
      dispatch(notificationsApi.util.invalidateTags([{ type: 'UnreadNotifications', id: 'COUNT' }, { type: 'Notifications', id: 'LIST' }]))
    }
    const onNotification = (payload: unknown) => {
      if (!isNotification(payload)) return
      dispatch(notificationsApi.util.updateQueryData('getNotifications', { page: 1, pageSize: 5, readStatus: 'all' }, (draft) => {
        if (draft.data.data.some((item) => item.id === payload.id)) return
        draft.data.data.unshift(payload)
        draft.data.data.splice(5)
        draft.data.pagination.total += 1
        draft.data.pagination.hasMore = draft.data.pagination.totalPages > 1
      }))
      dispatch(notificationsApi.util.invalidateTags([{ type: 'UnreadNotifications', id: 'COUNT' }, { type: 'Notifications', id: 'LIST' }]))
      if (['REPORT_SUBMITTED', 'REPORT_RESUBMITTED', 'REPORT_APPROVED', 'REPORT_NEEDS_CORRECTION'].includes(payload.type)) {
        dispatch(dashboardApi.util.invalidateTags([{ type: 'Dashboard', id: 'CURRENT' }, { type: 'DashboardActivity', id: 'LIST' }]))
      }
    }
    socket.on('connect', () => { setStatus('CONNECTED'); reconcile() })
    socket.on('reconnect', () => { setStatus('CONNECTED'); reconcile() })
    socket.on('disconnect', () => setStatus('RECONNECTING'))
    socket.on('notification.created', onNotification)
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') reconcile()
    }
    const refreshTimer = window.setInterval(reconcile, 15_000)
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      socket.off('connect'); socket.off('reconnect'); socket.off('disconnect'); socket.off('notification.created')
      socket.disconnect()
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [accessToken, dispatch, isAuthenticated])

  const value = useMemo(() => status, [status])
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotificationsConnection() { return useContext(NotificationsContext) }
