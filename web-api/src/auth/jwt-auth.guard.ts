import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { unauthenticated } from '../common/api-error';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    error: unknown,
    user: TUser | false | null,
  ): TUser {
    if (error instanceof Error) throw error;
    if (error) throw unauthenticated();
    if (!user) throw unauthenticated();
    return user;
  }
}
