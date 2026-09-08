import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ProjectsQueryDto {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
  @IsOptional() @IsIn(['false', 'true', 'all']) archived:
    'false' | 'true' | 'all' = 'false';
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() memberId?: string;
}
export class CreateProjectDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @MaxLength(150) name!: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  clientName?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}
export class UpdateProjectDto extends CreateProjectDto {}
export class SetProjectMembersDto {
  @IsArray()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu, {
    each: true,
  })
  memberIds!: string[];
}
export class RoleLookupDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}
export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) clientName!: string | null;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({ nullable: true, format: 'date' }) startDate!: string | null;
  @ApiProperty({ nullable: true, format: 'date' }) endDate!: string | null;
  @ApiProperty({ nullable: true, format: 'date-time' }) archivedAt!:
    string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
