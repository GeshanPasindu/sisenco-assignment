import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ maxLength: 254, format: 'email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    writeOnly: true,
    description:
      'Unmodified password; login does not apply the new-password policy.',
  })
  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    writeOnly: true,
    minLength: 8,
    maxLength: 128,
    description:
      'Configured new-password policy; spaces and Unicode allowed, never trimmed.',
  })
  @IsString()
  newPassword!: string;
}

export class InvitationTokenDto {
  @ApiProperty({ writeOnly: true, maxLength: 512 })
  @IsString()
  @Length(1, 512)
  token!: string;
}

export class AcceptInvitationDto extends InvitationTokenDto {
  @ApiProperty({ writeOnly: true, minLength: 8, maxLength: 128 })
  @IsString()
  password!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @Matches(/\S/u)
  firstName!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @Matches(/\S/u)
  lastName!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 254, format: 'email' })
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
