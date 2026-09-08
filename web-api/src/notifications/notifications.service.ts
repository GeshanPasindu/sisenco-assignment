import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/api-error';
import { NotificationsGateway } from './notifications.gateway';
import type { AuthenticatedUser } from '../auth/auth-context';
import type { NotificationQueryDto } from './notification.dto';

const include = {
  actor: { select: { id: true, firstName: true, lastName: true } },
  reportVersion: { select: { id: true, reportId: true } },
  reportReview: { select: { id: true } },
  task: { select: { id: true } },
} satisfies Prisma.NotificationInclude;
const map = (
  n: Prisma.NotificationGetPayload<{ include: typeof include }>,
) => ({
  id: n.id,
  type: n.type,
  actor: n.actor,
  title: n.title,
  message: n.message,
  reportId: n.reportVersion?.reportId ?? null,
  reportVersionId: n.reportVersionId,
  reportReviewId: n.reportReviewId,
  taskId: n.taskId,
  createdAt: n.createdAt.toISOString(),
  readAt: n.readAt?.toISOString() ?? null,
});
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}
  async list(actor: AuthenticatedUser, q: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      recipientId: actor.id,
      ...(q.readStatus === 'unread'
        ? { readAt: null }
        : q.readStatus === 'read'
          ? { readAt: { not: null } }
          : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      data: rows.map(map),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
        hasMore: q.page * q.pageSize < total,
      },
    };
  }
  unread(actor: AuthenticatedUser) {
    return this.prisma.notification
      .count({ where: { recipientId: actor.id, readAt: null } })
      .then((count) => ({ count }));
  }
  async markRead(actor: AuthenticatedUser, id: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id },
      include,
    });
    if (!n || n.recipientId !== actor.id)
      throw new ApiError(404, 'NOT_FOUND', 'Resource not found.');
    const updated = n.readAt
      ? n
      : await this.prisma.notification.update({
          where: { id },
          data: { readAt: new Date() },
          include,
        });
    return map(updated);
  }
  async readAll(actor: AuthenticatedUser) {
    const readThrough = new Date();
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId: actor.id,
        readAt: null,
        createdAt: { lte: readThrough },
      },
      data: { readAt: readThrough },
    });
    return {
      updatedCount: result.count,
      readThrough: readThrough.toISOString(),
    };
  }
  async publish(id: string) {
    return this.gateway.publish(id);
  }
}
