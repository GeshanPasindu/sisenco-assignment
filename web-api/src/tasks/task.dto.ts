import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  IsNumber,
} from 'class-validator';

const statuses = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const types = [
  'DEVELOPMENT',
  'TESTING',
  'MEETINGS',
  'DOCUMENTATION',
  'OTHER',
] as const;
export class TaskQueryDto {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
  @IsOptional() @IsIn(['own', 'team']) scope: 'own' | 'team' = 'own';
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsIn(['false', 'true', 'all']) archived:
    'false' | 'true' | 'all' = 'false';
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsIn(statuses) status?: string;
  @IsOptional() @IsUUID() memberId?: string;
}
export class CreateTaskDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiProperty() @IsUUID() projectId!: string;
  @ApiProperty({ format: 'date' }) @IsDateString() plannedDate!: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
  @ApiPropertyOptional({ enum: priorities })
  @IsOptional()
  @IsIn(priorities)
  priority?: string;
  @ApiPropertyOptional({ enum: types })
  @IsOptional()
  @IsIn(types)
  taskType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  plannedCompletionPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) plannedMinutes?: number;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() projectId?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  plannedDate?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
  @ApiPropertyOptional({ enum: priorities })
  @IsOptional()
  @IsIn(priorities)
  priority?: string;
  @ApiPropertyOptional({ enum: types })
  @IsOptional()
  @IsIn(types)
  taskType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  plannedCompletionPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) plannedMinutes?: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) lockVersion!: number;
  @ApiPropertyOptional({ enum: statuses })
  @IsOptional()
  @IsIn(statuses)
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() actualCompletionPct?: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  deliverable?: string | null;
}
export class AssignTaskDto {
  @IsUUID() assigneeId!: string;
  @IsInt() @Min(1) lockVersion!: number;
}
export class ArchiveTaskDto {
  @IsInt() @Min(1) lockVersion!: number;
}
export class TimeQueryDto extends TaskQueryDto {
  @IsOptional() @IsUUID() taskId?: string;
}
export class CreateTimeEntryDto {
  @IsDateString() workDate!: string;
  @IsInt() @Min(1) @Max(1440) minutes!: number;
  @IsOptional() @IsString() @MaxLength(10000) note?: string | null;
}
export class UpdateTimeEntryDto {
  @IsOptional() @IsDateString() workDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1440) minutes?: number;
  @IsOptional() @IsString() @MaxLength(10000) note?: string | null;
}
export class PersonDto {
  id!: string;
  firstName!: string;
  lastName!: string;
}
export class TaskResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  project!: { id: string; name: string };
  createdBy!: PersonDto;
  assignee!: PersonDto;
  plannedDate!: string;
  dueDate!: string | null;
  priority!: string;
  status!: string;
  taskType!: string;
  plannedCompletionPct!: number;
  actualCompletionPct!: number;
  plannedMinutes!: number;
  loggedMinutes!: number;
  deliverable!: string | null;
  completedAt!: string | null;
  lockVersion!: number;
  archivedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
export class TimeEntryResponseDto {
  id!: string;
  task!: { id: string; name: string; project: { id: string; name: string } };
  user!: PersonDto;
  workDate!: string;
  minutes!: number;
  note!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
