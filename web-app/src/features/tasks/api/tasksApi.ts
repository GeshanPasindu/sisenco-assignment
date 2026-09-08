import { baseApi } from "../../../services/api/baseApi";
import type {
  PaginatedResponse,
  SuccessResponse,
} from "../../../services/api/api.types";
import type { TaskDto, TaskInput, TasksQuery, TimeEntryDto } from "../types/task.types";
const taskList = { type: "Tasks" as const, id: "LIST" };
const entryList = { type: "TimeEntries" as const, id: "LIST" };
export const tasksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<
      PaginatedResponse<TaskDto>,
      TasksQuery
    >({
      query: (params) => ({ url: "/tasks", params }),
      providesTags: (r) =>
        r
          ? [
              ...r.data.data.map(({ id }) => ({ type: "Tasks" as const, id })),
              taskList,
            ]
          : [taskList],
    }),
    createTask: builder.mutation<SuccessResponse<TaskDto>, TaskInput>({
      query: (body) => ({ url: "/tasks", method: "POST", body }),
      invalidatesTags: [taskList, { type: "Projects", id: "LIST" }],
    }),
    getTask: builder.query<SuccessResponse<TaskDto>, string>({
      query: (id) => `/tasks/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Tasks", id }],
    }),
    updateTask: builder.mutation<
      SuccessResponse<TaskDto>,
      { id: string; lockVersion: number } & Partial<
        TaskInput & {
          status: TaskDto["status"];
          actualCompletionPct: number;
          deliverable: string | null;
        }
      >
    >({
      query: ({ id, ...body }) => ({
        url: `/tasks/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Tasks", id }, taskList],
    }),
    assignTask: builder.mutation<
      SuccessResponse<TaskDto>,
      { id: string; assigneeId: string; lockVersion: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/tasks/${id}/assign`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Tasks", id },
        taskList,
        { type: "Projects", id: "LIST" },
      ],
    }),
    archiveTask: builder.mutation<SuccessResponse<TaskDto>, { id: string; lockVersion: number }>({
      query: ({ id, lockVersion }) => ({ url: `/tasks/${id}/archive`, method: "POST", body: { lockVersion } }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Tasks", id }, taskList],
    }),
    getTimeEntries: builder.query<
      PaginatedResponse<TimeEntryDto>,
      Record<string, string | number | undefined>
    >({
      query: (params) => ({ url: "/time-entries", params }),
      providesTags: (r) =>
        r
          ? [
              ...r.data.data.map(({ id }) => ({
                type: "TimeEntries" as const,
                id,
              })),
              entryList,
            ]
          : [entryList],
    }),
    createTimeEntry: builder.mutation<
      SuccessResponse<TimeEntryDto>,
      {
        taskId: string;
        workDate: string;
        minutes: number;
        note?: string | null;
      }
    >({
      query: ({ taskId, ...body }) => ({
        url: `/tasks/${taskId}/time-entries`,
        method: "POST",
        body,
      }),
      invalidatesTags: [entryList, taskList],
    }),
    updateTimeEntry: builder.mutation<
      SuccessResponse<TimeEntryDto>,
      { id: string; workDate?: string; minutes?: number; note?: string | null }
    >({
      query: ({ id, ...body }) => ({
        url: `/time-entries/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [entryList, taskList],
    }),
    deleteTimeEntry: builder.mutation<void, string>({
      query: (id) => ({ url: `/time-entries/${id}`, method: "DELETE" }),
      invalidatesTags: [entryList, taskList],
    }),
  }),
});
export const {
  useGetTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useAssignTaskMutation,
  useArchiveTaskMutation,
  useGetTimeEntriesQuery,
  useCreateTimeEntryMutation,
  useUpdateTimeEntryMutation,
  useDeleteTimeEntryMutation,
} = tasksApi;
