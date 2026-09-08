import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class DashboardQueryDto {
  @IsOptional() @IsDateString() weekStart?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) trendWeeks = 6;
}
export class TeamDashboardQueryDto extends DashboardQueryDto {
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsUUID() projectId?: string;
}
export class ActivityQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsUUID() memberId?: string;
}
