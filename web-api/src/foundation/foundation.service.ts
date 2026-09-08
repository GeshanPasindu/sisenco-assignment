import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/api-error';
import type { AuthenticatedUser } from '../auth/auth-context';
import type {
  CreateProjectDto,
  ProjectsQueryDto,
  UpdateProjectDto,
} from './foundation.dto';

const dateOnly = (value: string | null | undefined) =>
  value === null || value === undefined
    ? null
    : new Date(`${value}T00:00:00.000Z`);
const formatDate = (value: Date | null) =>
  value?.toISOString().slice(0, 10) ?? null;
const mapProject = (p: Prisma.ProjectGetPayload<object>) => ({
  id: p.id,
  name: p.name,
  clientName: p.clientName,
  description: p.description,
  startDate: formatDate(p.startDate),
  endDate: formatDate(p.endDate),
  archivedAt: p.archivedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});
const parseDate = (value: string | null | undefined, field: string) => {
  if (value === null || value === undefined) return null;
  const date = dateOnly(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    !date ||
    Number.isNaN(date.getTime()) ||
    formatDate(date) !== value
  )
    throw new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed.', [
      {
        field,
        code: 'INVALID_DATE',
        message: 'Must be a valid calendar date.',
      },
    ]);
  return date;
};

@Injectable()
export class FoundationService {
  constructor(private readonly prisma: PrismaService) {}
  health() {
    return { status: 'ok' };
  }
  referenceData() {
    const now = new Date();
    const day = now.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    now.setUTCHours(0, 0, 0, 0);
    now.setUTCDate(now.getUTCDate() + offset);
    return {
      taskStatuses: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'],
      taskPriorities: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      taskTypes: [
        'DEVELOPMENT',
        'TESTING',
        'MEETINGS',
        'DOCUMENTATION',
        'OTHER',
      ],
      taskSections: ['THIS_WEEK', 'NEXT_WEEK'],
      reportStatuses: ['DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED'],
      reviewDecisions: ['APPROVED', 'CHANGES_REQUESTED'],
      blockerStatuses: ['OPEN', 'RESOLVED'],
      accountStatuses: ['INVITED', 'ACTIVE', 'DEACTIVATED'],
      submissionTimings: ['ON_TIME', 'LATE', 'PENDING', 'OVERDUE'],
      notificationTypes: [
        'REPORT_SUBMITTED',
        'REPORT_RESUBMITTED',
        'REPORT_APPROVED',
        'REPORT_NEEDS_CORRECTION',
        'TASK_ASSIGNED',
      ],
      reportingPolicy: {
        timezone: 'Asia/Colombo',
        weekStartsOn: 1,
        deadlineDaysAfterWeekStart: 7,
        deadlineLocalTime: '12:00',
        currentWeekStart: formatDate(now),
      },
    };
  }
  roles() {
    return this.prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }
  private isProjectManager(actor: AuthenticatedUser) {
    return (
      actor.role.code === 'MANAGER_ADMIN' &&
      actor.permissions.includes('project:manage')
    );
  }
  private async assertProjectVisible(actor: AuthenticatedUser, id: string) {
    if (this.isProjectManager(actor)) return;
    const visible = await this.prisma.project.findFirst({
      where: {
        id,
        OR: [
          { members: { some: { userId: actor.id } } },
          { tasks: { some: { assigneeId: actor.id } } },
        ],
      },
      select: { id: true },
    });
    if (!visible) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
  }
  async listProjects(actor: AuthenticatedUser, query: ProjectsQueryDto) {
    const where: Prisma.ProjectWhereInput = {};
    if (query.archived === 'false') where.archivedAt = null;
    else if (query.archived === 'true') where.archivedAt = { not: null };
    if (query.q)
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { clientName: { contains: query.q, mode: 'insensitive' } },
      ];
    if (!this.isProjectManager(actor)) {
      where.OR = [
        { members: { some: { userId: actor.id } } },
        { tasks: { some: { assigneeId: actor.id } } },
      ];
      if (query.q)
        where.AND = [
          {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { clientName: { contains: query.q, mode: 'insensitive' } },
            ],
          },
        ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      data: rows.map(mapProject),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
        hasMore: query.page * query.pageSize < total,
      },
    };
  }
  async getProject(actor: AuthenticatedUser, id: string) {
    await this.assertProjectVisible(actor, id);
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    return mapProject(p);
  }
  async createProject(dto: CreateProjectDto) {
    const start = parseDate(dto.startDate, 'startDate');
    const end = parseDate(dto.endDate, 'endDate');
    if (start && end && start > end)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        [
          {
            field: 'endDate',
            code: 'OUT_OF_RANGE',
            message: 'Must be on or after startDate.',
          },
        ],
      );
    return mapProject(
      await this.prisma.project.create({
        data: {
          name: dto.name,
          clientName: dto.clientName ?? null,
          description: dto.description ?? null,
          startDate: start,
          endDate: end,
        },
      }),
    );
  }
  async updateProject(id: string, dto: UpdateProjectDto) {
    if (!Object.keys(dto).length)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    const current = await this.prisma.project.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (current.archivedAt)
      throw new ApiError(
        409,
        'PROJECT_ARCHIVED',
        'Archived projects cannot be changed.',
      );
    const start =
      dto.startDate === undefined
        ? current.startDate
        : parseDate(dto.startDate, 'startDate');
    const end =
      dto.endDate === undefined
        ? current.endDate
        : parseDate(dto.endDate, 'endDate');
    if (start && end && start > end)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    return mapProject(
      await this.prisma.project.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.clientName !== undefined
            ? { clientName: dto.clientName }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.startDate !== undefined ? { startDate: start } : {}),
          ...(dto.endDate !== undefined ? { endDate: end } : {}),
        },
      }),
    );
  }
  async archiveProject(id: string) {
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (p.archivedAt) return mapProject(p);
    return mapProject(
      await this.prisma.project.update({
        where: { id },
        data: { archivedAt: new Date() },
      }),
    );
  }
  async members(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
    return rows.map(({ user }) => user);
  }
  async setMembers(id: string, memberIds: string[]) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, archivedAt: true },
    });
    if (!project) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    if (project.archivedAt)
      throw new ApiError(
        409,
        'PROJECT_ARCHIVED',
        'Archived projects cannot be changed.',
      );
    const ids = [...new Set(memberIds)];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        activatedAt: { not: null },
        deactivatedAt: null,
      },
      select: { id: true },
    });
    if (users.length !== ids.length)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        [
          {
            field: 'memberIds',
            code: 'INVALID_VALUE',
            message: 'Members must be active users.',
          },
        ],
      );
    await this.prisma.$transaction([
      this.prisma.projectMember.deleteMany({ where: { projectId: id } }),
      ...(ids.length
        ? [
            this.prisma.projectMember.createMany({
              data: ids.map((userId) => ({ projectId: id, userId })),
            }),
          ]
        : []),
    ]);
    return this.members(id);
  }
}
