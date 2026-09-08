import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import {
  CandidateQueryDto,
  ComplianceQueryDto,
  CreateReportDto,
  ImportTasksDto,
  ReportQueryDto,
  ReviewDto,
  SaveVersionDto,
  SubmitReportDto,
  VersionsQueryDto,
} from './report.dto';
import { ReportsService } from './reports.service';
import { ApiError } from '../common/api-error';

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
@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('report:read_own', 'report:read_team')
  list(@CurrentUser() a: AuthenticatedUser, @Query() q: ReportQueryDto) {
    return this.service.list(a, q);
  }
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('report:create')
  create(@CurrentUser() a: AuthenticatedUser, @Body() d: CreateReportDto) {
    return this.service.create(a, d);
  }
  @Delete(':reportId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, PermissionsGuard, NoBodyGuard)
  @Permissions.all('report:update_own')
  remove(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(a, id);
  }
  @Get('compliance')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('report:read_team')
  compliance(@Query() q: ComplianceQueryDto) {
    return this.service.compliance(q);
  }
  @Get(':reportId/task-candidates')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('report:update_own')
  candidates(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Query() q: CandidateQueryDto,
  ) {
    return this.service.candidates(a, id, q);
  }
  @Post(':reportId/import-tasks')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('report:update_own')
  importTasks(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Body() d: ImportTasksDto,
  ) {
    return this.service.importTasks(a, id, d);
  }
  @Post(':reportId/corrections')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, PermissionsGuard, NoBodyGuard)
  @Permissions.all('report:update_own')
  correction(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.correction(a, id);
  }
  @Post(':reportId/submit')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('report:submit_own')
  submit(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Body() d: SubmitReportDto,
  ) {
    return this.service.submit(a, id, d);
  }
  @Post(':reportId/reviews')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('MANAGER_ADMIN')
  @Permissions.all('report:review', 'report:read_team')
  review(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Body() d: ReviewDto,
  ) {
    return this.service.review(a, id, d);
  }
  @Get(':reportId/versions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('report:read_own', 'report:read_team')
  versions(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Query() q: VersionsQueryDto,
  ) {
    return this.service.versions(a, id, q);
  }
  @Get(':reportId/versions/:versionId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('report:read_own', 'report:read_team')
  version(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
  ) {
    return this.service.version(a, id, versionId);
  }
  @Get(':reportId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.any('report:read_own', 'report:read_team')
  get(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(a, id);
  }
  @Put(':reportId/editable-version')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions.all('report:update_own')
  save(
    @CurrentUser() a: AuthenticatedUser,
    @Param('reportId', new ParseUUIDPipe()) id: string,
    @Body() d: SaveVersionDto,
  ) {
    return this.service.save(a, id, d);
  }
}
