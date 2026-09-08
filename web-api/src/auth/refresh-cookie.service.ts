import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthConfig } from '../config/auth.config';

@Injectable()
export class RefreshCookieService {
  constructor(private readonly config: ConfigService) {}
  read(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.refreshToken;
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
      ? value
      : undefined;
  }
  private options(): CookieOptions {
    const settings = this.config.getOrThrow<AuthConfig>('auth');
    return {
      httpOnly: true,
      secure: settings.secure,
      sameSite: settings.sameSite,
      path: '/api/v1/auth',
    };
  }
  set(response: Response, token: string, expiresAt: Date) {
    response.cookie('refreshToken', token, {
      ...this.options(),
      expires: expiresAt,
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }
  clear(response: Response) {
    response.cookie('refreshToken', '', {
      ...this.options(),
      maxAge: 0,
      expires: new Date(0),
    });
  }
}
