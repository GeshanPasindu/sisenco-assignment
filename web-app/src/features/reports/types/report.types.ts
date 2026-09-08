import type {
  ProjectRefDto,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "../../tasks/types/task.types";
export type ReportStatus =
  "DRAFT" | "SUBMITTED" | "NEEDS_CORRECTION" | "APPROVED";
export type ReportState = "NOT_STARTED" | ReportStatus;
export type SubmissionTiming = "ON_TIME" | "LATE" | "PENDING" | "OVERDUE";
export type TaskSection = "THIS_WEEK" | "NEXT_WEEK";
export interface ReportTaskInput {
  id?: string;
  sourceTaskId: string | null;
  projectId: string | null;
  section: TaskSection;
  name: string;
  priority: TaskPriority;
  status: TaskStatus | null;
  plannedCompletionPct: number | null;
  actualCompletionPct: number | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  taskType: TaskType;
  deliverable: string | null;
  displayOrder: number;
}
export interface ReportTask extends ReportTaskInput {
  projectNameSnapshot?: string | null;
  sourceTaskDescription?: string | null;
  sourceTaskPlannedDate?: string | null;
  sourceTaskDueDate?: string | null;
  sourceTaskAssigneeName?: string | null;
}
export interface Blocker {
  id?: string;
  description: string;
  isKey: boolean;
  status: "OPEN" | "RESOLVED";
  displayOrder: number;
}
export interface Achievement {
  id?: string;
  description: string;
  isKey: boolean;
  displayOrder: number;
}
export interface Review {
  id: string;
  reportVersionId: string;
  reviewer: { id: string; firstName: string; lastName: string };
  decision: "APPROVED" | "CHANGES_REQUESTED";
  comment: string | null;
  createdAt: string;
}
export interface ReportVersion {
  id: string;
  reportId: string;
  versionNumber: number;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  review: Review | null;
  notes: string | null;
  tasks: ReportTask[];
  blockers: Blocker[];
  achievements: Achievement[];
}
export interface ReportDto {
  id: string;
  member: { id: string; firstName: string; lastName: string };
  weekStart: string;
  weekEnd: string;
  deadlineAt: string;
  status: ReportStatus;
  firstSubmittedAt: string | null;
  submissionTiming: SubmissionTiming;
  latestSubmittedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  content: ReportVersion | null;
  latestReview: Review | null;
}
export type ReportListItem = Omit<ReportDto, "content" | "latestReview">;
export interface ComplianceItem {
  member: { id: string; firstName: string; lastName: string };
  weekStart: string;
  reportId: string | null;
  reportState: ReportState;
  submissionTiming: SubmissionTiming;
  deadlineAt: string;
  firstSubmittedAt: string | null;
}
export interface TaskCandidate {
  sourceTaskId: string;
  name: string;
  project: ProjectRefDto;
  section: TaskSection;
  alreadyImported: boolean;
  suggestedValues: ReportTask;
}
