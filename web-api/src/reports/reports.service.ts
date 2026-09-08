import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth-context';
import { ApiError } from '../common/api-error';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import type {
  CandidateQueryDto,
  ComplianceQueryDto,
  CreateReportDto,
  ImportTasksDto,
  ReportQueryDto,
  ReviewDto,
  SaveVersionDto,
  SubmitReportDto,
  VersionsQueryDto,
} from './report.dto';

const versionInclude = {
  tasks: {
    orderBy: { displayOrder: 'asc' as const },
    include: { project: { select: { name: true } } },
  },
  blockers: { orderBy: { displayOrder: 'asc' as const } },
  achievements: { orderBy: { displayOrder: 'asc' as const } },
  review: {
    include: {
      reviewer: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ReportVersionInclude;
const reportInclude = {
  member: { select: { id: true, firstName: true, lastName: true } },
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    include: versionInclude,
  },
} satisfies Prisma.ReportInclude;
type ReportFull = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;
type VersionFull = Prisma.ReportVersionGetPayload<{
  include: typeof versionInclude;
}>;
type ReviewFull = NonNullable<VersionFull['review']>;
const date = (v: string) => new Date(`${v}T00:00:00.000Z`);
const dateOnly = (v: Date) => v.toISOString().slice(0, 10);
const validMonday = (v: string, field = 'weekStart') => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(v))
    throw new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed.', [
      { field, code: 'INVALID_DATE', message: 'Must be a valid Monday.' },
    ]);
  const d = date(v);
  if (Number.isNaN(d.getTime()) || d.getUTCDay() !== 1 || dateOnly(d) !== v)
    throw new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed.', [
      { field, code: 'INVALID_DATE', message: 'Must be a valid Monday.' },
    ]);
  return d;
};
const weekEnd = (week: Date) => {
  const d = new Date(week);
  d.setUTCDate(d.getUTCDate() + 6);
  return d;
};
const candidateWeek = (week: Date, section: 'THIS_WEEK' | 'NEXT_WEEK') => {
  const start = new Date(week);
  if (section === 'NEXT_WEEK') start.setUTCDate(start.getUTCDate() + 7);
  return { start, end: weekEnd(start) };
};
const overlapsCandidateWeek = (
  task: { plannedDate: Date; dueDate: Date | null },
  start: Date,
  end: Date,
) => task.plannedDate <= end && (!task.dueDate || task.dueDate >= start);
const deadline = (week: Date) => {
  const d = new Date(week);
  d.setUTCDate(d.getUTCDate() + 7);
  d.setUTCHours(6, 30, 0, 0);
  return d;
};
const person = (p: { id: string; firstName: string; lastName: string }) => p;
const mapReview = (r: ReviewFull | null) =>
  r
    ? {
        id: r.id,
        reportVersionId: r.reportVersionId,
        reviewer: person(r.reviewer),
        decision: r.decision,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      }
    : null;
