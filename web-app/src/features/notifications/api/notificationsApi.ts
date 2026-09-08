import { baseApi } from '../../../services/api/baseApi'
import type { PaginatedResponse, SuccessResponse } from '../../../services/api/api.types'
import type { NotificationDto, NotificationsQuery, ReadAllDto, UnreadCountDto } from '../types/notification.types'

const notificationTags = [{ type: 'Notifications' as const, id: 'LIST' }]

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<PaginatedResponse<NotificationDto>, NotificationsQuery>({
      query: ({ page = 1, pageSize = 20, readStatus = 'all' }) => ({ url: '/notifications', params: { page, pageSize, readStatus } }),
      providesTags: (result) => result ? [...result.data.data.map(({ id }) => ({ type: 'Notifications' as const, id })), ...notificationTags] : notificationTags,
    }),
    getUnreadCount: builder.query<SuccessResponse<UnreadCountDto>, void>({
      query: () => '/notifications/unread-count',
      providesTags: [{ type: 'UnreadNotifications', id: 'COUNT' }],
    }),
    markNotificationRead: builder.mutation<SuccessResponse<NotificationDto>, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      async onQueryStarted(id, { dispatch, queryFulfilled, getState }) {
        const patches = baseApi.util.selectInvalidatedBy(getState(), notificationTags).flatMap(({ endpointName, originalArgs }) =>
          endpointName === 'getNotifications'
            ? [dispatch(notificationsApi.util.updateQueryData('getNotifications', originalArgs as NotificationsQuery, (draft) => {
                const item = draft.data.data.find((notification) => notification.id === id)
                if (item && item.readAt === null) item.readAt = new Date().toISOString()
              }))]
            : [],
        )
        const countPatch = dispatch(notificationsApi.util.updateQueryData('getUnreadCount', undefined, (draft) => {
          if (draft.data.count > 0) draft.data.count -= 1
        }))
        try { await queryFulfilled } catch { patches.forEach((patch) => patch.undo()); countPatch.undo() }
      },
      invalidatesTags: (_result, error) => error ? [] : [{ type: 'UnreadNotifications', id: 'COUNT' }],
    }),
    markAllNotificationsRead: builder.mutation<SuccessResponse<ReadAllDto>, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: [{ type: 'Notifications', id: 'LIST' }, { type: 'UnreadNotifications', id: 'COUNT' }],
    }),
  }),
})

export const { useGetNotificationsQuery, useGetUnreadCountQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } = notificationsApi
