import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequestGuard, Bodyless } from './auth-request.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './auth-context';
import type { AuthenticatedUser } from './auth-context';
import {
  AcceptInvitationDto,
  ChangePasswordDto,
  InvitationTokenDto,
  LoginDto,
} from './dto/auth-request.dto';
import {
  ActivationDto,
  AuthTokensDto,
  InvitationPrefillDto,
} from './dto/auth-response.dto';
import { RefreshCookieService } from './refresh-cookie.service';
import { ApiAuthErrors, ApiEmptySuccess, ApiSuccess } from '../common/api-docs';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@ApiHeader({
  name: 'Origin',
  required: true,
  description:
    'Exact allowed frontend origin; mandatory CSRF protection on all auth operations.',
})
@Controller('auth')
@UseGuards(AuthRequestGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: RefreshCookieService,
  ) {}
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'A01 Login' })
  @ApiSuccess(AuthTokensDto, true)
  @ApiAuthErrors('INVALID_CREDENTIALS')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto, request.get('user-agent'));
    this.cookies.set(response, result.refreshToken, result.expiresAt);
    return result.data;
  }
  @Post('refresh')
  @HttpCode(200)
  @Bodyless()
  @ApiCookieAuth('refreshToken')
  @ApiOperation({
    summary: 'A02 Rotate the refresh credential; no request body',
  })
  @ApiSuccess(AuthTokensDto, true)
  @ApiAuthErrors('INVALID_REFRESH_SESSION')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.refresh(this.cookies.read(request));
    this.cookies.set(response, result.refreshToken, result.expiresAt);
    return result.data;
  }
  @Post('logout')
  @HttpCode(204)
  @Bodyless()
  @ApiOperation({
    summary:
      'A03 Logout; optional refresh cookie, independent of access JWT expiry',
  })
  @ApiEmptySuccess()
  @ApiAuthErrors()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      await this.auth.logout(this.cookies.read(request));
    } finally {
      this.cookies.clear(response);
    }
  }
  @Post('change-password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'A04 Change password and revoke every session' })
  @ApiEmptySuccess()
  @ApiAuthErrors('CURRENT_PASSWORD_INCORRECT')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.changePassword(user, dto);
    this.cookies.clear(response);
  }
  @Post('invitations/check')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'A05 Read invitation prefill without consumption' })
  @ApiSuccess(InvitationPrefillDto)
  @ApiAuthErrors('INVALID_INVITATION')
  check(@Body() dto: InvitationTokenDto) {
    return this.auth.checkInvitation(dto.token);
  }
  @Post('accept-invitation')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'A06 Activate the invited account; does not log in',
  })
  @ApiSuccess(ActivationDto)
  @ApiAuthErrors('INVALID_INVITATION')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.auth.acceptInvitation(dto);
  }
}
