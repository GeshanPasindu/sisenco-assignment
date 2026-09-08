import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { AuthConfig } from '../config/auth.config';
import type { ApiRequest } from '../common/http';
import { ApiError, validationFailed } from '../common/api-error';

const BODYLESS = 'auth:bodyless';
export const Bodyless = () => SetMetadata(BODYLESS, true);

@Injectable()
export class AuthRequestGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const settings = this.config.getOrThrow<AuthConfig>('auth');
    if (
      !request.headers.origin ||
      !settings.origins.includes(request.headers.origin)
    )
      throw new ApiError(
        403,
        'FORBIDDEN',
        'A permitted Origin header is required.',
      );
    if (Object.keys(request.query).length)
      throw validationFailed([
        {
          field: 'query',
          code: 'UNKNOWN_FIELD',
          message: 'Query parameters are not allowed.',
        },
      ]);
    const bodyless = this.reflector.get<boolean>(
      BODYLESS,
      context.getHandler(),
    );
    if (bodyless) {
      if (
        request.bodyLength ||
        Number(request.headers['content-length'] ?? 0) > 0 ||
        request.headers['transfer-encoding']
      )
        throw validationFailed([
          {
            field: 'body',
            code: 'UNEXPECTED_BODY',
            message: 'This action has no request body.',
          },
        ]);
    } else if (!request.is('application/json'))
      throw validationFailed([
        {
          field: 'body',
          code: 'INVALID_CONTENT_TYPE',
          message: 'Use application/json.',
        },
      ]);
    return true;
  }
}
