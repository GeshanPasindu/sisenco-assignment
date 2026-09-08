import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth-context';
import { ApiError } from '../common/api-error';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import type {
  AssignTaskDto,
  ArchiveTaskDto,
  CreateTaskDto,
  CreateTimeEntryDto,
  TaskQueryDto,
  TimeQueryDto,
  UpdateTaskDto,
  UpdateTimeEntryDto,
} from './task.dto';

const taskInclude = {
  project: { select: { id: true, name: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  timeEntries: { select: { minutes: true } },
} satisfies Prisma.TaskInclude;
const entryInclude = {
  task: {
    select: {
      id: true,
      name: true,
      project: { select: { id: true, name: true } },
    },
  },
  user: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TaskTimeEntryInclude;
const date = (v: string | null | undefined) =>
  v === null || v === undefined ? null : new Date(`${v}T00:00:00.000Z`);
const dateString = (v: Date | null) => v?.toISOString().slice(0, 10) ?? null;
const validDate = (v: string | null | undefined, field: string) => {
  if (v === null || v === undefined) return null;
  const d = date(v);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(v) ||
    !d ||
    Number.isNaN(d.getTime()) ||
    dateString(d) !== v
  )
    throw new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed.', [
      {
        field,
        code: 'INVALID_DATE',
        message: 'Must be a valid calendar date.',
      },
    ]);
  return d;
};
const mapPerson = (p: { id: string; firstName: string; lastName: string }) => p;
const mapTask = (
  t: Prisma.TaskGetPayload<{ include: typeof taskInclude }>,
) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  project: t.project,
  createdBy: mapPerson(t.creator),
  assignee: mapPerson(t.assignee),
  plannedDate: dateString(t.plannedDate),
  dueDate: dateString(t.dueDate),
  priority: t.priority,
  status: t.status,
  taskType: t.taskType,
  plannedCompletionPct: Number(t.plannedCompletionPct),
  actualCompletionPct: Number(t.actualCompletionPct),
  plannedMinutes: t.plannedMinutes,
  loggedMinutes: t.timeEntries.reduce((s, e) => s + e.minutes, 0),
  deliverable: t.deliverable,
  completedAt: t.completedAt?.toISOString() ?? null,
  lockVersion: t.lockVersion,
  archivedAt: t.archivedAt?.toISOString() ?? null,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
