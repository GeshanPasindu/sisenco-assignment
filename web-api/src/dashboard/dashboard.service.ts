import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth-context';
import { ApiError } from '../common/api-error';
import type {
  ActivityQueryDto,
  DashboardQueryDto,
  TeamDashboardQueryDto,
} from './dashboard.dto';

const date = (v: string) => new Date(`${v}T00:00:00.000Z`);
const dateOnly = (v: Date) => v.toISOString().slice(0, 10);
const currentMonday = () => {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d;
};
const monday = (value: string | undefined) => {
  const d = value ? date(value) : currentMonday();
  if (
    (value && !/^\d{4}-\d{2}-\d{2}$/u.test(value)) ||
    Number.isNaN(d.getTime()) ||
    d.getUTCDay() !== 1 ||
    (dateOnly(d) !== value && value !== undefined)
  )
    throw new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed.');
  return d;
};
const endWeek = (d: Date) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + 6);
  return x;
};
const deadline = (d: Date) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + 7);
  x.setUTCHours(6, 30, 0, 0);
  return x;
};
const person = (u: { id: string; firstName: string; lastName: string }) => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
});
const period = (week: Date) => ({
  weekStart: dateOnly(week),
  weekEnd: dateOnly(endWeek(week)),
  deadlineAt: deadline(week).toISOString(),
  timezone: 'Asia/Colombo',
});
const weeks = (end: Date, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (count - 1 - i) * 7);
    return d;
  });

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async me(actor: AuthenticatedUser, q: DashboardQueryDto) {
    const week = monday(q.weekStart);
    const report = await this.prisma.report.findUnique({
      where: { memberId_weekStart: { memberId: actor.id, weekStart: week } },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            tasks: {
              select: { status: true, actualMinutes: true },
              where: { status: { not: null } },
            },
            blockers: { select: { status: true } },
          },
        },
      },
    });
    const editable = report?.versions.find((v) => !v.submittedAt);
    const submitted = report?.versions.find((v) => v.submittedAt);
    const source = editable ?? submitted;
    const action = report
      ? report.status === 'DRAFT'
        ? 'CONTINUE_EDITING'
        : report.status === 'NEEDS_CORRECTION'
          ? 'MAKE_CORRECTIONS'
          : 'VIEW_REPORT'
      : 'CREATE_REPORT';
    const metrics = {
      dataSource: editable ? 'EDITABLE' : submitted ? 'SUBMITTED' : 'NONE',
      completedTasks:
        source?.tasks.filter((t) => t.status === 'COMPLETED').length ?? 0,
      actualMinutes:
        source?.tasks.reduce((s, t) => s + (t.actualMinutes ?? 0), 0) ?? 0,
      openBlockers:
        source?.blockers.filter((b) => b.status === 'OPEN').length ?? 0,
    };
    const trendWeeks = weeks(week, q.trendWeeks);
    const versions = await this.prisma.reportVersion.findMany({
      where: {
        submittedAt: { not: null },
        report: {
          memberId: actor.id,
          weekStart: { gte: trendWeeks[0], lte: week },
        },
      },
      include: {
        report: { select: { weekStart: true } },
        tasks: { where: { status: 'COMPLETED' }, select: { id: true } },
      },
    });
    const trend = trendWeeks.map((w) => {
      const key = dateOnly(w);
      return {
        weekStart: key,
        completedTasks: versions
          .filter((v) => dateOnly(v.report.weekStart) === key)
          .reduce((s, v) => s + v.tasks.length, 0),
      };
    });
    return {
      period: period(week),
      currentReport: report
        ? {
            id: report.id,
            status: report.status,
            versionId: (editable ?? submitted)!.id,
            action,
          }
        : null,
      primaryAction: action,
      metrics,
      tasksCompletedTrend: trend,
    };
  }
  private async eligible(week: Date, memberId?: string) {
    return this.prisma.user.findMany({
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
        ...(memberId ? { id: memberId } : {}),
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
              include: {
                tasks: {
                  select: {
                    status: true,
                    actualMinutes: true,
                    projectId: true,
                    taskType: true,
                    project: { select: { id: true, name: true } },
                  },
                  where: { status: { not: null } },
                },
                blockers: { select: { status: true } },
              },
            },
          },
        },
      },
    });
  }
  async team(actor: AuthenticatedUser, q: TeamDashboardQueryDto) {
    const week = monday(q.weekStart);
    const eligible = await this.eligible(week, q.memberId);
    const reportRows = eligible.map((u) => {
      const r = u.reports[0];
      const v = r?.versions[0];
      const timing = v?.submittedAt
        ? v.submittedAt <= deadline(week)
          ? 'ON_TIME'
          : 'LATE'
        : new Date() > deadline(week)
          ? 'OVERDUE'
          : 'PENDING';
      return {
        member: person(u),
        weekStart: dateOnly(week),
        reportId: r?.id ?? null,
        reportState: r?.status ?? 'NOT_STARTED',
        submissionTiming: timing,
        deadlineAt: deadline(week).toISOString(),
        firstSubmittedAt: v?.submittedAt?.toISOString() ?? null,
      };
    });
    const submitted = reportRows.filter((r) => r.firstSubmittedAt);
    const onTime = submitted.filter(
      (r) => r.submissionTiming === 'ON_TIME',
    ).length;
    const late = submitted.filter((r) => r.submissionTiming === 'LATE').length;
    const pending = reportRows.filter(
      (r) => r.submissionTiming === 'PENDING',
    ).length;
    const overdue = reportRows.filter(
      (r) => r.submissionTiming === 'OVERDUE',
    ).length;
    const versionIds = eligible.flatMap(
      (u) => u.reports[0]?.versions[0]?.id ?? [],
    );
    const versions = await this.prisma.reportVersion.findMany({
      where: { id: { in: versionIds } },
      include: {
        tasks: {
          where: q.projectId ? { projectId: q.projectId } : undefined,
          select: {
            status: true,
            projectId: true,
            projectNameSnapshot: true,
            actualMinutes: true,
            taskType: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });
    const tasksByProjectMap = new Map<
      string,
      { id: string; name: string; count: number }
    >();
    const timeByType = new Map<string, number>();
    for (const v of versions)
      for (const t of v.tasks) {
        if (t.status === 'COMPLETED') {
          const id = t.projectId ?? 'none';
          const name = t.project?.name ?? t.projectNameSnapshot ?? 'Unassigned';
          const item = tasksByProjectMap.get(id) ?? { id, name, count: 0 };
          item.count++;
          tasksByProjectMap.set(id, item);
        }
        if (t.actualMinutes !== null)
          timeByType.set(
            t.taskType,
            (timeByType.get(t.taskType) ?? 0) + t.actualMinutes,
          );
      }
    const trendWeeks = weeks(week, q.trendWeeks);
    const trend = await Promise.all(
      trendWeeks.map(async (w) => {
        const vs = await this.prisma.reportVersion.findMany({
          where: {
            submittedAt: { not: null },
            report: {
              weekStart: w,
              ...(q.memberId ? { memberId: q.memberId } : {}),
            },
            tasks: {
              some: q.projectId
                ? { projectId: q.projectId, status: 'COMPLETED' }
                : { status: 'COMPLETED' },
            },
          },
          include: {
            tasks: {
              where: q.projectId
                ? { projectId: q.projectId, status: 'COMPLETED' }
                : { status: 'COMPLETED' },
              select: { id: true },
            },
          },
        });
        return {
          weekStart: dateOnly(w),
          completedTasks: vs.reduce((s, v) => s + v.tasks.length, 0),
        };
      }),
    );
    const expected = reportRows.length;
    return {
      period: period(week),
      summary: {
        submittedReports: submitted.length,
        expectedReports: expected,
        eligibleSubmittedReports: submitted.length,
        submissionRatePct: expected
          ? Number(((submitted.length / expected) * 100).toFixed(2))
          : null,
        onTimeRatePct: submitted.length
          ? Number(((onTime / submitted.length) * 100).toFixed(2))
          : null,
        onTime,
        late,
        pending,
        overdue,
        needsCorrectionCount: reportRows.filter(
          (r) => r.reportState === 'NEEDS_CORRECTION',
        ).length,
        openBlockerCount: eligible.reduce(
          (sum, user) =>
            sum +
            (user.reports[0]?.versions[0]?.blockers.filter(
              (blocker) => blocker.status === 'OPEN',
            ).length ?? 0),
          0,
        ),
      },
      tasksCompletedTrend: trend,
      reportStatusByMember: reportRows,
      tasksByProject: Array.from(tasksByProjectMap.values()).map((x) => ({
        project: { id: x.id, name: x.name },
        taskCount: x.count,
      })),
      timeByTaskType: Array.from(timeByType.entries()).map(
        ([taskType, actualMinutes]) => ({ taskType, actualMinutes }),
      ),
      appliedFilters: {
        weekStart: dateOnly(week),
        memberId: q.memberId ?? null,
        projectId: q.projectId ?? null,
        trendWeeks: q.trendWeeks,
        projectFilterAppliesTo: [
          'tasksCompletedTrend',
          'tasksByProject',
          'timeByTaskType',
        ],
      },
    };
  }
  private async activity(
    actor: AuthenticatedUser,
    q: ActivityQueryDto,
    team: boolean,
  ) {
    const from = q.fromDate ? date(q.fromDate) : new Date(0);
    const to = q.toDate ? new Date(`${q.toDate}T23:59:59.999Z`) : new Date();
    if (q.fromDate && q.toDate && from > to)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    const reportWhere = team
      ? q.memberId
        ? { memberId: q.memberId }
        : {}
      : { memberId: actor.id };
    const versions = await this.prisma.reportVersion.findMany({
      where: { submittedAt: { gte: from, lte: to }, report: reportWhere },
      include: {
        report: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        review: {
          include: {
            reviewer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    const events = versions
      .flatMap((v) => {
        const base = {
          reportId: v.report.id,
          reportVersionId: v.id,
          versionNumber: v.versionNumber,
          weekStart: dateOnly(v.report.weekStart),
          member: person(v.report.member),
        };
        const submitted = {
          id: v.id,
          eventType: 'REPORT_SUBMITTED',
          eventAt: v.submittedAt!,
          actor: person(v.report.member),
          ...base,
          reviewId: null,
          comment: null,
        };
        const review = v.review
          ? {
              id: v.review.id,
              eventType:
                v.review.decision === 'APPROVED'
                  ? 'REPORT_APPROVED'
                  : 'REPORT_NEEDS_CORRECTION',
              eventAt: v.review.createdAt,
              actor: person(v.review.reviewer),
              ...base,
              reviewId: v.review.id,
              comment: v.review.comment,
            }
          : null;
        return review ? [submitted, review] : [submitted];
      })
      .sort(
        (a, b) =>
          b.eventAt.getTime() - a.eventAt.getTime() ||
          a.eventType.localeCompare(b.eventType) ||
          b.id.localeCompare(a.id),
      );
    const total = events.length;
    return {
      data: events
        .slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
        .map((e) => ({ ...e, eventAt: e.eventAt.toISOString() })),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  activityMe(actor: AuthenticatedUser, q: ActivityQueryDto) {
    return this.activity(actor, q, false);
  }
  activityTeam(actor: AuthenticatedUser, q: ActivityQueryDto) {
    return this.activity(actor, q, true);
  }
}
