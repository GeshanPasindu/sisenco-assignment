import { z } from "zod";

const uuid = z.string().uuid();
const percentage = z.number().min(0).max(100).multipleOf(0.01);
const minutes = z.number().int().min(0);
const monday = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1;
};

export const reportWeekSchema = z.string().refine(monday, "Reporting week must be a Monday.");
export const reportTaskSchema = z.object({
  id: uuid.optional(),
  sourceTaskId: uuid.nullable(),
  projectId: uuid.nullable(),
  section: z.enum(["THIS_WEEK", "NEXT_WEEK"]),
  name: z.string().trim().min(1).max(255),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"]).nullable(),
  plannedCompletionPct: percentage.nullable(),
  actualCompletionPct: percentage.nullable(),
  plannedMinutes: minutes.nullable(),
  actualMinutes: minutes.nullable(),
  taskType: z.enum(["DEVELOPMENT", "TESTING", "MEETINGS", "DOCUMENTATION", "OTHER"]),
  deliverable: z.string().trim().max(10000).nullable(),
  displayOrder: z.number().int().min(0),
}).superRefine((task, context) => {
  if (task.section === "NEXT_WEEK" && (task.status !== null || task.actualCompletionPct !== null || task.actualMinutes !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Next-week rows cannot include actual values or a status." });
  }
});

export const editableReportSchema = z.object({
  versionId: uuid,
  lockVersion: z.number().int().positive(),
  notes: z.string().trim().max(10000).nullable(),
  tasks: z.array(reportTaskSchema).max(200),
  blockers: z.array(z.object({ id: uuid.optional(), description: z.string().trim().min(1).max(10000), isKey: z.boolean(), status: z.enum(["OPEN", "RESOLVED"]), displayOrder: z.number().int().min(0) })).max(100),
  achievements: z.array(z.object({ id: uuid.optional(), description: z.string().trim().min(1).max(10000), isKey: z.boolean(), displayOrder: z.number().int().min(0) })).max(100),
}).superRefine((report, context) => {
  if (report.blockers.filter((item) => item.isKey).length > 1) context.addIssue({ code: z.ZodIssueCode.custom, message: "Only one key blocker is allowed." });
  if (report.achievements.filter((item) => item.isKey).length > 1) context.addIssue({ code: z.ZodIssueCode.custom, message: "Only one key achievement is allowed." });
});
