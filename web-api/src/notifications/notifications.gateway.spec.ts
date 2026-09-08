/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import type { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';

describe('NotificationsGateway', () => {
  it('authenticates a socket and joins only its private user room', async () => {
    const jwt = {
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: 'user-1', sid: 'session-1' }),
    } as unknown as JwtService;
    const auth = {
      authenticate: jest.fn().mockResolvedValue({ id: 'user-1' }),
    } as unknown as AuthService;
    const prisma = {} as PrismaService;
    const gateway = new NotificationsGateway(
      jwt,
      auth,
      prisma,
      new ConfigService({ auth: { issuer: 'issuer', audience: 'audience' } }),
    );
    const client = {
      handshake: { auth: { token: 'access-token' }, headers: {} },
      join: jest.fn(),
      disconnect: jest.fn(),
    };
    await gateway.handleConnection(client as never);
    expect(auth.authenticate).toHaveBeenCalledWith('user-1', 'session-1');
    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects sockets with invalid credentials', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('invalid')),
    } as unknown as JwtService;
    const auth = { authenticate: jest.fn() } as unknown as AuthService;
    const gateway = new NotificationsGateway(
      jwt,
      auth,
      {} as PrismaService,
      new ConfigService({ auth: { issuer: 'issuer', audience: 'audience' } }),
    );
    const client = {
      handshake: { auth: {}, headers: {} },
      join: jest.fn(),
      disconnect: jest.fn(),
    };
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('publishes a notification payload to the recipient room', async () => {
    const gateway = new NotificationsGateway(
      {} as JwtService,
      {} as AuthService,
      {
        notification: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'n1',
            recipientId: 'user-1',
            type: 'TASK_ASSIGNED',
            actor: { id: 'manager', firstName: 'Amal', lastName: 'Silva' },
            title: 'Task assigned',
            message: 'You have a task.',
            reportVersionId: null,
            reportReviewId: null,
            taskId: 'task-1',
            createdAt: new Date('2026-09-08T10:00:00.000Z'),
            readAt: null,
            reportVersion: null,
            reportReview: null,
            task: { id: 'task-1' },
          }),
        },
      } as unknown as PrismaService,
      new ConfigService({ auth: { issuer: 'issuer', audience: 'audience' } }),
    );
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    await gateway.publish('n1');
    expect(gateway.server.to).toHaveBeenCalledWith('user:user-1');
    expect(emit).toHaveBeenCalledWith(
      'notification.created',
      expect.objectContaining({ id: 'n1', type: 'TASK_ASSIGNED' }),
    );
  });
});
