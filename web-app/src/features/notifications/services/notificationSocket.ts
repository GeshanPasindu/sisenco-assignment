import { io, type Socket } from 'socket.io-client'

export interface NotificationSocket {
  on(event: 'connect' | 'disconnect' | 'reconnect', listener: () => void): void
  on(event: 'notification.created', listener: (payload: unknown) => void): void
  off(event: string): void
  disconnect(): void
}

export function createNotificationSocket(apiBaseUrl: string, accessToken: string): NotificationSocket {
  const origin = new URL(apiBaseUrl).origin
  const socket: Socket = io(`${origin}/notifications`, {
    auth: { token: accessToken },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
    reconnectionDelayMax: 8_000,
    randomizationFactor: 0.4,
    transports: ['websocket', 'polling'],
  })
  return socket
}
