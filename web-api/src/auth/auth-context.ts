import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiRequest } from '../common/http';
import { unauthenticated } from '../common/api-error';

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  role: { id: string; code: string; name: string };
  permissions: string[];
}
export type AuthRequest = ApiRequest & { user?: AuthenticatedUser };
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const user = ctx.switchToHttp().getRequest<AuthRequest>().user;
    if (!user) throw unauthenticated();
    return user;
  },
);
