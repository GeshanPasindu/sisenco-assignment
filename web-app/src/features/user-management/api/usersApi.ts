import { baseApi } from '../../../services/api/baseApi'
import type { PaginatedResponse, SuccessResponse } from '../../../services/api/api.types'
import type { RoleDto } from '../../auth/types/auth.types'
import type { CreateUserRequest, InvitationDto, ReportingPeriodDto, ReportingScheduleRequest, UpdateUserRequest, UserDetailDto, UserListItemDto, UsersQuery } from '../types/user.types'

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<SuccessResponse<RoleDto[]>, void>({ query: () => '/roles', providesTags: [{ type: 'Roles', id: 'LIST' }] }),
    getUsers: builder.query<PaginatedResponse<UserListItemDto>, UsersQuery>({
      query: ({ page, pageSize, q, roleCode, accountStatus }) => ({ url: '/users', params: { page, pageSize, ...(q ? { q } : {}), ...(roleCode ? { roleCode } : {}), ...(accountStatus ? { accountStatus } : {}) } }),
      providesTags: (result) => result ? [...result.data.data.map(({ id }) => ({ type: 'Users' as const, id })), { type: 'Users', id: 'LIST' }] : [{ type: 'Users', id: 'LIST' }],
    }),
    getUser: builder.query<SuccessResponse<UserDetailDto>, string>({ query: (id) => `/users/${id}`, providesTags: (_result, _error, id) => [{ type: 'Users', id }] }),
    createUser: builder.mutation<SuccessResponse<{ user: UserDetailDto; invitation: InvitationDto }>, CreateUserRequest>({
      query: (body) => ({ url: '/users', method: 'POST', body }), invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),
    updateUser: builder.mutation<SuccessResponse<UserDetailDto>, UpdateUserRequest>({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Users', id }, { type: 'Users', id: 'LIST' }],
    }),
    deactivateUser: builder.mutation<SuccessResponse<UserDetailDto>, string>({
      query: (id) => ({ url: `/users/${id}/deactivate`, method: 'POST' }), invalidatesTags: (_result, _error, id) => [{ type: 'Users', id }, { type: 'Users', id: 'LIST' }],
    }),
    reactivateUser: builder.mutation<SuccessResponse<UserDetailDto>, { id: string; reportingStartWeek?: string }>({
      query: ({ id, ...body }) => ({ url: `/users/${id}/reactivate`, method: 'POST', ...(Object.keys(body).length ? { body } : {}) }), invalidatesTags: (_result, _error, { id }) => [{ type: 'Users', id }, { type: 'Users', id: 'LIST' }],
    }),
    resendInvitation: builder.mutation<SuccessResponse<InvitationDto>, string>({
      query: (id) => ({ url: `/users/${id}/resend-invitation`, method: 'POST' }), invalidatesTags: (_result, _error, id) => [{ type: 'Users', id }, { type: 'Users', id: 'LIST' }],
    }),
    updateReportingSchedule: builder.mutation<SuccessResponse<{ userId: string; reportingPeriods: ReportingPeriodDto[] }>, ReportingScheduleRequest>({
      query: ({ id, ...body }) => ({ url: `/users/${id}/reporting-schedule`, method: 'PUT', body }), invalidatesTags: (_result, _error, { id }) => [{ type: 'Users', id }, { type: 'Users', id: 'LIST' }],
    }),
  }),
})

export const { useGetRolesQuery, useGetUsersQuery, useGetUserQuery, useCreateUserMutation, useUpdateUserMutation, useDeactivateUserMutation, useReactivateUserMutation, useResendInvitationMutation, useUpdateReportingScheduleMutation } = usersApi
