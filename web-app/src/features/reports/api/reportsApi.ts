import { baseApi } from "../../../services/api/baseApi";
import type {
  PaginatedResponse,
  SuccessResponse,
} from "../../../services/api/api.types";
import type {
  ReportDto,
  ReportListItem,
  ReportTaskInput,
  ReportVersion,
  TaskCandidate,
  Blocker,
  Achievement,
  ComplianceItem,
  TaskSection,
} from "../types/report.types";
const listTag = { type: "Reports" as const, id: "LIST" };
const complianceTag = { type: "ReportCompliance" as const, id: "LIST" };
export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReports: builder.query<
      PaginatedResponse<ReportListItem>,
      {
        page?: number; pageSize?: number; scope?: "own" | "team";
        fromWeek?: string; toWeek?: string; projectId?: string; status?: string; memberId?: string;
      }
    >({
      query: (params) => ({ url: "/reports", params }),
      providesTags: (r) =>
        r
          ? [
              ...r.data.data.map(({ id }) => ({
                type: "Reports" as const,
                id,
              })),
              listTag,
            ]
          : [listTag],
    }),
    getReport: builder.query<SuccessResponse<ReportDto>, string>({
      query: (id) => `/reports/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Reports", id }],
    }),
    getReportCompliance: builder.query<
      PaginatedResponse<ComplianceItem>,
      { page?: number; pageSize?: number; weekStart: string; memberId?: string; submissionTiming?: string; reportState?: string }
    >({
      query: (params) => ({ url: "/reports/compliance", params }),
      providesTags: [complianceTag],
    }),
    createReport: builder.mutation<
      SuccessResponse<ReportDto>,
      { weekStart: string }
    >({
      query: (body) => ({ url: "/reports", method: "POST", body }),
      invalidatesTags: [listTag],
    }),
    deleteDraftReport: builder.mutation<void, string>({
      query: (id) => ({ url: `/reports/${id}`, method: "DELETE" }),
      invalidatesTags: [listTag, complianceTag],
    }),
    saveReport: builder.mutation<
      SuccessResponse<ReportVersion>,
      {
        id: string;
        versionId: string;
        lockVersion: number;
        notes: string | null;
        tasks: ReportTaskInput[];
        blockers: Blocker[];
        achievements: Achievement[];
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/reports/${id}/editable-version`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Reports", id }, listTag],
    }),
    submitReport: builder.mutation<
      SuccessResponse<ReportDto>,
      { id: string; versionId: string; lockVersion: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/reports/${id}/submit`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Reports", id }, listTag],
    }),
    createCorrection: builder.mutation<SuccessResponse<ReportVersion>, string>({
      query: (id) => ({ url: `/reports/${id}/corrections`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [{ type: "Reports", id }, listTag],
    }),
    getCandidates: builder.query<
      PaginatedResponse<TaskCandidate>,
      { id: string; section: TaskSection; page?: number; pageSize?: number; q?: string; projectId?: string }
    >({
      query: ({ id, ...params }) => ({
        url: `/reports/${id}/task-candidates`,
        params,
      }),
    }),
    importTasks: builder.mutation<
      SuccessResponse<ReportVersion>,
      {
        id: string;
        versionId: string;
        lockVersion: number;
        section: TaskSection;
        taskIds: string[];
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/reports/${id}/import-tasks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Reports", id }],
    }),
    getVersions: builder.query<
      PaginatedResponse<
        Pick<
          ReportVersion,
          | "id"
          | "reportId"
          | "versionNumber"
          | "lockVersion"
          | "createdAt"
          | "updatedAt"
          | "submittedAt"
          | "review"
        >
      >,
      { id: string; page?: number; pageSize?: number }
    >({ query: ({ id, ...params }) => ({ url: `/reports/${id}/versions`, params }) }),
    getVersion: builder.query<
      SuccessResponse<ReportVersion>,
      { id: string; versionId: string }
    >({ query: ({ id, versionId }) => `/reports/${id}/versions/${versionId}` }),
    reviewReport: builder.mutation<
      SuccessResponse<{ report: ReportDto }>,
      {
        id: string;
        versionId: string;
        decision: "APPROVED" | "CHANGES_REQUESTED";
        comment?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/reports/${id}/reviews`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Reports", id }, listTag, complianceTag],
    }),
  }),
});
export const {
  useGetReportsQuery,
  useGetReportQuery,
  useGetReportComplianceQuery,
  useCreateReportMutation,
  useDeleteDraftReportMutation,
  useSaveReportMutation,
  useSubmitReportMutation,
  useCreateCorrectionMutation,
  useGetCandidatesQuery,
  useImportTasksMutation,
  useGetVersionsQuery,
  useGetVersionQuery,
  useReviewReportMutation,
} = reportsApi;
