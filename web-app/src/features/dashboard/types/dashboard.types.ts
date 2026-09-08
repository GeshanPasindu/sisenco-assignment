export type ReportState = 'DRAFT' | 'SUBMITTED' | 'NEEDS_CORRECTION' | 'APPROVED' | 'NOT_STARTED'
export type SubmissionTiming = 'ON_TIME' | 'LATE' | 'PENDING' | 'OVERDUE'
export type PrimaryAction = 'CREATE_REPORT' | 'CONTINUE_EDITING' | 'MAKE_CORRECTIONS' | 'VIEW_REPORT'

export interface DashboardPeriod { weekStart: string; weekEnd: string; deadlineAt: string; timezone: string }
export interface TrendPoint { weekStart: string; completedTasks: number }
export interface MyDashboard {
  period: DashboardPeriod
  currentReport: { id: string; status: Exclude<ReportState, 'NOT_STARTED'>; versionId: string; action: PrimaryAction } | null
  primaryAction: PrimaryAction
  metrics: { dataSource: 'EDITABLE' | 'SUBMITTED' | 'NONE'; completedTasks: number; actualMinutes: number; openBlockers: number }
  tasksCompletedTrend: TrendPoint[]
}
export interface TeamDashboard {
  period: DashboardPeriod
  summary: { submittedReports: number; expectedReports: number; eligibleSubmittedReports: number; submissionRatePct: number | null; onTimeRatePct: number | null; onTime: number; late: number; pending: number; overdue: number; needsCorrectionCount: number; openBlockerCount: number }
  tasksCompletedTrend: TrendPoint[]
  reportStatusByMember: Array<{ member: Person; weekStart: string; reportId: string | null; reportState: ReportState; submissionTiming: SubmissionTiming; deadlineAt: string; firstSubmittedAt: string | null }>
  tasksByProject: Array<{ project: { id: string; name: string }; taskCount: number }>
  timeByTaskType: Array<{ taskType: string; actualMinutes: number }>
  appliedFilters: { weekStart: string; memberId: string | null; projectId: string | null; trendWeeks: number; projectFilterAppliesTo: string[] }
}
export interface Person { id: string; firstName: string; lastName: string }
export interface Activity { id: string; eventType: 'REPORT_SUBMITTED' | 'REPORT_RESUBMITTED' | 'REPORT_APPROVED' | 'REPORT_NEEDS_CORRECTION'; eventAt: string; actor: Person; member: Person; reportId: string; reportVersionId: string; versionNumber: number; weekStart: string; reviewId: string | null; comment: string | null }
