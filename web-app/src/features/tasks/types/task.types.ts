export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus =
  "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
export type TaskType =
  "DEVELOPMENT" | "TESTING" | "MEETINGS" | "DOCUMENTATION" | "OTHER";
export interface PersonDto {
  id: string;
  firstName: string;
  lastName: string;
}
export interface ProjectRefDto {
  id: string;
  name: string;
}
export interface TaskDto {
  id: string;
  name: string;
  description: string | null;
  project: ProjectRefDto;
  createdBy: PersonDto;
  assignee: PersonDto;
  plannedDate: string;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  taskType: TaskType;
  plannedCompletionPct: number;
  actualCompletionPct: number;
  plannedMinutes: number;
  loggedMinutes: number;
  deliverable: string | null;
  completedAt: string | null;
  lockVersion: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TimeEntryDto {
  id: string;
  task: { id: string; name: string; project: ProjectRefDto };
  user: PersonDto;
  workDate: string;
  minutes: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TaskInput {
  name: string;
  projectId: string;
  plannedDate: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  taskType?: TaskType;
  plannedCompletionPct?: number;
  plannedMinutes?: number;
  assigneeId?: string;
}
export interface TasksQuery {
  page?: number;
  pageSize?: number;
  scope?: "own" | "team";
  fromDate?: string;
  toDate?: string;
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  taskType?: TaskType;
  archived?: "false" | "true" | "all";
}
