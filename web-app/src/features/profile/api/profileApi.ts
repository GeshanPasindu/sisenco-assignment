import { baseApi } from '../../../services/api/baseApi'
import type { SuccessResponse } from '../../../services/api/api.types'
import { updateSessionUser } from '../../auth/store/authSlice'
import type { MyProfileDto, UpdateMyProfileRequest } from '../types/profile.types'

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyProfile: builder.query<SuccessResponse<MyProfileDto>, void>({
      query: () => '/users/me', providesTags: [{ type: 'Profile', id: 'ME' }],
    }),
    updateMyProfile: builder.mutation<SuccessResponse<MyProfileDto>, UpdateMyProfileRequest>({
      query: (body) => ({ url: '/users/me', method: 'PATCH', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(updateSessionUser({ firstName: data.data.firstName, lastName: data.data.lastName }))
        } catch { /* mutation error is presented by the form */ }
      },
      invalidatesTags: [{ type: 'Profile', id: 'ME' }],
    }),
  }),
})

export const { useGetMyProfileQuery, useUpdateMyProfileMutation } = profileApi
