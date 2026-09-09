/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { UsersService } from './users.service';
import { ApiError } from '../common/api-error';
import type { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth-context';
import type { MailService } from '../mail/mail.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  sessionId: 'session-1',
  role: { id: 'role-1', code: 'TEAM_MEMBER', name: 'Team Member' },
  permissions: ['profile:read_own'],
};
function fixture() {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    userInvitation: { update: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const auth = { authenticate: jest.fn() } as unknown as AuthService;
  const mail = {
    sendInvitation: jest.fn().mockResolvedValue(false),
  } as unknown as MailService;
  return { prisma, auth, mail, service: new UsersService(prisma, auth, mail) };
}

describe('UsersService', () => {
  it('rejects an empty self-profile update', async () => {
    const { service } = fixture();
    await expect(service.updateMe(user, {})).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    });
  });

  it('returns a generic not-found error for an unknown profile', async () => {
    const { prisma, service } = fixture();
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    await expect(service.me(user)).rejects.toMatchObject(
      new ApiError(404, 'NOT_FOUND', 'Resource not found.'),
    );
  });

  it('rejects an invalid reporting schedule date before database access', async () => {
    const { service } = fixture();
    await expect(
      service.schedule('user-1', {
        effectiveWeek: '2026-09-08',
        required: true,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    });
  });

  it('does not allow a manager admin account to be deactivated', async () => {
    const { prisma, service } = fixture();
    const database = prisma as unknown as { $transaction: jest.Mock };
    database.$transaction.mockImplementation(
      (work: (tx: unknown) => unknown) =>
        work({
          user: {
            findUnique: jest.fn().mockResolvedValue({
              role: { code: 'MANAGER_ADMIN' },
            }),
          },
        }),
    );

    await expect(service.deactivate('admin-user')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ADMIN_ACCOUNT_PROTECTED' }),
    });
  });

  it('returns a manual invitation token when email delivery is unavailable', async () => {
    const { prisma, mail, service } = fixture();
    const database = prisma as unknown as {
      role: { findUnique: jest.Mock };
      $transaction: jest.Mock;
      userInvitation: { update: jest.Mock };
    };
    const now = new Date('2026-09-08T10:00:00.000Z');
    const createdUser = {
      id: 'user-2',
      employeeId: 'EMP-2',
      email: 'new.member@example.com',
      firstName: 'New',
      lastName: 'Member',
      role: { id: 'role-2', code: 'TEAM_MEMBER', name: 'Team Member' },
      activatedAt: null,
      deactivatedAt: null,
      position: null,
      personalEmail: null,
      contactNumber: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      createdAt: now,
      updatedAt: now,
      reportingPeriods: [],
      invitations: [],
    };
    const transaction = {
      user: {
        create: jest.fn().mockResolvedValue(createdUser),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdUser),
      },
      userInvitation: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'invitation-1',
            ...data,
            consumedAt: null,
            revokedAt: null,
            emailDeliveryStatus: 'PENDING',
            emailSentAt: null,
            emailAttemptCount: 0,
          }),
        ),
      },
    };
    database.role = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'role-2', deletedAt: null }),
    };
    database.userInvitation.update.mockResolvedValue({
      id: 'invitation-1',
      expiresAt: new Date(now.getTime() + 86400000),
      consumedAt: null,
      revokedAt: null,
      emailDeliveryStatus: 'FAILED',
      emailSentAt: null,
      emailAttemptCount: 1,
    });
    database.$transaction.mockImplementation(
      (work: (tx: typeof transaction) => unknown) => work(transaction),
    );

    const result = await service.create(user, {
      email: 'new.member@example.com',
      firstName: 'New',
      lastName: 'Member',
      roleId: 'role-2',
    });

    expect(result.invitation.deliveryStatus).toBe('FAILED');
    expect(result.invitation.manualInvitation).toBeDefined();
    expect(result.invitation.manualInvitation?.token).toMatch(
      /^[A-Za-z0-9_-]{43}$/u,
    );
    expect(mail.sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new.member@example.com' }),
    );
  });
});
