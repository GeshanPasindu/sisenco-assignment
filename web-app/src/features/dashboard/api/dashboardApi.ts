import { baseApi } from '../../../services/api/baseApi'
import type { PaginatedResponse, SuccessResponse } from '../../../services/api/api.types'
import type { Activity, MyDashboard, TeamDashboard } from '../types/dashboard.types'

const dashboardTag = { type: 'Dashboard' as const, id: 'CURRENT' }
const activityTag = { type: 'DashboardActivity' as const, id: 'LIST' }
export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyDashboard: builder.query<SuccessResponse<MyDashboard>, { weekStart?: string; trendWeeks?: number }>({ query: (params) => ({ url: '/dashboard/me', params }), providesTags: [dashboardTag] }),
    getTeamDashboard: builder.query<SuccessResponse<TeamDashboard>, { weekStart?: string; trendWeeks?: number; memberId?: string; projectId?: string }>({ query: (params) => ({ url: '/dashboard/team', params }), providesTags: [dashboardTag] }),
    getMyDashboardActivity: builder.query<PaginatedResponse<Activity>, { page?: number; pageSize?: number; fromDate?: string; toDate?: string }>({ query: (params) => ({ url: '/dashboard/me/activity', params }), providesTags: [activityTag] }),
    getTeamDashboardActivity: builder.query<PaginatedResponse<Activity>, { page?: number; pageSize?: number; fromDate?: string; toDate?: string; memberId?: string }>({ query: (params) => ({ url: '/dashboard/team/activity', params }), providesTags: [activityTag] }),
  }),
})
export const { useGetMyDashboardQuery, useGetTeamDashboardQuery, useGetMyDashboardActivityQuery, useGetTeamDashboardActivityQuery } = dashboardApi