const mapEntry = (
  e: Prisma.TaskTimeEntryGetPayload<{ include: typeof entryInclude }>,
) => ({
  id: e.id,
  task: e.task,
  user: e.user,
  workDate: dateString(e.workDate),
  minutes: e.minutes,
  note: e.note,
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
});

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
  ) {}
  private canTeam(actor: AuthenticatedUser, permission: string) {
    return (
      actor.role.code === 'MANAGER_ADMIN' &&
      actor.permissions.includes(permission)
    );
  }
  private canOwn(actor: AuthenticatedUser, permission: string) {
    return actor.permissions.includes(permission);
  }
  private async hasProjectAccess(userId: string, projectId: string) {
    return !!(await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { members: { some: { userId } } },
          { tasks: { some: { assigneeId: userId } } },
        ],
      },
      select: { id: true },
    }));
  }
  private async isDirectProjectMember(userId: string, projectId: string) {
    return !!(await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { userId: true },
    }));
  }
  private async task(id: string) {
    const t = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    if (!t) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    return t;
  }
  private access(
    actor: AuthenticatedUser,
    t: Prisma.TaskGetPayload<{ include: typeof taskInclude }>,
    ownPermission: string,
    teamPermission: string,
  ) {
    if (t.assigneeId === actor.id && this.canOwn(actor, ownPermission))
      return 'own';
    if (this.canTeam(actor, teamPermission)) return 'team';
    throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
  }
  async list(actor: AuthenticatedUser, q: TaskQueryDto) {
    if (q.scope === 'team' && !this.canTeam(actor, 'task:manage_team'))
      throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    if (q.scope === 'own' && q.memberId)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    const where: Prisma.TaskWhereInput = {};
    where.assigneeId = q.scope === 'own' ? actor.id : q.memberId;
    if (q.projectId) where.projectId = q.projectId;
    if (q.status) where.status = q.status as never;
    if (q.archived === 'false') where.archivedAt = null;
    else if (q.archived === 'true') where.archivedAt = { not: null };
    if (q.fromDate || q.toDate)
      where.plannedDate = {
        ...(q.fromDate ? { gte: validDate(q.fromDate, 'fromDate')! } : {}),
        ...(q.toDate ? { lte: validDate(q.toDate, 'toDate')! } : {}),
      };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ plannedDate: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      data: rows.map(mapTask),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  async get(actor: AuthenticatedUser, id: string) {
    const t = await this.task(id);
    this.access(actor, t, 'task:read_own', 'task:manage_team');
    return mapTask(t);
  }
  async create(actor: AuthenticatedUser, dto: CreateTaskDto) {
    const assignee = dto.assigneeId ?? actor.id;
    const manager = this.canTeam(actor, 'task:manage_team');
    if (assignee !== actor.id && !manager)
      throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (project.archivedAt)
      throw new ApiError(
        409,
        'PROJECT_ARCHIVED',
        'Archived projects cannot receive tasks.',
      );
    if (!manager && !(await this.hasProjectAccess(actor.id, dto.projectId)))
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (
      manager &&
      assignee !== actor.id &&
      !(await this.isDirectProjectMember(assignee, dto.projectId))
    )
      throw new ApiError(
        409,
        'ASSIGNEE_NOT_PROJECT_MEMBER',
        'Assignee must be assigned to this project.',
      );
    const user = await this.prisma.user.findUnique({ where: { id: assignee } });
    if (!user || !user.activatedAt || user.deactivatedAt)
      throw new ApiError(409, 'ASSIGNEE_INACTIVE', 'Assignee is not active.');
    const planned = validDate(dto.plannedDate, 'plannedDate')!;
    const due = validDate(dto.dueDate, 'dueDate');
    if (due && due < planned)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    return mapTask(
      await this.prisma.task.create({
        data: {
          createdBy: actor.id,
          assigneeId: assignee,
          projectId: dto.projectId,
          name: dto.name,
          description: dto.description ?? null,
          plannedDate: planned,
          dueDate: due,
          priority: (dto.priority as never) ?? 'MEDIUM',
          taskType: (dto.taskType as never) ?? 'OTHER',
          plannedCompletionPct: dto.plannedCompletionPct ?? 100,
          plannedMinutes: dto.plannedMinutes ?? 0,
        },
        include: taskInclude,
      }),
    );
  }
  async update(actor: AuthenticatedUser, id: string, dto: UpdateTaskDto) {
    const t = await this.task(id);
    const branch = this.access(actor, t, 'task:update_own', 'task:manage_team');
    if (t.archivedAt)
      throw new ApiError(
        409,
        'TASK_ARCHIVED',
        'Archived tasks cannot be changed.',
      );
    if (dto.lockVersion !== t.lockVersion)
      throw new ApiError(409, 'STALE_VERSION', 'Task version is stale.', []);
    const keys = Object.keys(dto).filter((k) => k !== 'lockVersion');
    if (!keys.length)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    const planned =
      dto.plannedDate === undefined
        ? t.plannedDate
        : validDate(dto.plannedDate, 'plannedDate')!;
    const due =
      dto.dueDate === undefined ? t.dueDate : validDate(dto.dueDate, 'dueDate');
    if (due && due < planned)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    if (dto.projectId !== undefined) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
      });
      if (!project) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
      if (project.archivedAt)
        throw new ApiError(
          409,
          'PROJECT_ARCHIVED',
          'Archived projects cannot receive tasks.',
        );
      if (
        branch === 'own' &&
        !(await this.hasProjectAccess(actor.id, dto.projectId))
      )
        throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    }
    const status =
      dto.actualCompletionPct === 100 ? 'COMPLETED' : (dto.status ?? t.status);
    const data = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
      ...(dto.plannedDate !== undefined ? { plannedDate: planned } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.dueDate !== undefined ? { dueDate: due } : {}),
      ...(dto.priority !== undefined
        ? { priority: dto.priority as never }
        : {}),
      ...(dto.taskType !== undefined
        ? { taskType: dto.taskType as never }
        : {}),
      ...(dto.plannedCompletionPct !== undefined
        ? { plannedCompletionPct: dto.plannedCompletionPct }
        : {}),
      ...(dto.plannedMinutes !== undefined
        ? { plannedMinutes: dto.plannedMinutes }
        : {}),
      ...(dto.status !== undefined || dto.actualCompletionPct === 100
        ? { status: status as never }
        : {}),
      ...(dto.actualCompletionPct !== undefined
        ? { actualCompletionPct: dto.actualCompletionPct }
        : {}),
      ...(dto.deliverable !== undefined
        ? { deliverable: dto.deliverable }
        : {}),
      lockVersion: { increment: 1 },
      completedAt:
        status === 'COMPLETED'
          ? new Date()
          : status !== 'COMPLETED'
            ? null
            : t.completedAt,
    };
    return mapTask(
      await this.prisma.task.update({
        where: { id },
        data,
        include: taskInclude,
      }),
    );
  }
  async assign(actor: AuthenticatedUser, id: string, dto: AssignTaskDto) {
    const t = await this.task(id);
    if (t.archivedAt)
      throw new ApiError(
        409,
        'TASK_ARCHIVED',
        'Archived tasks cannot be changed.',
      );
    if (dto.lockVersion !== t.lockVersion)
      throw new ApiError(409, 'STALE_VERSION', 'Task version is stale.');
    if (dto.assigneeId === t.assigneeId) return mapTask(t);
    const user = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
    });
    if (!user || !user.activatedAt || user.deactivatedAt)
      throw new ApiError(409, 'ASSIGNEE_INACTIVE', 'Assignee is not active.');
    if (!(await this.isDirectProjectMember(dto.assigneeId, t.projectId)))
      throw new ApiError(
        409,
        'ASSIGNEE_NOT_PROJECT_MEMBER',
        'Assignee must be assigned to this project.',
      );
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id, lockVersion: dto.lockVersion },
        data: { assigneeId: dto.assigneeId, lockVersion: { increment: 1 } },
        include: taskInclude,
      });
      const notification = await tx.notification.create({
        data: {
          recipientId: dto.assigneeId,
          actorId: actor.id,
          eventKey: updated.id,
          type: 'TASK_ASSIGNED',
          taskId: updated.id,
          title: 'Task assigned',
          message: `You were assigned: ${updated.name}`,
        },
        select: { id: true },
      });
      return { task: updated, notificationId: notification.id };
    });
    await this.notifications.publish(result.notificationId);
    return mapTask(result.task);
  }
  async archive(actor: AuthenticatedUser, id: string, dto: ArchiveTaskDto) {
    const t = await this.task(id);
    this.access(actor, t, 'task:update_own', 'task:manage_team');
    if (t.archivedAt && dto.lockVersion === t.lockVersion) return mapTask(t);
    if (dto.lockVersion !== t.lockVersion)
      throw new ApiError(409, 'STALE_VERSION', 'Task version is stale.');
    return mapTask(
      await this.prisma.task.update({
        where: { id },
        data: { archivedAt: new Date(), lockVersion: { increment: 1 } },
        include: taskInclude,
      }),
    );
  }
  async entries(actor: AuthenticatedUser, q: TimeQueryDto) {
    if (q.scope === 'team' && !this.canTeam(actor, 'time:read_team'))
      throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    if (q.scope === 'own' && q.memberId)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    const where: Prisma.TaskTimeEntryWhereInput = {
      userId: q.scope === 'own' ? actor.id : q.memberId,
      ...(q.taskId ? { taskId: q.taskId } : {}),
      ...(q.projectId ? { task: { projectId: q.projectId } } : {}),
    };
    if (q.fromDate || q.toDate)
      where.workDate = {
        ...(q.fromDate ? { gte: validDate(q.fromDate, 'fromDate')! } : {}),
        ...(q.toDate ? { lte: validDate(q.toDate, 'toDate')! } : {}),
      };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.taskTimeEntry.count({ where }),
      this.prisma.taskTimeEntry.findMany({
        where,
        include: entryInclude,
        orderBy: [{ workDate: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      data: rows.map(mapEntry),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  private async dailyTotal(userId: string, workDate: Date, exclude?: string) {
    const x = await this.prisma.taskTimeEntry.aggregate({
      where: { userId, workDate, ...(exclude ? { id: { not: exclude } } : {}) },
      _sum: { minutes: true },
    });
    return x._sum.minutes ?? 0;
  }
  async createEntry(
    actor: AuthenticatedUser,
    taskId: string,
    dto: CreateTimeEntryDto,
  ) {
    const t = await this.task(taskId);
    if (t.assigneeId !== actor.id || !this.canOwn(actor, 'time:manage_own'))
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (t.archivedAt)
      throw new ApiError(
        409,
        'TASK_ARCHIVED',
        'Archived tasks cannot receive time entries.',
      );
    const work = validDate(dto.workDate, 'workDate')!;
    if ((await this.dailyTotal(actor.id, work)) + dto.minutes > 1440)
      throw new ApiError(409, 'DAILY_TIME_LIMIT', 'Daily time limit exceeded.');
    return mapEntry(
      await this.prisma.taskTimeEntry.create({
        data: {
          taskId,
          userId: actor.id,
          workDate: work,
          minutes: dto.minutes,
          note: dto.note ?? null,
        },
        include: entryInclude,
      }),
    );
  }
  async updateEntry(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateTimeEntryDto,
  ) {
    const e = await this.prisma.taskTimeEntry.findUnique({
      where: { id },
      include: entryInclude,
    });
    if (!e || e.userId !== actor.id)
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (!Object.keys(dto).length)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    const work =
      dto.workDate === undefined
        ? e.workDate
        : validDate(dto.workDate, 'workDate')!;
    const minutes = dto.minutes ?? e.minutes;
    if ((await this.dailyTotal(actor.id, work, id)) + minutes > 1440)
      throw new ApiError(409, 'DAILY_TIME_LIMIT', 'Daily time limit exceeded.');
    return mapEntry(
      await this.prisma.taskTimeEntry.update({
        where: { id },
        data: {
          ...(dto.workDate !== undefined ? { workDate: work } : {}),
          ...(dto.minutes !== undefined ? { minutes } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
        include: entryInclude,
      }),
    );
  }
  async deleteEntry(actor: AuthenticatedUser, id: string) {
    const e = await this.prisma.taskTimeEntry.findUnique({ where: { id } });
    if (!e || e.userId !== actor.id)
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    await this.prisma.taskTimeEntry.delete({ where: { id } });
  }
}