const mapVersion = (v: VersionFull) => ({
  id: v.id,
  reportId: v.reportId,
  versionNumber: v.versionNumber,
  lockVersion: v.lockVersion,
  createdAt: v.createdAt.toISOString(),
  updatedAt: v.updatedAt.toISOString(),
  submittedAt: v.submittedAt?.toISOString() ?? null,
  review: mapReview(v.review),
  notes: v.notes,
  tasks: v.tasks.map((t) => ({
    id: t.id,
    sourceTaskId: t.sourceTaskId,
    sourceTaskDescription: t.sourceTaskDescription,
    sourceTaskPlannedDate: t.sourceTaskPlannedDate ? dateOnly(t.sourceTaskPlannedDate) : null,
    sourceTaskDueDate: t.sourceTaskDueDate ? dateOnly(t.sourceTaskDueDate) : null,
    sourceTaskAssigneeName: t.sourceTaskAssigneeName,
    projectId: t.projectId,
    section: t.section,
    name: t.name,
    priority: t.priority,
    status: t.status,
    plannedCompletionPct:
      t.plannedCompletionPct === null ? null : Number(t.plannedCompletionPct),
    actualCompletionPct:
      t.actualCompletionPct === null ? null : Number(t.actualCompletionPct),
    plannedMinutes: t.plannedMinutes,
    actualMinutes: t.actualMinutes,
    taskType: t.taskType,
    deliverable: t.deliverable,
    displayOrder: t.displayOrder,
    projectNameSnapshot: t.projectNameSnapshot,
  })),
  blockers: v.blockers.map((b) => ({
    id: b.id,
    description: b.description,
    isKey: b.isKey,
    status: b.status,
    displayOrder: b.displayOrder,
  })),
  achievements: v.achievements.map((a) => ({
    id: a.id,
    description: a.description,
    isKey: a.isKey,
    displayOrder: a.displayOrder,
  })),
});

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
  ) {}
  private async report(id: string) {
    const r = await this.prisma.report.findUnique({
      where: { id },
      include: reportInclude,
    });
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    return r;
  }
  private canRead(actor: AuthenticatedUser, r: ReportFull) {
    if (
      r.member.id === actor.id &&
      actor.permissions.includes('report:read_own')
    )
      return 'own';
    if (
      actor.role.code === 'MANAGER_ADMIN' &&
      actor.permissions.includes('report:read_team')
    ) {
      if (r.member.id !== actor.id && !r.versions.some((version) => version.submittedAt))
        throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
      return 'team';
    }
    throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
  }
  private ownUpdate(actor: AuthenticatedUser, r: ReportFull) {
    if (
      r.member.id !== actor.id ||
      !actor.permissions.includes('report:update_own')
    )
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
  }
  private timing(r: ReportFull) {
    const submitted = r.versions
      .filter((v) => v.submittedAt)
      .sort(
        (a, b) => a.submittedAt!.getTime() - b.submittedAt!.getTime(),
      )[0]?.submittedAt;
    if (!submitted)
      return new Date() > deadline(r.weekStart) ? 'OVERDUE' : 'PENDING';
    return submitted <= deadline(r.weekStart) ? 'ON_TIME' : 'LATE';
  }
  private detail(r: ReportFull, actor?: AuthenticatedUser) {
    const access = actor ? this.canRead(actor, r) : 'own';
    const submitted = r.versions.filter((v) => v.submittedAt);
    const latestSubmitted = submitted[0];
    const editable = r.versions.find((v) => !v.submittedAt);
    const first = submitted.length
      ? submitted.reduce(
          (x, v) => (!x || v.submittedAt! < x ? v.submittedAt! : x),
          null as Date | null,
        )
      : null;
    const content =
      access === 'own'
        ? (editable ?? latestSubmitted ?? null)
        : (latestSubmitted ?? null);
    return {
      id: r.id,
      member: person(r.member),
      weekStart: dateOnly(r.weekStart),
      weekEnd: dateOnly(weekEnd(r.weekStart)),
      deadlineAt: deadline(r.weekStart).toISOString(),
      status: r.status,
      firstSubmittedAt: first?.toISOString() ?? null,
      submissionTiming: this.timing(r),
      latestSubmittedVersionId: latestSubmitted?.id ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      content: content ? mapVersion(content) : null,
      latestReview: latestSubmitted ? mapReview(latestSubmitted.review) : null,
    };
  }
  async list(actor: AuthenticatedUser, q: ReportQueryDto) {
    if (
      q.scope === 'team' &&
      !(
        actor.role.code === 'MANAGER_ADMIN' &&
        actor.permissions.includes('report:read_team')
      )
    )
      throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    if (q.scope === 'own' && q.memberId)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    const filters: Prisma.ReportWhereInput[] = [
      ...(q.scope === 'team'
        ? [{ status: { in: ['SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED'] as never[] } }]
        : []),
      ...(q.status ? [{ status: q.status as never }] : []),
    ];
    if (q.fromWeek || q.toWeek)
      filters.push({
        weekStart: {
          ...(q.fromWeek
            ? { gte: validMonday(q.fromWeek, 'fromWeek') }
            : {}),
          ...(q.toWeek ? { lte: validMonday(q.toWeek, 'toWeek') } : {}),
        },
      });
    const where: Prisma.ReportWhereInput = {
      memberId: q.scope === 'own' ? actor.id : q.memberId,
      ...(filters.length ? { AND: filters } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: [{ weekStart: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      data: rows.map((r) => {
        const x = this.detail(r, actor);
        return {
          id: x.id,
          member: x.member,
          weekStart: x.weekStart,
          weekEnd: x.weekEnd,
          deadlineAt: x.deadlineAt,
          status: x.status,
          firstSubmittedAt: x.firstSubmittedAt,
          submissionTiming: x.submissionTiming,
          latestSubmittedVersionId: x.latestSubmittedVersionId,
          createdAt: x.createdAt,
          updatedAt: x.updatedAt,
        };
      }),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  async create(actor: AuthenticatedUser, dto: CreateReportDto) {
    const week = validMonday(dto.weekStart);
    try {
      const r = await this.prisma.report.create({
        data: {
          memberId: actor.id,
          weekStart: week,
          versions: { create: { versionNumber: 1 } },
        },
        include: reportInclude,
      });
      return this.detail(r, actor);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ApiError(
          409,
          'REPORT_ALREADY_EXISTS',
          'A report already exists for this week.',
        );
      throw e;
    }
  }
  async remove(actor: AuthenticatedUser, id: string) {
    const r = await this.report(id);
    this.ownUpdate(actor, r);
    if (r.status !== 'DRAFT' || r.versions.some((version) => version.submittedAt))
      throw new ApiError(
        409,
        'REPORT_NOT_DELETABLE',
        'Only an unsubmitted draft report can be deleted.',
      );
    const versionIds = r.versions.map((version) => version.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { reportVersionId: { in: versionIds } } });
      await tx.reportTask.deleteMany({ where: { reportVersionId: { in: versionIds } } });
      await tx.reportBlocker.deleteMany({ where: { reportVersionId: { in: versionIds } } });
      await tx.reportAchievement.deleteMany({ where: { reportVersionId: { in: versionIds } } });
      await tx.reportVersion.deleteMany({ where: { reportId: r.id } });
      await tx.report.delete({ where: { id: r.id } });
    });
  }
  async get(actor: AuthenticatedUser, id: string) {
    const r = await this.report(id);
    this.canRead(actor, r);
    return this.detail(r, actor);
  }
  async compliance(q: ComplianceQueryDto) {
    const week = validMonday(q.weekStart);
    const users = await this.prisma.user.findMany({
      where: {
        activatedAt: { not: null },
        deactivatedAt: null,
        role: { code: 'TEAM_MEMBER', deletedAt: null },
        reportingPeriods: {
          some: {
            startWeek: { lte: week },
            OR: [{ endWeek: null }, { endWeek: { gte: week } }],
          },
        },
        ...(q.memberId ? { id: q.memberId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        reports: {
          where: { weekStart: week },
          include: {
            versions: {
              where: { submittedAt: { not: null } },
              orderBy: { submittedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    const items = users
      .map((u) => {
        const r = u.reports[0];
        const v = r?.versions[0];
        const submissionTiming = v?.submittedAt
          ? v.submittedAt <= deadline(week)
            ? 'ON_TIME'
            : 'LATE'
          : new Date() > deadline(week)
            ? 'OVERDUE'
            : 'PENDING';
        const reportState = r?.status ?? 'NOT_STARTED';
        return {
          member: { id: u.id, firstName: u.firstName, lastName: u.lastName },
          weekStart: q.weekStart,
          reportId: r?.id ?? null,
          reportState,
          submissionTiming,
          deadlineAt: deadline(week).toISOString(),
          firstSubmittedAt: v?.submittedAt?.toISOString() ?? null,
        };
      })
      .filter(
        (i) =>
          (!q.submissionTiming || i.submissionTiming === q.submissionTiming) &&
          (!q.reportState || i.reportState === q.reportState),
      );
    const total = items.length;
    return {
      data: items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  private async editable(
    actor: AuthenticatedUser,
    id: string,
    versionId: string,
    lock: number,
  ) {
    const r = await this.report(id);
    this.ownUpdate(actor, r);
    if (!['DRAFT', 'NEEDS_CORRECTION'].includes(r.status))
      throw new ApiError(409, 'REPORT_NOT_EDITABLE', 'Report is not editable.');
    const v = r.versions.find((x) => x.id === versionId);
    if (!v || v.submittedAt || v.lockVersion !== lock)
      throw new ApiError(
        409,
        v?.lockVersion !== lock ? 'STALE_VERSION' : 'REPORT_NOT_EDITABLE',
        'Report version cannot be edited.',
      );
    return { r, v };
  }
  async save(actor: AuthenticatedUser, id: string, dto: SaveVersionDto) {
    const { r, v } = await this.editable(
      actor,
      id,
      dto.versionId,
      dto.lockVersion,
    );
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.reportTask.deleteMany({ where: { reportVersionId: v.id } });
      await tx.reportBlocker.deleteMany({ where: { reportVersionId: v.id } });
      await tx.reportAchievement.deleteMany({
        where: { reportVersionId: v.id },
      });
      const projects = await tx.project.findMany({
        where: {
          id: {
            in: dto.tasks
              .map((t) => t.projectId)
              .filter((x): x is string => !!x),
          },
        },
      });
      const pmap = new Map(projects.map((p) => [p.id, p]));
      const sourceTasks = await tx.task.findMany({
        where: { id: { in: dto.tasks.map((task) => task.sourceTaskId).filter((id): id is string => !!id) } },
        include: { assignee: { select: { firstName: true, lastName: true } } },
      });
      const sourceMap = new Map(sourceTasks.map((task) => [task.id, task]));
      for (const t of dto.tasks)
        {
        const source = t.sourceTaskId ? sourceMap.get(t.sourceTaskId) : undefined;
        await tx.reportTask.create({
          data: {
            reportVersionId: v.id,
            sourceTaskId: t.sourceTaskId ?? null,
            sourceTaskDescription: source?.description ?? null,
            sourceTaskPlannedDate: source?.plannedDate ?? null,
            sourceTaskDueDate: source?.dueDate ?? null,
            sourceTaskAssigneeName: source ? `${source.assignee.firstName} ${source.assignee.lastName}` : null,
            projectId: t.projectId ?? null,
            projectNameSnapshot: t.projectId
              ? (pmap.get(t.projectId)?.name ?? null)
              : null,
            section: t.section as never,
            name: t.name,
            priority: t.priority as never,
            status: (t.status as never) ?? null,
            plannedCompletionPct: t.plannedCompletionPct ?? null,
            actualCompletionPct: t.actualCompletionPct ?? null,
            plannedMinutes: t.plannedMinutes ?? null,
            actualMinutes: t.actualMinutes ?? null,
            taskType: t.taskType as never,
            deliverable: t.deliverable ?? null,
            displayOrder: t.displayOrder,
          },
        });
        }
      for (const b of dto.blockers)
        await tx.reportBlocker.create({
          data: {
            reportVersionId: v.id,
            description: b.description,
            isKey: b.isKey,
            status: b.status as never,
            displayOrder: b.displayOrder,
          },
        });
      for (const a of dto.achievements)
        await tx.reportAchievement.create({
          data: {
            reportVersionId: v.id,
            description: a.description,
            isKey: a.isKey,
            displayOrder: a.displayOrder,
          },
        });
      return tx.reportVersion.update({
        where: { id: v.id },
        data: { notes: dto.notes, lockVersion: { increment: 1 } },
        include: versionInclude,
      });
    });
    return mapVersion(result);
  }
  async candidates(actor: AuthenticatedUser, id: string, q: CandidateQueryDto) {
    const r = await this.report(id);
    this.ownUpdate(actor, r);
    if (!['DRAFT', 'NEEDS_CORRECTION'].includes(r.status))
      throw new ApiError(409, 'REPORT_NOT_EDITABLE', 'Report is not editable.');
    const editable = r.versions.find((v) => !v.submittedAt);
    const imported = new Set(
      editable?.tasks
        .filter((t) => t.section === q.section && t.sourceTaskId)
        .map((t) => t.sourceTaskId),
    );
    const { start, end } = candidateWeek(
      r.weekStart,
      q.section as 'THIS_WEEK' | 'NEXT_WEEK',
    );
    const where: Prisma.TaskWhereInput = {
      assigneeId: actor.id,
      archivedAt: null,
      plannedDate: { lte: end },
      OR: [{ dueDate: null }, { dueDate: { gte: start } }],
      ...(q.projectId ? { projectId: q.projectId } : {}),
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          timeEntries: {
            where: { userId: actor.id, workDate: { gte: start, lte: end } },
            select: { minutes: true },
          },
        },
        orderBy: [{ plannedDate: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      data: tasks.map((t) => {
        const actualMinutes = t.timeEntries.reduce(
          (total, entry) => total + entry.minutes,
          0,
        );
        return {
        sourceTaskId: t.id,
        name: t.name,
        project: t.project,
        section: q.section,
        alreadyImported: imported.has(t.id),
        suggestedValues: {
          sourceTaskId: t.id,
          projectId: t.projectId,
          section: q.section,
          name: t.name,
          priority: t.priority,
          status: q.section === 'NEXT_WEEK' ? null : t.status,
          plannedCompletionPct: Number(t.plannedCompletionPct),
          actualCompletionPct:
            q.section === 'NEXT_WEEK' ? null : Number(t.actualCompletionPct),
          plannedMinutes: t.plannedMinutes,
          actualMinutes: q.section === 'NEXT_WEEK' ? null : actualMinutes,
          taskType: t.taskType,
          deliverable: t.deliverable,
          displayOrder: 0,
        },
        };
      }),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  async importTasks(actor: AuthenticatedUser, id: string, dto: ImportTasksDto) {
    const { v } = await this.editable(
      actor,
      id,
      dto.versionId,
      dto.lockVersion,
    );
    const r = await this.report(id);
    const { start, end } = candidateWeek(
      r.weekStart,
      dto.section as 'THIS_WEEK' | 'NEXT_WEEK',
    );
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: dto.taskIds } },
      include: {
        project: true,
        assignee: { select: { firstName: true, lastName: true } },
        timeEntries: {
          where: { userId: actor.id, workDate: { gte: start, lte: end } },
          select: { minutes: true },
        },
      },
    });
    if (tasks.length !== dto.taskIds.length)
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (
      tasks.some(
        (t) =>
          t.assigneeId !== actor.id ||
          t.archivedAt ||
          !overlapsCandidateWeek(t, start, end),
      )
    )
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    const existing = await this.prisma.reportTask.findFirst({
      where: {
        reportVersionId: v.id,
        sourceTaskId: { in: dto.taskIds },
        section: dto.section as never,
      },
    });
    if (existing)
      throw new ApiError(
        409,
        'TASK_ALREADY_IMPORTED',
        'Task already imported.',
      );
    const result = await this.prisma.$transaction(async (tx) => {
      for (const [i, t] of tasks.entries())
        await tx.reportTask.create({
          data: {
            reportVersionId: v.id,
            sourceTaskId: t.id,
            sourceTaskDescription: t.description,
            sourceTaskPlannedDate: t.plannedDate,
            sourceTaskDueDate: t.dueDate,
            sourceTaskAssigneeName: `${t.assignee.firstName} ${t.assignee.lastName}`,
            projectId: t.projectId,
            projectNameSnapshot: t.project.name,
            section: dto.section as never,
            name: t.name,
            priority: t.priority,
            status: dto.section === 'NEXT_WEEK' ? null : t.status,
            plannedCompletionPct: t.plannedCompletionPct,
            actualCompletionPct:
              dto.section === 'NEXT_WEEK' ? null : t.actualCompletionPct,
            plannedMinutes: t.plannedMinutes,
            actualMinutes:
              dto.section === 'NEXT_WEEK'
                ? null
                : t.timeEntries.reduce((total, entry) => total + entry.minutes, 0),
            taskType: t.taskType,
            deliverable: t.deliverable,
            displayOrder: i,
          },
        });
      return tx.reportVersion.update({
        where: { id: v.id },
        data: { lockVersion: { increment: 1 } },
        include: versionInclude,
      });
    });
    return mapVersion(result);
  }
  async correction(actor: AuthenticatedUser, id: string) {
    const r = await this.report(id);
    this.ownUpdate(actor, r);
    if (r.status !== 'NEEDS_CORRECTION')
      throw new ApiError(
        409,
        'CORRECTION_NOT_ALLOWED',
        'Corrections are not allowed for this report.',
      );
    const existing = r.versions.find((v) => !v.submittedAt);
    if (existing) return mapVersion(existing);
    const source = r.versions.find((v) => v.submittedAt);
    if (!source)
      throw new ApiError(
        409,
        'CORRECTION_NOT_ALLOWED',
        'No submitted version exists.',
      );
    const max = Math.max(...r.versions.map((v) => v.versionNumber));
    const clone = await this.prisma.reportVersion.create({
      data: {
        reportId: id,
        versionNumber: max + 1,
        notes: source.notes,
        tasks: {
          create: source.tasks.map((t) => ({
            sourceTaskId: t.sourceTaskId,
            sourceTaskDescription: t.sourceTaskDescription,
            sourceTaskPlannedDate: t.sourceTaskPlannedDate,
            sourceTaskDueDate: t.sourceTaskDueDate,
            sourceTaskAssigneeName: t.sourceTaskAssigneeName,
            projectId: t.projectId,
            projectNameSnapshot: t.projectNameSnapshot,
            section: t.section,
            name: t.name,
            priority: t.priority,
            status: t.status,
            plannedCompletionPct: t.plannedCompletionPct,
            actualCompletionPct: t.actualCompletionPct,
            plannedMinutes: t.plannedMinutes,
            actualMinutes: t.actualMinutes,
            taskType: t.taskType,
            deliverable: t.deliverable,
            displayOrder: t.displayOrder,
          })),
        },
        blockers: {
          create: source.blockers.map((b) => ({
            description: b.description,
            isKey: b.isKey,
            status: b.status,
            displayOrder: b.displayOrder,
          })),
        },
        achievements: {
          create: source.achievements.map((a) => ({
            description: a.description,
            isKey: a.isKey,
            displayOrder: a.displayOrder,
          })),
        },
      },
      include: versionInclude,
    });
    return mapVersion(clone);
  }
  async submit(actor: AuthenticatedUser, id: string, dto: SubmitReportDto) {
    const { r, v } = await this.editable(
      actor,
      id,
      dto.versionId,
      dto.lockVersion,
    );
    if (!actor.permissions.includes('report:submit_own'))
      throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    if (
      !v.tasks.length &&
      !v.blockers.length &&
      !v.achievements.length &&
      !v.notes
    )
      throw new ApiError(
        400,
        'REPORT_VALIDATION_FAILED',
        'Report content is required.',
      );
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.reportVersion.update({
        where: { id: v.id },
        data: { submittedAt: now, lockVersion: { increment: 1 } },
      });
      await tx.report.update({ where: { id }, data: { status: 'SUBMITTED' } });
      const managers = await tx.user.findMany({
        where: {
          activatedAt: { not: null },
          deactivatedAt: null,
          role: {
            code: 'MANAGER_ADMIN',
            deletedAt: null,
            rolePermissions: {
              some: { permission: { code: 'report:read_team' } },
            },
          },
        },
        select: { id: true },
      });
      const notifications = await Promise.all(
        managers.map((manager) =>
          tx.notification.create({
            data: {
              recipientId: manager.id,
              actorId: actor.id,
              eventKey: v.id,
              type: r.versions.some((version) => version.submittedAt)
                ? 'REPORT_RESUBMITTED'
                : 'REPORT_SUBMITTED',
              reportVersionId: v.id,
              title: r.versions.some((version) => version.submittedAt)
                ? 'Report resubmitted'
                : 'Report submitted',
              message: `${r.member.firstName} ${r.member.lastName} submitted the report for ${dateOnly(r.weekStart)}.`,
            },
            select: { id: true },
          }),
        ),
      );
      const report = await tx.report.findUniqueOrThrow({
        where: { id },
        include: reportInclude,
      });
      return { report, notificationIds: notifications.map((notification) => notification.id) };
    });
    await Promise.all(
      result.notificationIds.map((notificationId) =>
        this.notifications.publish(notificationId),
      ),
    );
    return this.detail(result.report, actor);
  }
  async review(actor: AuthenticatedUser, id: string, dto: ReviewDto) {
    const r = await this.report(id);
    if (
      actor.role.code !== 'MANAGER_ADMIN' ||
      !actor.permissions.includes('report:review') ||
      !actor.permissions.includes('report:read_team')
    )
      throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    if (r.member.id === actor.id)
      throw new ApiError(
        403,
        'SELF_REVIEW_FORBIDDEN',
        'A manager cannot review their own report.',
      );
    const v = r.versions.find((x) => x.id === dto.versionId);
    if (!v || !v.submittedAt)
      throw new ApiError(
        409,
        'REPORT_NOT_SUBMITTED',
        'Report version is not submitted.',
      );
    if (r.versions[0]?.id !== v.id)
      throw new ApiError(
        409,
        'REPORT_NOT_SUBMITTED',
        'Only the latest submitted version can be reviewed.',
      );
    if (v.review)
      throw new ApiError(
        409,
        'REVIEW_ALREADY_RECORDED',
        'A review is already recorded.',
      );
    if (
      dto.decision === 'CHANGES_REQUESTED' &&
      (!dto.comment || !dto.comment.trim())
    )
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'A comment is required when requesting changes.',
      );
    const result = await this.prisma.$transaction(async (tx) => {
      const review = await tx.reportReview.create({
        data: {
          reportVersionId: v.id,
          reviewerId: actor.id,
          decision: dto.decision as never,
          comment: dto.comment ?? null,
        },
        include: {
          reviewer: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      await tx.report.update({
        where: { id },
        data: {
          status: dto.decision === 'APPROVED' ? 'APPROVED' : 'NEEDS_CORRECTION',
        },
      });
      const notification = await tx.notification.create({
        data: {
          recipientId: r.member.id,
          actorId: actor.id,
          eventKey: review.id,
          type:
            dto.decision === 'APPROVED'
              ? 'REPORT_APPROVED'
              : 'REPORT_NEEDS_CORRECTION',
          reportVersionId: v.id,
          reportReviewId: review.id,
          title:
            dto.decision === 'APPROVED'
              ? 'Report approved'
              : 'Changes requested',
          message: dto.comment ?? 'Your report was reviewed.',
        },
        select: { id: true },
      });
      return {
        report: await tx.report.findUniqueOrThrow({
          where: { id },
          include: reportInclude,
        }),
        review,
        notificationId: notification.id,
      };
    });
    await this.notifications.publish(result.notificationId);
    return {
      report: this.detail(result.report, actor),
      review: mapReview(result.review),
    };
  }
  async versions(actor: AuthenticatedUser, id: string, q: VersionsQueryDto) {
    const r = await this.report(id);
    const access = this.canRead(actor, r);
    const all = r.versions.filter((v) => access === 'own' || v.submittedAt);
    const total = all.length;
    return {
      data: all
        .slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
        .map((v) => ({
          id: v.id,
          reportId: v.reportId,
          versionNumber: v.versionNumber,
          lockVersion: v.lockVersion,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
          submittedAt: v.submittedAt?.toISOString() ?? null,
          review: mapReview(v.review),
        })),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  async version(actor: AuthenticatedUser, id: string, versionId: string) {
    const r = await this.report(id);
    const access = this.canRead(actor, r);
    const v = r.versions.find((x) => x.id === versionId);
    if (!v || (!v.submittedAt && access !== 'own'))
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    return mapVersion(v);
  }
}
