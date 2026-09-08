import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { AuthBootstrap } from '../features/auth/components/AuthBootstrap'
import { NotificationsProvider } from '../features/notifications/providers/NotificationsProvider'
import { store } from './store'

export function AppProviders({ router }: { router: Parameters<typeof RouterProvider>[0]['router'] }) {
  return (
    <Provider store={store}>
      <AuthBootstrap>
        <NotificationsProvider>
          <RouterProvider router={router} />
        </NotificationsProvider>
      </AuthBootstrap>
    </Provider>
  )
}
