/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { TasksService } from './tasks.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsGateway } from '../notifications/notifications.gateway';
import type { AuthenticatedUser } from '../auth/auth-context';

const actor: AuthenticatedUser = {
  id: 'user-1',
  sessionId: 'session-1',
  role: { id: 'role-1', code: 'TEAM_MEMBER', name: 'Team Member' },
  permissions: ['task:read_own', 'task:update_own', 'time:manage_own'],
};
function fixture() {
  const prisma = {
    task: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    reportTask: { findFirst: jest.fn() },
    taskTimeEntry: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const notifications = {
    publish: jest.fn(),
  } as unknown as NotificationsGateway;
  return {
    prisma,
    notifications,
    service: new TasksService(prisma, notifications),
  };
}

describe('TasksService', () => {
  it('hides a task from a user who is not its assignee or team manager', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task-1',
      assigneeId: 'other-user',
      archivedAt: null,
    } as never);
    await expect(service.get(actor, 'task-1')).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    });
  });

  it('rejects time entry creation on archived tasks', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task-1',
      assigneeId: actor.id,
      archivedAt: new Date(),
    } as never);
    await expect(
      service.createEntry(actor, 'task-1', {
        workDate: '2026-09-07',
        minutes: 30,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TASK_ARCHIVED' }),
    });
    expect(prisma.taskTimeEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a daily time total above 1440 minutes', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task-1',
      assigneeId: actor.id,
      archivedAt: null,
    } as never);
    jest
      .spyOn(prisma.taskTimeEntry, 'aggregate')
      .mockResolvedValue({ _sum: { minutes: 1430 } } as never);
    await expect(
      service.createEntry(actor, 'task-1', {
        workDate: '2026-09-07',
        minutes: 30,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DAILY_TIME_LIMIT' }),
    });
  });
});
