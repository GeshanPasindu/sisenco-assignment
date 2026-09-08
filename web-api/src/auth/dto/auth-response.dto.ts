import { ApiProperty } from '@nestjs/swagger';

export class RoleDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['TEAM_MEMBER', 'MANAGER_ADMIN'] }) code!: string;
  @ApiProperty() name!: string;
}
export class SessionUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() employeeId!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ type: RoleDto }) role!: RoleDto;
  @ApiProperty({
    type: [String],
    description: 'Every actual current database grant.',
  })
  permissions!: string[];
  @ApiProperty({ enum: ['ACTIVE'] }) accountStatus!: string;
}
export class AuthTokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
  @ApiProperty({ type: SessionUserDto }) user!: SessionUserDto;
}
export class InvitationPrefillDto {
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
export class ActivationDto {
  @ApiProperty({ example: true }) activated!: boolean;
}
