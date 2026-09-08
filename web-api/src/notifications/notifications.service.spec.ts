/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { NotificationsService } from './notifications.service';
import { ApiError } from '../common/api-error';
import type { AuthenticatedUser } from '../auth/auth-context';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsGateway } from './notifications.gateway';

const actor: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  sessionId: '00000000-0000-4000-8000-000000000002',
  role: {
    id: '00000000-0000-4000-8000-000000000003',
    code: 'TEAM_MEMBER',
    name: 'Team Member',
  },
  permissions: ['notification:read_own', 'notification:update_own'],
};
const notification = (recipientId = actor.id, readAt: Date | null = null) => ({
  id: '00000000-0000-4000-8000-000000000010',
  recipientId,
  actor: { id: actor.id, firstName: 'Nimal', lastName: 'Perera' },
  title: 'Changes requested',
  message: 'Please update the report.',
  type: 'REPORT_NEEDS_CORRECTION',
  reportVersionId: '00000000-0000-4000-8000-000000000011',
  reportReviewId: '00000000-0000-4000-8000-000000000012',
  taskId: null,
  reportVersion: {
    id: '00000000-0000-4000-8000-000000000011',
    reportId: '00000000-0000-4000-8000-000000000013',
  },
  reportReview: { id: '00000000-0000-4000-8000-000000000012' },
  task: null,
  createdAt: new Date('2026-09-08T10:00:00.000Z'),
  readAt,
});

function fixture() {
  const prisma = {
    notification: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  } as unknown as PrismaService;
  const gateway = { publish: jest.fn() } as unknown as NotificationsGateway;
  return {
    prisma,
    gateway,
    service: new NotificationsService(prisma, gateway),
  };
}

describe('NotificationsService', () => {
  it('lists only the authenticated recipient with pagination metadata', async () => {
    const { prisma, service } = fixture();
    const row = notification();
    const count = jest.spyOn(prisma.notification, 'count').mockResolvedValue(1);
    jest
      .spyOn(prisma.notification, 'findMany')
      .mockResolvedValue([row] as never);
    const result = await service.list(actor, {
      page: 1,
      pageSize: 20,
      readStatus: 'unread',
    });
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientId: actor.id, readAt: null }),
      }),
    );
    expect(result.data[0]).toMatchObject({
      id: row.id,
      reportId: '00000000-0000-4000-8000-000000000013',
    });
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasMore: false,
    });
  });

  it('returns the authenticated user unread count', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.notification, 'count').mockResolvedValue(4);
    await expect(service.unread(actor)).resolves.toEqual({ count: 4 });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { recipientId: actor.id, readAt: null },
    });
  });

  it('rejects another recipient notification without revealing it', async () => {
    const { prisma, service } = fixture();
    jest
      .spyOn(prisma.notification, 'findUnique')
      .mockResolvedValue(
        notification('00000000-0000-4000-8000-000000000099') as never,
      );
    await expect(
      service.markRead(actor, notification().id),
    ).rejects.toMatchObject(
      new ApiError(404, 'NOT_FOUND', 'Resource not found.'),
    );
  });

  it('preserves the first read timestamp on repeated reads', async () => {
    const { prisma, service } = fixture();
    const row = notification(actor.id, new Date('2026-09-08T11:00:00.000Z'));
    jest
      .spyOn(prisma.notification, 'findUnique')
      .mockResolvedValue(row as never);
    await expect(service.markRead(actor, row.id)).resolves.toMatchObject({
      id: row.id,
      readAt: row.readAt?.toISOString(),
    });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks only unread notifications through a captured cutoff', async () => {
    const { prisma, service } = fixture();
    jest
      .spyOn(prisma.notification, 'updateMany')
      .mockResolvedValue({ count: 3 });
    const result = await service.readAll(actor);
    expect(result.updatedCount).toBe(3);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientId: actor.id,
          readAt: null,
          createdAt: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      }),
    );
  });
});
