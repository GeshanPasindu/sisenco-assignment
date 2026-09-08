/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DashboardService } from './dashboard.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth-context';

const actor: AuthenticatedUser = {
  id: 'user-1',
  sessionId: 'session-1',
  role: { id: 'role-1', code: 'TEAM_MEMBER', name: 'Team Member' },
  permissions: ['dashboard:read_own'],
};
function fixture() {
  const prisma = {
    report: { findUnique: jest.fn(), findMany: jest.fn() },
    reportVersion: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  } as unknown as PrismaService;
  return { prisma, service: new DashboardService(prisma) };
}

describe('DashboardService', () => {
  it('returns a create-report action and zero-filled trend when no report exists', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.report, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.reportVersion, 'findMany').mockResolvedValue([]);
    const result = await service.me(actor, {
      weekStart: '2026-09-07',
      trendWeeks: 3,
    });
    expect(result.primaryAction).toBe('CREATE_REPORT');
    expect(result.currentReport).toBeNull();
    expect(result.tasksCompletedTrend).toEqual([
      { weekStart: '2026-08-24', completedTasks: 0 },
      { weekStart: '2026-08-31', completedTasks: 0 },
      { weekStart: '2026-09-07', completedTasks: 0 },
    ]);
  });

  it('rejects non-Monday dashboard dates', async () => {
    const { service } = fixture();
    await expect(
      service.me(actor, { weekStart: '2026-09-08', trendWeeks: 6 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    });
  });

  it('returns an empty team dashboard for no eligible members', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.user, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.report, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.reportVersion, 'findMany').mockResolvedValue([]);
    const result = await service.team(
      {
        ...actor,
        role: { ...actor.role, code: 'MANAGER_ADMIN' },
        permissions: ['dashboard:read_team'],
      },
      { weekStart: '2026-09-07', trendWeeks: 1 },
    );
    expect(result.summary.expectedReports).toBe(0);
    expect(result.summary.submissionRatePct).toBeNull();
    expect(result.reportStatusByMember).toEqual([]);
  });
});
