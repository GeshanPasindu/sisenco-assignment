import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import {
  ActivityQueryDto,
  DashboardQueryDto,
  TeamDashboardQueryDto,
} from './dashboard.dto';
import { DashboardService } from './dashboard.service';
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('dashboard:read_own')
  me(@CurrentUser() a: AuthenticatedUser, @Query() q: DashboardQueryDto) {
    return this.service.me(a, q);
  }
  @Get('team')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('dashboard:read_team')
  team(@CurrentUser() a: AuthenticatedUser, @Query() q: TeamDashboardQueryDto) {
    return this.service.team(a, q);
  }
  @Get('me/activity')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('dashboard:read_own')
  activityMe(
    @CurrentUser() a: AuthenticatedUser,
    @Query() q: ActivityQueryDto,
  ) {
    return this.service.activityMe(a, q);
  }
  @Get('team/activity')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('dashboard:read_team')
  activityTeam(
    @CurrentUser() a: AuthenticatedUser,
    @Query() q: ActivityQueryDto,
  ) {
    return this.service.activityTeam(a, q);
  }
}
