import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthConfig } from '../config/auth.config';
import {
  ApiError,
  invalidCredentials,
  invalidInvitation,
  invalidRefresh,
  unauthenticated,
  validationFailed,
} from '../common/api-error';
import type { AuthenticatedUser } from './auth-context';
import type {
  AcceptInvitationDto,
  ChangePasswordDto,
  LoginDto,
} from './dto/auth-request.dto';

const includeUser = {
  role: { include: { rolePermissions: { include: { permission: true } } } },
} satisfies Prisma.UserInclude;
type SessionUser = Prisma.UserGetPayload<{ include: typeof includeUser }>;
type Tx = Prisma.TransactionClient;
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const opaqueToken = () => randomBytes(32).toString('base64url');
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly settings: AuthConfig;
  private readonly schema: string;
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.settings = config.getOrThrow<AuthConfig>('auth');
    this.schema =
      new URL(config.getOrThrow<string>('db.databaseUrl')).searchParams.get(
        'schema',
      ) ?? 'public';
  }

  async onModuleInit() {
    this.dummyHash = await this.hashPassword(opaqueToken());
  }
  hashPassword(password: string) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }
  private verifyPassword(hash: string, password: string) {
    return argon2.verify(hash, password).catch(() => false);
  }
  private checkNewPassword(password: string, field: string) {
    const length = Array.from(password).length;
    if (
      length < this.settings.passwordMinLength ||
      length > this.settings.passwordMaxLength
    ) {
      throw validationFailed([
        {
          field,
          code: 'OUT_OF_RANGE',
          message: `Must contain ${this.settings.passwordMinLength} to ${this.settings.passwordMaxLength} characters.`,
        },
      ]);
    }
  }
  private active(user: SessionUser | null): user is SessionUser {
    return (
      !!user?.activatedAt &&
      !!user.passwordHash &&
      !user.deactivatedAt &&
      !user.role.deletedAt
    );
  }
  private permissions(user: SessionUser) {
    return [
      ...new Set(user.role.rolePermissions.map((p) => p.permission.code)),
    ].sort();
  }
  private context(user: SessionUser, sessionId: string): AuthenticatedUser {
    return {
      id: user.id,
      sessionId,
      role: { id: user.role.id, code: user.role.code, name: user.role.name },
      permissions: this.permissions(user),
    };
  }
  private async tokens(user: SessionUser, sessionId: string) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      sid: sessionId,
    });
    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: this.settings.accessSeconds,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: { id: user.role.id, code: user.role.code, name: user.role.name },
        permissions: this.permissions(user),
        accountStatus: 'ACTIVE' as const,
      },
    };
  }
  // Every password/session writer takes the same user row lock first, then
  // re-reads state. READ COMMITTED observes mutations committed while waiting.
  private async lockUser(tx: Tx, id: string) {
    const table = Prisma.raw(`${quote(this.schema)}."users"`);
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM ${table} WHERE id = ${id}::uuid FOR UPDATE`,
    );
    const user = await tx.user.findUnique({
      where: { id },
      include: includeUser,
    });
    if (user) {
      const roles = Prisma.raw(`${quote(this.schema)}."roles"`);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM ${roles} WHERE id = ${user.roleId}::uuid FOR SHARE`,
      );
      return tx.user.findUnique({ where: { id }, include: includeUser });
    }
    return null;
  }
  private transaction<T>(operation: (tx: Tx) => Promise<T>) {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 15000,
    });
  }

  async login(dto: LoginDto, userAgent?: string) {
    const candidate = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: includeUser,
    });
    const verified = await this.verifyPassword(
      candidate?.passwordHash ?? this.dummyHash,
      dto.password,
    );
    if (!verified || !this.active(candidate)) throw invalidCredentials();
    return this.transaction(async (tx) => {
      const user = await this.lockUser(tx, candidate.id);
      if (!this.active(user) || user.passwordHash !== candidate.passwordHash)
        throw invalidCredentials();
      const refreshToken = opaqueToken();
      const expiresAt = new Date(
        Date.now() + this.settings.refreshSeconds * 1000,
      );
      const session = await tx.authSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: tokenHash(refreshToken),
          expiresAt,
          userAgent: userAgent?.slice(0, 1000) ?? null,
        },
      });
      return {
        data: await this.tokens(user, session.id),
        refreshToken,
        expiresAt,
      };
    });
  }

  async authenticate(
    subject: string,
    sessionId: string,
  ): Promise<AuthenticatedUser> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: includeUser } },
    });
    if (
      !session ||
      session.userId !== subject ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !this.active(session.user)
    )
      throw unauthenticated();
    return this.context(session.user, session.id);
  }

  async refresh(token: string | undefined) {
    if (!token) throw invalidRefresh();
    const hash = tokenHash(token);
    const candidate = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: hash },
    });
    if (!candidate) throw invalidRefresh();
    return this.transaction(async (tx) => {
      const user = await this.lockUser(tx, candidate.userId);
      const session = await tx.authSession.findUnique({
        where: { id: candidate.id },
      });
      const now = new Date();
      if (
        !this.active(user) ||
        !session ||
        session.refreshTokenHash !== hash ||
        session.revokedAt ||
        session.expiresAt <= now
      )
        throw invalidRefresh();
      const refreshToken = opaqueToken();
      const rotated = await tx.authSession.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: hash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { refreshTokenHash: tokenHash(refreshToken), lastUsedAt: now },
      });
      if (rotated.count !== 1) throw invalidRefresh();
      return {
        data: await this.tokens(user, session.id),
        refreshToken,
        expiresAt: session.expiresAt,
      };
    });
  }

  async logout(token: string | undefined) {
    if (!token) return;
    const hash = tokenHash(token);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: hash },
    });
    if (!session) return;
    await this.transaction(async (tx) => {
      const user = await this.lockUser(tx, session.userId);
      if (!this.active(user)) return;
      const now = new Date();
      await tx.authSession.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: hash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
    });
  }

  async changePassword(context: AuthenticatedUser, dto: ChangePasswordDto) {
    this.checkNewPassword(dto.newPassword, 'newPassword');
    const candidate = await this.prisma.user.findUnique({
      where: { id: context.id },
      include: includeUser,
    });
    if (!this.active(candidate)) throw unauthenticated();
    if (
      !(await this.verifyPassword(candidate.passwordHash!, dto.currentPassword))
    )
      throw new ApiError(
        400,
        'CURRENT_PASSWORD_INCORRECT',
        'Current password is incorrect.',
      );
    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.transaction(async (tx) => {
      const user = await this.lockUser(tx, context.id);
      const session = await tx.authSession.findUnique({
        where: { id: context.sessionId },
      });
      const now = new Date();
      if (
        !this.active(user) ||
        !session ||
        session.userId !== user.id ||
        session.revokedAt ||
        session.expiresAt <= now
      )
        throw unauthenticated();
      if (user.passwordHash !== candidate.passwordHash)
        throw new ApiError(
          400,
          'CURRENT_PASSWORD_INCORRECT',
          'Current password is incorrect.',
        );
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  private usableInvitation(
    invitation: {
      expiresAt: Date;
      revokedAt: Date | null;
      consumedAt: Date | null;
    } | null,
    user: SessionUser | null,
  ) {
    return (
      !!invitation &&
      invitation.expiresAt > new Date() &&
      !invitation.revokedAt &&
      !invitation.consumedAt &&
      !!user &&
      !user.activatedAt &&
      !user.passwordHash &&
      !user.deactivatedAt &&
      !user.role.deletedAt
    );
  }
  async checkInvitation(token: string) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: { include: includeUser } },
    });
    if (!invitation || !this.usableInvitation(invitation, invitation.user))
      throw invalidInvitation();
    return {
      email: invitation.user.email,
      firstName: invitation.user.firstName,
      lastName: invitation.user.lastName,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    this.checkNewPassword(dto.password, 'password');
    const candidate = await this.prisma.userInvitation.findUnique({
      where: { tokenHash: tokenHash(dto.token) },
      include: { user: { include: includeUser } },
    });
    if (!candidate || !this.usableInvitation(candidate, candidate.user))
      throw invalidInvitation();
    const passwordHash = await this.hashPassword(dto.password);
    await this.transaction(async (tx) => {
      const user = await this.lockUser(tx, candidate.userId);
      const invitations = Prisma.raw(
        `${quote(this.schema)}."user_invitations"`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM ${invitations} WHERE id = ${candidate.id}::uuid FOR UPDATE`,
      );
      const invitation = await tx.userInvitation.findUnique({
        where: { id: candidate.id },
      });
      if (
        !this.usableInvitation(invitation, user) ||
        invitation!.tokenHash !== tokenHash(dto.token)
      )
        throw invalidInvitation();
      const now = new Date();
      const consumed = await tx.userInvitation.updateMany({
        where: {
          id: candidate.id,
          tokenHash: tokenHash(dto.token),
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw invalidInvitation();
      await tx.user.update({
        where: { id: candidate.userId },
        data: {
          passwordHash,
          activatedAt: now,
          firstName: dto.firstName,
          lastName: dto.lastName,
          personalEmail: dto.personalEmail,
          contactNumber: dto.contactNumber,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          postalCode: dto.postalCode,
        },
      });
      // Never-activated users have only planned obligations. Preserve future
      // manager selections, clip the spanning interval, discard elapsed plans.
      const week = activationWeek(now);
      await tx.userReportingPeriod.deleteMany({
        where: { userId: candidate.userId, endWeek: { lt: week } },
      });
      await tx.userReportingPeriod.updateMany({
        where: {
          userId: candidate.userId,
          startWeek: { lt: week },
          OR: [{ endWeek: null }, { endWeek: { gte: week } }],
        },
        data: { startWeek: week },
      });
    });
    return { activated: true };
  }
}

export function activationWeek(now: Date): Date {
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const week = new Date(`${localDate}T00:00:00Z`);
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  return week;
}
