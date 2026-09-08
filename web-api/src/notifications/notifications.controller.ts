import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth-context';
import type { AuthenticatedUser } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions, PermissionsGuard } from '../auth/authorization';
import { ApiError } from '../common/api-error';
import { NotificationQueryDto } from './notification.dto';
import { NotificationsService } from './notifications.service';
class NoBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const body = context.switchToHttp().getRequest<{ body?: unknown }>().body;
    if (body && typeof body === 'object' && Object.keys(body).length)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    return true;
  }
}
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('notification:read_own')
  list(@CurrentUser() a: AuthenticatedUser, @Query() q: NotificationQueryDto) {
    return this.service.list(a, q);
  }
  @Get('unread-count')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('notification:read_own')
  unread(@CurrentUser() a: AuthenticatedUser) {
    return this.service.unread(a);
  }
  @Patch(':notificationId/read')
  @UseGuards(JwtAuthGuard, PermissionsGuard, NoBodyGuard)
  @Permissions.all('notification:update_own')
  read(
    @CurrentUser() a: AuthenticatedUser,
    @Param('notificationId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.markRead(a, id);
  }
  @Post('read-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, PermissionsGuard, NoBodyGuard)
  @Permissions.all('notification:update_own')
  readAll(@CurrentUser() a: AuthenticatedUser) {
    return this.service.readAll(a);
  }
}
