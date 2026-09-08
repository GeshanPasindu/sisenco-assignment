import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, tokenHash } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth-context';
import { ApiError } from '../common/api-error';
import { MailService } from '../mail/mail.service';
import { randomBytes, randomUUID } from 'node:crypto';
import type {
  CreateUserDto,
  ReactivateUserDto,
  ReportingScheduleDto,
  UpdateMeDto,
  UpdateUserDto,
  UsersQueryDto,
} from './dto/user.dto';

const includeUser = {
  role: true,
  reportingPeriods: { orderBy: { startWeek: 'asc' as const } },
  invitations: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.UserInclude;
type UserWithDetails = Prisma.UserGetPayload<{ include: typeof includeUser }>;
const iso = (date: Date | null) => date?.toISOString() ?? null;
const dateOnly = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;
const parseDate = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed.', [
      {
        field: 'date',
        code: 'INVALID_DATE',
        message: 'Must be a valid calendar date.',
      },
    ]);
  return date;
};
const monday = (date: Date) => date.getUTCDay() === 1;
const currentMonday = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() + offset);
  return now;
};
const employeeId = () => `EMP-${randomUUID().replaceAll('-', '').slice(0, 26)}`;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}
  private status(user: {
    activatedAt: Date | null;
    deactivatedAt: Date | null;
  }) {
    return user.deactivatedAt
      ? 'DEACTIVATED'
      : user.activatedAt
        ? 'ACTIVE'
        : 'INVITED';
  }
  private invitation(
    invitation: UserWithDetails['invitations'][number] | null,
  ) {
    return invitation
      ? {
          expiresAt: iso(invitation.expiresAt),
          consumedAt: iso(invitation.consumedAt),
          revokedAt: iso(invitation.revokedAt),
          deliveryStatus: invitation.emailDeliveryStatus,
          emailSentAt: iso(invitation.emailSentAt),
          emailAttemptCount: invitation.emailAttemptCount,
        }
      : null;
  }
  private manualInvitation(token: string, expiresAt: Date) {
    return { token, expiresAt: expiresAt.toISOString() };
  }
  private async deliverInvitation(
    invitation: UserWithDetails['invitations'][number],
    user: Pick<UserWithDetails, 'email' | 'firstName'>,
    token: string,
  ) {
    const sent = await this.mail.sendInvitation({
      to: user.email,
      recipientName: user.firstName,
      token,
      expiresAt: invitation.expiresAt,
    });
    const delivered = await this.prisma.userInvitation.update({
      where: { id: invitation.id },
      data: {
        emailDeliveryStatus: sent ? 'SENT' : 'FAILED',
        emailAttemptCount: { increment: 1 },
        ...(sent ? { emailSentAt: new Date() } : {}),
      },
    });
    return {
      ...this.invitation(delivered),
      ...(sent
        ? {}
        : {
            manualInvitation: this.manualInvitation(
              token,
              invitation.expiresAt,
            ),
          }),
    };
  }
  private mapDetail(user: UserWithDetails) {
    return {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: { id: user.role.id, code: user.role.code, name: user.role.name },
      accountStatus: this.status(user),
      position: user.position,
      personalEmail: user.personalEmail,
      contactNumber: user.contactNumber,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      postalCode: user.postalCode,
      activatedAt: iso(user.activatedAt),
      deactivatedAt: iso(user.deactivatedAt),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      reportingPeriods: user.reportingPeriods.map((p) => ({
        id: p.id,
        startWeek: dateOnly(p.startWeek),
        endWeek: dateOnly(p.endWeek),
      })),
      latestInvitation: this.invitation(user.invitations[0] ?? null),
    };
  }
  private mapProfile(user: UserWithDetails, permissions: string[]) {
    const { reportingPeriods, latestInvitation, ...profile } =
      this.mapDetail(user);
    void reportingPeriods;
    void latestInvitation;
    return { ...profile, permissions };
  }
  private async get(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: includeUser,
    });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    return user;
  }
  async me(context: AuthenticatedUser) {
    return this.mapProfile(await this.get(context.id), context.permissions);
  }
  async updateMe(context: AuthenticatedUser, dto: UpdateMeDto) {
    if (!Object.keys(dto).length)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        [
          {
            field: 'body',
            code: 'EMPTY_UPDATE',
            message: 'At least one field is required.',
          },
        ],
      );
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    const user = await this.prisma.user.update({
      where: { id: context.id },
      data,
      include: includeUser,
    });
    return this.mapProfile(
      user,
      (await this.auth.authenticate(user.id, context.sessionId)).permissions,
    );
  }
  async list(query: UsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.q)
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { employeeId: { contains: query.q, mode: 'insensitive' } },
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
      ];
    if (query.roleCode) where.role = { code: query.roleCode };
    if (query.accountStatus === 'INVITED') where.activatedAt = null;
    if (query.accountStatus === 'ACTIVE')
      where.AND = [{ activatedAt: { not: null } }, { deactivatedAt: null }];
    if (query.accountStatus === 'DEACTIVATED')
      where.deactivatedAt = { not: null };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: includeUser,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      data: users.map((u) => ({
        id: u.id,
        employeeId: u.employeeId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: { id: u.role.id, code: u.role.code, name: u.role.name },
        accountStatus: this.status(u),
        createdAt: u.createdAt.toISOString(),
        invitationDeliveryStatus: u.invitations[0]?.emailDeliveryStatus ?? null,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
        hasMore: query.page * query.pageSize < total,
      },
    };
  }
  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role || role.deletedAt)
      throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found.');
    const email = dto.email.trim().toLowerCase();
    const start = dto.reportingStartWeek
      ? parseDate(dto.reportingStartWeek)
      : null;
    if (start && !monday(start))
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Reporting start must be a Monday.',
      );
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 86400000);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            employeeId: employeeId(),
            roleId: role.id,
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            position: dto.position ?? null,
            personalEmail: dto.personalEmail ?? null,
            contactNumber: dto.contactNumber ?? null,
            addressLine1: dto.addressLine1 ?? null,
            addressLine2: dto.addressLine2 ?? null,
            city: dto.city ?? null,
            postalCode: dto.postalCode ?? null,
          },
          include: includeUser,
        });
        if (start)
          await tx.userReportingPeriod.create({
            data: { userId: user.id, startWeek: start },
          });
        const invitation = await tx.userInvitation.create({
          data: {
            userId: user.id,
            invitedBy: actor.id,
            tokenHash: tokenHash(raw),
            expiresAt,
          },
        });
        const complete = await tx.user.findUniqueOrThrow({
          where: { id: user.id },
          include: includeUser,
        });
        return {
          user: this.mapDetail(complete),
          invitation,
        };
      });
      return {
        user: result.user,
        invitation: await this.deliverInvitation(
          result.invitation,
          result.user,
          raw,
        ),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ApiError(
          409,
          'EMAIL_ALREADY_EXISTS',
          'A user with this email already exists.',
        );
      throw error;
    }
  }
  async detail(context: AuthenticatedUser, id: string) {
    return this.mapDetail(await this.get(id));
  }
  async update(context: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    if (!Object.keys(dto).length)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
        [
          {
            field: 'body',
            code: 'EMPTY_UPDATE',
            message: 'At least one field is required.',
          },
        ],
      );
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    const user = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id },
        include: includeUser,
      });
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
      if (dto.roleId) {
        const role = await tx.role.findUnique({ where: { id: dto.roleId } });
        if (!role || role.deletedAt)
          throw new ApiError(404, 'ROLE_NOT_FOUND', 'Role not found.');
        if (
          current.role.code === 'MANAGER_ADMIN' &&
          role.code !== 'MANAGER_ADMIN'
        ) {
          const count = await tx.user.count({
            where: {
              id: { not: id },
              activatedAt: { not: null },
              deactivatedAt: null,
              role: { code: 'MANAGER_ADMIN', deletedAt: null },
            },
          });
          if (count < 1)
            throw new ApiError(
              409,
              'LAST_ACTIVE_MANAGER',
              'The last active manager cannot be removed.',
            );
        }
      }
      return tx.user.update({ where: { id }, data, include: includeUser });
    });
    return this.mapDetail(user);
  }
  private async ensureLastManager(id: string) {
    const count = await this.prisma.user.count({
      where: {
        id: { not: id },
        activatedAt: { not: null },
        deactivatedAt: null,
        role: { code: 'MANAGER_ADMIN', deletedAt: null },
      },
    });
    if (count < 1)
      throw new ApiError(
        409,
        'LAST_ACTIVE_MANAGER',
        'The last active manager cannot be removed.',
      );
  }
  async deactivate(id: string) {
    const invitation = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: includeUser,
      });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
      if (
        user.role.code === 'MANAGER_ADMIN' &&
        user.activatedAt &&
        !user.deactivatedAt
      ) {
        const count = await tx.user.count({
          where: {
            id: { not: id },
            activatedAt: { not: null },
            deactivatedAt: null,
            role: { code: 'MANAGER_ADMIN', deletedAt: null },
          },
        });
        if (count < 1)
          throw new ApiError(
            409,
            'LAST_ACTIVE_MANAGER',
            'The last active manager cannot be deactivated.',
          );
      }
      if (!user.deactivatedAt) {
        const now = new Date();
        await tx.user.update({ where: { id }, data: { deactivatedAt: now } });
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.userInvitation.updateMany({
          where: { userId: id, consumedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        const active = await tx.userReportingPeriod.findMany({
          where: { userId: id, endWeek: null },
        });
        const week = currentMonday();
        for (const period of active)
          await tx.userReportingPeriod.update({
            where: { id: period.id },
            data: { endWeek: week },
          });
      }
      return this.mapDetail(
        await tx.user.findUniqueOrThrow({
          where: { id },
          include: includeUser,
        }),
      );
    });
  }
  async reactivate(id: string, dto: ReactivateUserDto) {
    const start = dto.reportingStartWeek
      ? parseDate(dto.reportingStartWeek)
      : null;
    if (start && !monday(start))
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Reporting start must be a Monday.',
      );
    if (start && start < currentMonday())
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'reportingStartWeek must be current or future Monday.',
      );
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: includeUser,
      });
      if (!user || !user.activatedAt || !user.deactivatedAt)
        throw new ApiError(
          409,
          'ACCOUNT_NOT_REACTIVATABLE',
          'Only previously activated deactivated accounts can be reactivated.',
        );
      await tx.user.update({ where: { id }, data: { deactivatedAt: null } });
      if (start)
        await tx.userReportingPeriod.create({
          data: { userId: id, startWeek: start },
        });
      return this.mapDetail(
        await tx.user.findUniqueOrThrow({
          where: { id },
          include: includeUser,
        }),
      );
    });
  }
  async resend(actorId: string, id: string) {
    const user = await this.get(id);
    if (user.activatedAt || user.deactivatedAt)
      throw new ApiError(
        409,
        'ACCOUNT_NOT_INVITABLE',
        'Only never-activated active accounts can receive invitations.',
      );
    const raw = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 86400000);
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.userInvitation.updateMany({
        where: { userId: id, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      const invitation = await tx.userInvitation.create({
        data: {
          userId: id,
          invitedBy: actorId,
          tokenHash: tokenHash(raw),
          expiresAt,
        },
      });
      return invitation;
    });
    return this.deliverInvitation(invitation, user, raw);
  }
  async schedule(id: string, dto: ReportingScheduleDto) {
    const effective = parseDate(dto.effectiveWeek);
    if (!monday(effective))
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'effectiveWeek must be a Monday.',
      );
    if (effective < currentMonday())
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'effectiveWeek must be current or future Monday.',
      );
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
      const periods = await tx.userReportingPeriod.findMany({
        where: { userId: id },
        orderBy: { startWeek: 'asc' },
      });
      const current = periods.find(
        (p) =>
          p.startWeek <= effective &&
          (p.endWeek === null || p.endWeek >= effective),
      );
      if (dto.required && !current)
        await tx.userReportingPeriod.create({
          data: { userId: id, startWeek: effective },
        });
      if (!dto.required && current) {
        const end = new Date(effective);
        end.setUTCDate(end.getUTCDate() - 7);
        if (current.startWeek < effective)
          await tx.userReportingPeriod.update({
            where: { id: current.id },
            data: { endWeek: end },
          });
        else await tx.userReportingPeriod.delete({ where: { id: current.id } });
      }
      const updated = await tx.userReportingPeriod.findMany({
        where: { userId: id },
        orderBy: { startWeek: 'asc' },
      });
      return {
        userId: id,
        reportingPeriods: updated.map((p) => ({
          id: p.id,
          startWeek: dateOnly(p.startWeek),
          endWeek: dateOnly(p.endWeek),
        })),
      };
    });
  }
}
