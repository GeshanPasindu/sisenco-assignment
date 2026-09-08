import {
  Body,
  Controller,
  Delete,
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
import {
  Permissions,
  PermissionsGuard,
  Roles,
  RolesGuard,
} from '../auth/authorization';
import { TasksService } from './tasks.service';
import {
  ArchiveTaskDto,
  AssignTaskDto,
  CreateTaskDto,
  CreateTimeEntryDto,
  TaskQueryDto,
  TimeQueryDto,
  UpdateTaskDto,
  UpdateTimeEntryDto,
} from './task.dto';
@ApiTags('Tasks and time')
@Controller()
export class TasksController {
  constructor(private readonly service: TasksService) {}
  @Get('tasks')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('task:read_own', 'task:manage_team')
  list(@CurrentUser() a: AuthenticatedUser, @Query() q: TaskQueryDto) {
    return this.service.list(a, q);
  }
  @Post('tasks')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('task:create_own', 'task:manage_team')
  create(@CurrentUser() a: AuthenticatedUser, @Body() d: CreateTaskDto) {
    return this.service.create(a, d);
  }
  @Get('tasks/:taskId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('task:read_own', 'task:manage_team')
  get(
    @CurrentUser() a: AuthenticatedUser,
    @Param('taskId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(a, id);
  }
  @Patch('tasks/:taskId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('task:update_own', 'task:manage_team')
  update(
    @CurrentUser() a: AuthenticatedUser,
    @Param('taskId', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateTaskDto,
  ) {
    return this.service.update(a, id, d);
  }
  @Post('tasks/:taskId/assign')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('task:manage_team')
  assign(
    @CurrentUser() a: AuthenticatedUser,
    @Param('taskId', new ParseUUIDPipe()) id: string,
    @Body() d: AssignTaskDto,
  ) {
    return this.service.assign(a, id, d);
  }
  @Post('tasks/:taskId/archive')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('task:update_own', 'task:manage_team')
  archive(
    @CurrentUser() a: AuthenticatedUser,
    @Param('taskId', new ParseUUIDPipe()) id: string,
    @Body() d: ArchiveTaskDto,
  ) {
    return this.service.archive(a, id, d);
  }
  @Get('time-entries')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('time:manage_own', 'time:read_team')
  entries(@CurrentUser() a: AuthenticatedUser, @Query() q: TimeQueryDto) {
    return this.service.entries(a, q);
  }
  @Post('tasks/:taskId/time-entries')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('time:manage_own')
  createEntry(
    @CurrentUser() a: AuthenticatedUser,
    @Param('taskId', new ParseUUIDPipe()) id: string,
    @Body() d: CreateTimeEntryDto,
  ) {
    return this.service.createEntry(a, id, d);
  }
  @Patch('time-entries/:entryId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('time:manage_own')
  updateEntry(
    @CurrentUser() a: AuthenticatedUser,
    @Param('entryId', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateTimeEntryDto,
  ) {
    return this.service.updateEntry(a, id, d);
  }
  @Delete('time-entries/:entryId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('time:manage_own')
  deleteEntry(
    @CurrentUser() a: AuthenticatedUser,
    @Param('entryId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.deleteEntry(a, id);
  }
}
