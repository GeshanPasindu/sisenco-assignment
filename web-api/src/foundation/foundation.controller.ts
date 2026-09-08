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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/auth-context';
import type { AuthenticatedUser } from '../auth/auth-context';
import {
  Permissions,
  PermissionsGuard,
  Roles,
  RolesGuard,
} from '../auth/authorization';
import { ApiError } from '../common/api-error';
import { FoundationService } from './foundation.service';
import {
  CreateProjectDto,
  ProjectsQueryDto,
  SetProjectMembersDto,
  UpdateProjectDto,
} from './foundation.dto';
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
@ApiTags('Foundation')
@Controller()
export class FoundationController {
  constructor(private readonly service: FoundationService) {}
  @Get('health') health() {
    return this.service.health();
  }
  @Get('reference-data') @UseGuards(JwtAuthGuard) referenceData() {
    return this.service.referenceData();
  }
  @Get('roles')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('user:manage')
  roles() {
    return this.service.roles();
  }
  @Get('projects')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('project:read')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ProjectsQueryDto,
  ) {
    return this.service.listProjects(actor, query);
  }
  @Post('projects')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('project:manage')
  create(@Body() dto: CreateProjectDto) {
    return this.service.createProject(dto);
  }
  @Get('projects/:projectId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('project:read')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getProject(actor, id);
  }
  @Patch('projects/:projectId')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('project:manage')
  update(
    @Param('projectId', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.service.updateProject(id, dto);
  }
  @Post('projects/:projectId/archive')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, NoBodyGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('project:manage')
  archive(@Param('projectId', new ParseUUIDPipe()) id: string) {
    return this.service.archiveProject(id);
  }
  @Get('projects/:projectId/members')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('project:manage')
  members(@Param('projectId', new ParseUUIDPipe()) id: string) {
    return this.service.members(id);
  }
  @Patch('projects/:projectId/members')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('project:manage')
  setMembers(
    @Param('projectId', new ParseUUIDPipe()) id: string,
    @Body() dto: SetProjectMembersDto,
  ) {
    return this.service.setMembers(id, dto.memberIds);
  }
}
