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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth-context';
import type { AuthenticatedUser } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  Permissions,
  PermissionsGuard,
  Roles,
  RolesGuard,
} from '../auth/authorization';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  ReactivateUserDto,
  ReportingScheduleDto,
  UpdateMeDto,
  UpdateUserDto,
  UsersQueryDto,
} from './dto/user.dto';
import { ApiError } from '../common/api-error';

class NoBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const body = context.switchToHttp().getRequest<{ body?: unknown }>().body;
    if (body && typeof body === 'object' && Object.keys(body).length > 0)
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        'Request validation failed.',
      );
    return true;
  }
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('profile:read_own')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('profile:update_own')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:read_team')
  list(@Query() query: UsersQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:manage')
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:read_team')
  detail(
    @Param('userId', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.detail(actor, id);
  }

  @Patch(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:manage')
  update(
    @Param('userId', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(actor, id, dto);
  }

  @Post(':userId/deactivate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, NoBodyGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:manage')
  deactivate(@Param('userId', new ParseUUIDPipe()) id: string) {
    return this.users.deactivate(id);
  }

  @Post(':userId/reactivate')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:manage')
  reactivate(
    @Param('userId', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactivateUserDto,
  ) {
    return this.users.reactivate(id, dto);
  }

  @Post(':userId/resend-invitation')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, NoBodyGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:manage')
  resend(
    @Param('userId', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.resend(actor.id, id);
  }

  @Put(':userId/reporting-schedule')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:manage')
  schedule(
    @Param('userId', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportingScheduleDto,
  ) {
    return this.users.schedule(id, dto);
  }
}
