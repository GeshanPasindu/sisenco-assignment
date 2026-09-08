import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
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

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateMeDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  firstName?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  lastName?: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  personalEmail?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactNumber?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;
}

export class CreateUserDto {
  @ApiProperty({ format: 'email' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  firstName!: string;
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  lastName!: string;
  @ApiProperty({ format: 'uuid' })
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu)
  roleId!: string;
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 254 })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  personalEmail?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactNumber?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;
  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  reportingStartWeek?: string;
}

export class UpdateUserDto extends UpdateMeDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string | null;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu)
  roleId?: string;
}

export class ReactivateUserDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  reportingStartWeek?: string;
}

export class ReportingScheduleDto {
  @ApiProperty({ format: 'date' }) @IsDateString() effectiveWeek!: string;
  @ApiProperty() @IsBoolean() required!: boolean;
}

export class UsersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ enum: ['TEAM_MEMBER', 'MANAGER_ADMIN'] })
  @IsOptional()
  @IsIn(['TEAM_MEMBER', 'MANAGER_ADMIN'])
  roleCode?: string;
  @ApiPropertyOptional({ enum: ['INVITED', 'ACTIVE', 'DEACTIVATED'] })
  @IsOptional()
  @IsIn(['INVITED', 'ACTIVE', 'DEACTIVATED'])
  accountStatus?: string;
}

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}
export class ReportingPeriodResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date' }) startWeek!: string;
  @ApiProperty({ format: 'date', nullable: true }) endWeek!: string | null;
}
export class InvitationResponseDto {
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) consumedAt!:
    string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) revokedAt!:
    string | null;
  @ApiProperty({ enum: ['PENDING', 'SENT', 'FAILED'] }) deliveryStatus!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) emailSentAt!:
    string | null;
  @ApiProperty() emailAttemptCount!: number;
}
export class UserDetailResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ type: RoleResponseDto }) role!: RoleResponseDto;
  @ApiProperty({ enum: ['INVITED', 'ACTIVE', 'DEACTIVATED'] })
  accountStatus!: string;
  @ApiProperty({ nullable: true }) position!: string | null;
  @ApiProperty({ nullable: true }) personalEmail!: string | null;
  @ApiProperty({ nullable: true }) contactNumber!: string | null;
  @ApiProperty({ nullable: true }) addressLine1!: string | null;
  @ApiProperty({ nullable: true }) addressLine2!: string | null;
  @ApiProperty({ nullable: true }) city!: string | null;
  @ApiProperty({ nullable: true }) postalCode!: string | null;
  @ApiProperty({ nullable: true }) activatedAt!: string | null;
  @ApiProperty({ nullable: true }) deactivatedAt!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ type: [ReportingPeriodResponseDto] })
  reportingPeriods!: ReportingPeriodResponseDto[];
  @ApiProperty({ type: InvitationResponseDto, nullable: true })
  latestInvitation!: InvitationResponseDto | null;
}
export class MyProfileResponseDto extends UserDetailResponseDto {
  @ApiProperty({ type: [String] }) permissions!: string[];
}
export class ReportingScheduleResponseDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ type: [ReportingPeriodResponseDto] })
  reportingPeriods!: ReportingPeriodResponseDto[];
}
