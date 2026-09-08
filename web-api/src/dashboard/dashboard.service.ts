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
              where: { status: { not: null }, section: 'THIS_WEEK' },
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
        report: { select: { id: true, weekStart: true } },
        tasks: { where: { status: 'COMPLETED', section: 'THIS_WEEK' }, select: { id: true } },
      },
    });
    const latestTrendVersions = new Map<string, (typeof versions)[number]>();
    for (const version of versions) {
      const previous = latestTrendVersions.get(version.report.id);
      if (!previous || version.submittedAt! > previous.submittedAt!) latestTrendVersions.set(version.report.id, version);
    }
    const trend = trendWeeks.map((w) => {
      const key = dateOnly(w);
      return {
        weekStart: key,
        completedTasks: Array.from(latestTrendVersions.values())
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
              include: {
                tasks: {
                  select: {
                    status: true,
                    actualMinutes: true,
                    projectId: true,
                    taskType: true,
                    project: { select: { id: true, name: true } },
                  },
                  where: { status: { not: null }, section: 'THIS_WEEK' },
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
      const latest = r?.versions[0];
      const firstSubmittedAt = r?.versions.reduce<Date | undefined>((first, version) => !first || version.submittedAt! < first ? version.submittedAt! : first, undefined);
      const timing = firstSubmittedAt
        ? firstSubmittedAt <= deadline(week)
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
        firstSubmittedAt: firstSubmittedAt?.toISOString() ?? null,
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
    // Charts are report analytics, rather than compliance analytics.  A
    // submitted report must remain visible even when its member has no
    // reporting-period record (for example, a legacy/optional report).
    const submittedReports = await this.prisma.report.findMany({
      where: {
        weekStart: week,
        ...(q.memberId ? { memberId: q.memberId } : {}),
        versions: { some: { submittedAt: { not: null } } },
      },
      select: {
        id: true,
        status: true,
        member: { select: { id: true, firstName: true, lastName: true } },
        versions: {
          where: { submittedAt: { not: null } },
          orderBy: { submittedAt: 'desc' },
          select: { id: true, submittedAt: true },
        },
      },
    });
    for (const report of submittedReports) {
      if (reportRows.some((row) => row.member.id === report.member.id)) continue;
      const firstSubmittedAt = report.versions.at(-1)?.submittedAt ?? null;
      reportRows.push({
        member: person(report.member),
        weekStart: dateOnly(week),
        reportId: report.id,
        reportState: report.status,
        submissionTiming: firstSubmittedAt && firstSubmittedAt <= deadline(week) ? 'ON_TIME' : 'LATE',
        deadlineAt: deadline(week).toISOString(),
        firstSubmittedAt: firstSubmittedAt?.toISOString() ?? null,
      });
    }
    const versionIds = submittedReports.flatMap((report) => report.versions[0]?.id ?? []);
    const versions = await this.prisma.reportVersion.findMany({
      where: { id: { in: versionIds } },
      include: {
        blockers: { select: { status: true } },
        tasks: {
          where: { section: 'THIS_WEEK', ...(q.projectId ? { projectId: q.projectId } : {}) },
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
        const id = t.projectId ?? 'none';
        const name = t.project?.name ?? t.projectNameSnapshot ?? 'Unassigned';
        const item = tasksByProjectMap.get(id) ?? { id, name, count: 0 };
        item.count++;
        tasksByProjectMap.set(id, item);
        if (t.actualMinutes !== null)
          timeByType.set(
            t.taskType,
            (timeByType.get(t.taskType) ?? 0) + t.actualMinutes,
          );
      }
    const trendWeeks = weeks(week, q.trendWeeks);
    const trendVersions = await this.prisma.reportVersion.findMany({
      where: { submittedAt: { not: null }, report: { weekStart: { gte: trendWeeks[0], lte: week }, ...(q.memberId ? { memberId: q.memberId } : {}) } },
      include: { report: { select: { id: true, weekStart: true } }, tasks: { where: { status: 'COMPLETED', section: 'THIS_WEEK', ...(q.projectId ? { projectId: q.projectId } : {}) }, select: { id: true } } },
    });
    const latestTrend = new Map<string, (typeof trendVersions)[number]>();
    for (const version of trendVersions) { const old = latestTrend.get(version.report.id); if (!old || version.submittedAt! > old.submittedAt!) latestTrend.set(version.report.id, version); }
    const trend = trendWeeks.map((w) => ({ weekStart: dateOnly(w), completedTasks: Array.from(latestTrend.values()).filter((v) => dateOnly(v.report.weekStart) === dateOnly(w)).reduce((sum, v) => sum + v.tasks.length, 0) }));
    const expected = eligible.length;
    return {
      period: period(week),
      summary: {
        submittedReports: submittedReports.length,
        expectedReports: expected,
        eligibleSubmittedReports: submitted.length,
        submissionRatePct: expected
          ? Number(((submitted.length / expected) * 100).toFixed(2))
          : null,
        onTimeRatePct: expected
          ? Number(((onTime / expected) * 100).toFixed(2))
          : null,
        onTime,
        late,
        pending,
        overdue,
        needsCorrectionCount: submittedReports.filter(
          (r) => r.status === 'NEEDS_CORRECTION',
        ).length,
        openBlockerCount: versions.reduce(
          (sum, version) => sum + version.blockers.filter((blocker) => blocker.status === 'OPEN').length,
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
      where: { submittedAt: { not: null }, report: reportWhere },
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
          eventType: v.versionNumber === 1 ? 'REPORT_SUBMITTED' : 'REPORT_RESUBMITTED',
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
      .filter((event) => event.eventAt >= from && event.eventAt <= to)
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
