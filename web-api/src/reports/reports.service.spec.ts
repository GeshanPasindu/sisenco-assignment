/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ReportsService } from './reports.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsGateway } from '../notifications/notifications.gateway';
import type { AuthenticatedUser } from '../auth/auth-context';

const owner: AuthenticatedUser = {
  id: 'user-1',
  sessionId: 'session-1',
  role: { id: 'role-1', code: 'TEAM_MEMBER', name: 'Team Member' },
  permissions: ['report:read_own', 'report:update_own', 'report:submit_own'],
};
const manager: AuthenticatedUser = {
  id: 'manager-1',
  sessionId: 'session-2',
  role: { id: 'role-2', code: 'MANAGER_ADMIN', name: 'Manager' },
  permissions: ['report:read_team', 'report:review'],
};
function fixture() {
  const prisma = {
    report: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    reportVersion: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reportReview: { create: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const notifications = {
    publish: jest.fn(),
  } as unknown as NotificationsGateway;
  return {
    prisma,
    notifications,
    service: new ReportsService(prisma, notifications),
  };
}

describe('ReportsService', () => {
  it('returns not-found for an unknown report without leaking identifiers', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.report, 'findUnique').mockResolvedValue(null);
    await expect(service.get(owner, 'report-1')).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    });
  });

  it('prevents a manager from reviewing their own report', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
      member: { id: manager.id, firstName: 'Manager', lastName: 'User' },
      versions: [],
    } as never);
    await expect(
      service.review(manager, 'report-1', {
        versionId: 'version-1',
        decision: 'APPROVED',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SELF_REVIEW_FORBIDDEN' }),
    });
  });

  it('rejects correction creation unless the report needs correction', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
      member: { id: owner.id, firstName: 'Member', lastName: 'User' },
      status: 'SUBMITTED',
      versions: [],
    } as never);
    await expect(service.correction(owner, 'report-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CORRECTION_NOT_ALLOWED' }),
    });
  });

  it('does not allow deletion once a report has been submitted', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
      id: 'report-1',
      member: { id: owner.id, firstName: 'Member', lastName: 'User' },
      status: 'SUBMITTED',
      versions: [{ id: 'version-1', submittedAt: new Date() }],
    } as never);
    await expect(service.remove(owner, 'report-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REPORT_NOT_DELETABLE' }),
    });
  });

  it('rejects creation of a report for a future week', async () => {
    const { service } = fixture();
    const future = new Date();
    const day = future.getUTCDay();
    future.setUTCHours(0, 0, 0, 0);
    future.setUTCDate(future.getUTCDate() + (day === 0 ? 1 : 8 - day));

    await expect(
      service.create(owner, { weekStart: future.toISOString().slice(0, 10) }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FUTURE_REPORT_NOT_ALLOWED' }),
    });
  });
});
