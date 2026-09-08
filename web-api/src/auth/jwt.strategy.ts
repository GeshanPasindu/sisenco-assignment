import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { isUUID } from 'class-validator';
import type { AuthConfig } from '../config/auth.config';
import { AuthService } from './auth.service';
import { unauthenticated } from '../common/api-error';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    const options = config.getOrThrow<AuthConfig>('auth');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: options.secret,
      issuer: options.issuer,
      audience: options.audience,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }
  validate(payload: unknown) {
    if (typeof payload !== 'object' || payload === null)
      throw unauthenticated();
    const claims = payload as Record<string, unknown>;
    if (
      typeof claims.sub !== 'string' ||
      !isUUID(claims.sub) ||
      typeof claims.sid !== 'string' ||
      !isUUID(claims.sid) ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp)
    )
      throw unauthenticated();
    return this.auth.authenticate(claims.sub, claims.sid);
  }
}
