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
    project: { findUnique: jest.fn() },
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

  it('allows a manager to edit an active or completed assigned task without project membership', async () => {
    const { prisma, service } = fixture();
    const manager: AuthenticatedUser = {
      ...actor,
      role: { id: 'role-manager', code: 'MANAGER_ADMIN', name: 'Manager/Admin' },
      permissions: ['task:manage_team'],
    };
    const task = {
      id: 'task-1',
      assigneeId: 'member-1',
      archivedAt: null,
      lockVersion: 4,
      plannedDate: new Date('2026-09-07T00:00:00.000Z'),
      dueDate: new Date('2026-09-11T00:00:00.000Z'),
      status: 'COMPLETED',
      completedAt: new Date('2026-09-08T00:00:00.000Z'),
    };
    const updated = {
      ...task,
      name: 'Updated completed task',
      description: null,
      project: { id: 'project-2', name: 'Another project' },
      creator: { id: manager.id, firstName: 'Admin', lastName: 'Manager' },
      assignee: { id: 'member-1', firstName: 'Team', lastName: 'Member' },
      priority: 'MEDIUM',
      taskType: 'OTHER',
      plannedCompletionPct: 100,
      actualCompletionPct: 100,
      plannedMinutes: 60,
      deliverable: 'Delivered',
      timeEntries: [],
      createdAt: new Date('2026-09-07T00:00:00.000Z'),
      updatedAt: new Date('2026-09-08T00:00:00.000Z'),
    };
    jest.spyOn(prisma.task, 'findUnique').mockResolvedValue(task as never);
    jest.spyOn(prisma.project, 'findUnique').mockResolvedValue({ id: 'project-2', archivedAt: null } as never);
    jest.spyOn(prisma.task, 'update').mockResolvedValue(updated as never);

    await expect(
      service.update(manager, task.id, {
        lockVersion: task.lockVersion,
        name: updated.name,
        projectId: updated.project.id,
      }),
    ).resolves.toMatchObject({ id: task.id, name: updated.name });
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: task.id } }),
    );
  });
});
