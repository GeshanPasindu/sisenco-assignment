import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly issuer: string;
  private readonly audience: string;
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const settings = config.getOrThrow<{ issuer: string; audience: string }>(
      'auth',
    );
    this.issuer = settings.issuer;
    this.audience = settings.audience;
  }
  async handleConnection(client: Socket) {
    try {
      const raw =
        typeof client.handshake.auth?.token === 'string'
          ? client.handshake.auth.token
          : typeof client.handshake.headers.authorization === 'string'
            ? client.handshake.headers.authorization.replace(/^Bearer\s+/u, '')
            : undefined;
      if (!raw) throw new Error('missing token');
      const claims = await this.jwt.verifyAsync<{ sub: string; sid: string }>(
        raw,
        { issuer: this.issuer, audience: this.audience, algorithms: ['HS256'] },
      );
      const user = await this.auth.authenticate(claims.sub, claims.sid);
      await client.join(this.room(user.id));
    } catch {
      client.disconnect(true);
    }
  }
  handleDisconnect() {}
  private room(userId: string) {
    return `user:${userId}`;
  }
  async publish(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        actor: { select: { id: true, firstName: true, lastName: true } },
        reportVersion: {
          select: { id: true, reportId: true, versionNumber: true },
        },
        reportReview: { select: { id: true, comment: true } },
        task: { select: { id: true } },
      },
    });
    if (!notification) return;
    const payload = {
      id: notification.id,
      type: notification.type,
      actor: notification.actor,
      title: notification.title,
      message: notification.message,
      reportId: notification.reportVersion?.reportId ?? null,
      reportVersionId: notification.reportVersionId,
      reportReviewId: notification.reportReviewId,
      taskId: notification.taskId,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
    };
    this.server
      ?.to(this.room(notification.recipientId))
      .emit('notification.created', payload);
  }
}
