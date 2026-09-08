import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const reportStatuses = [
  'DRAFT',
  'SUBMITTED',
  'NEEDS_CORRECTION',
  'APPROVED',
] as const;
const sections = ['THIS_WEEK', 'NEXT_WEEK'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const taskStatuses = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
] as const;
const taskTypes = [
  'DEVELOPMENT',
  'TESTING',
  'MEETINGS',
  'DOCUMENTATION',
  'OTHER',
] as const;
const blockerStatuses = ['OPEN', 'RESOLVED'] as const;
const timings = ['ON_TIME', 'LATE', 'PENDING', 'OVERDUE'] as const;

export class ReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsIn(['own', 'team']) scope: 'own' | 'team' = 'own';
  @IsOptional() @IsDateString() fromWeek?: string;
  @IsOptional() @IsDateString() toWeek?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsIn(reportStatuses) status?: string;
  @IsOptional() @IsUUID() memberId?: string;
}
export class CreateReportDto {
  @IsDateString() weekStart!: string;
}
export class ComplianceQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsDateString() weekStart!: string;
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsIn(timings) submissionTiming?: string;
  @IsOptional()
  @IsIn(['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'NEEDS_CORRECTION', 'APPROVED'])
  reportState?: string;
}
export class ReportTaskInputDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsUUID() sourceTaskId?: string | null;
  @IsOptional() @IsUUID() projectId?: string | null;
  @IsIn(sections) section!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsIn(priorities) priority!: string;
  @IsOptional() @IsIn(taskStatuses) status?: string | null;
  @IsOptional() @IsNumber() plannedCompletionPct?: number | null;
  @IsOptional() @IsNumber() actualCompletionPct?: number | null;
  @IsOptional() @IsInt() @Min(0) plannedMinutes?: number | null;
  @IsOptional() @IsInt() @Min(0) actualMinutes?: number | null;
  @IsIn(taskTypes) taskType!: string;
  @IsOptional() @IsString() @MaxLength(10000) deliverable?: string | null;
  @IsInt() @Min(0) displayOrder!: number;
}
export class BlockerInputDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MaxLength(10000) description!: string;
  @IsBoolean() isKey!: boolean;
  @IsIn(blockerStatuses) status!: string;
  @IsInt() @Min(0) displayOrder!: number;
}
export class AchievementInputDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MaxLength(10000) description!: string;
  @IsBoolean() isKey!: boolean;
  @IsInt() @Min(0) displayOrder!: number;
}
export class SaveVersionDto {
  @IsUUID() versionId!: string;
  @IsInt() @Min(1) lockVersion!: number;
  @IsOptional() @IsString() @MaxLength(10000) notes!: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTaskInputDto)
  tasks!: ReportTaskInputDto[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockerInputDto)
  blockers!: BlockerInputDto[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AchievementInputDto)
  achievements!: AchievementInputDto[];
}
export class CandidateQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsIn(sections) section!: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() projectId?: string;
}
export class ImportTasksDto {
  @IsUUID() versionId!: string;
  @IsInt() @Min(1) lockVersion!: number;
  @IsIn(sections) section!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  taskIds!: string[];
}
export class SubmitReportDto {
  @IsUUID() versionId!: string;
  @IsInt() @Min(1) lockVersion!: number;
}
export class ReviewDto {
  @IsUUID() versionId!: string;
  @IsIn(['APPROVED', 'CHANGES_REQUESTED']) decision!: string;
  @IsOptional() @IsString() @MaxLength(10000) comment?: string | null;
}
export class VersionsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
export class PersonResponseDto {
  id!: string;
  firstName!: string;
  lastName!: string;
}
export class ReviewResponseDto {
  id!: string;
  reportVersionId!: string;
  reviewer!: PersonResponseDto;
  decision!: string;
  comment!: string | null;
  createdAt!: string;
}
export class ReportVersionResponseDto {
  id!: string;
  reportId!: string;
  versionNumber!: number;
  lockVersion!: number;
  createdAt!: string;
  updatedAt!: string;
  submittedAt!: string | null;
  review!: ReviewResponseDto | null;
  notes!: string | null;
  tasks!: unknown[];
  blockers!: unknown[];
  achievements!: unknown[];
}
export class ReportDetailResponseDto {
  id!: string;
  member!: PersonResponseDto;
  weekStart!: string;
  weekEnd!: string;
  deadlineAt!: string;
  status!: string;
  firstSubmittedAt!: string | null;
  submissionTiming!: string;
  latestSubmittedVersionId!: string | null;
  createdAt!: string;
  updatedAt!: string;
  content!: ReportVersionResponseDto | null;
  latestReview!: ReviewResponseDto | null;
}
