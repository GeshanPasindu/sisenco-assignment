import { baseApi } from "../../../services/api/baseApi";
import type {
  PaginatedResponse,
  SuccessResponse,
} from "../../../services/api/api.types";
import type {
  ProjectDto,
  ProjectInput,
  ProjectMemberDto,
} from "../types/project.types";

const listTag = { type: "Projects" as const, id: "LIST" };
export const projectsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProject: builder.query<SuccessResponse<ProjectDto>, string>({
      query: (id) => `/projects/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Projects", id }],
    }),
    getProjects: builder.query<
      PaginatedResponse<ProjectDto>,
      {
        page?: number;
        pageSize?: number;
        archived?: "false" | "true" | "all";
        q?: string;
        memberId?: string;
      }
    >({
      query: (params) => ({ url: "/projects", params }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.data.map(({ id }) => ({
                type: "Projects" as const,
                id,
              })),
              listTag,
            ]
          : [listTag],
    }),
    createProject: builder.mutation<SuccessResponse<ProjectDto>, ProjectInput>({
      query: (body) => ({ url: "/projects", method: "POST", body }),
      invalidatesTags: [listTag],
    }),
    updateProject: builder.mutation<
      SuccessResponse<ProjectDto>,
      { id: string } & ProjectInput
    >({
      query: ({ id, ...body }) => ({
        url: `/projects/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Projects", id }, listTag],
    }),
    archiveProject: builder.mutation<SuccessResponse<ProjectDto>, string>({
      query: (id) => ({ url: `/projects/${id}/archive`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [{ type: "Projects", id }, listTag],
    }),
    getProjectMembers: builder.query<
      SuccessResponse<ProjectMemberDto[]>,
      string
    >({
      query: (id) => `/projects/${id}/members`,
      providesTags: (_r, _e, id) => [{ type: "Projects", id: `${id}:members` }],
    }),
    setProjectMembers: builder.mutation<
      SuccessResponse<ProjectMemberDto[]>,
      { id: string; memberIds: string[] }
    >({
      query: ({ id, memberIds }) => ({
        url: `/projects/${id}/members`,
        method: "PATCH",
        body: { memberIds },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Projects", id: `${id}:members` },
        listTag,
      ],
    }),
  }),
});
export const {
  useGetProjectQuery,
  useGetProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useArchiveProjectMutation,
  useGetProjectMembersQuery,
  useSetProjectMembersMutation,
} = projectsApi;
