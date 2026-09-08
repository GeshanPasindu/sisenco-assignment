import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRequest } from './auth-context';
import { ApiError, unauthenticated } from '../common/api-error';
import { JwtAuthGuard } from './jwt-auth.guard';

const ROLES = 'auth:roles';
const PERMISSIONS = 'auth:permissions';
export const Roles = (...roles: string[]) => SetMetadata(ROLES, roles);
export const Permissions = {
  all: (...codes: string[]) => SetMetadata(PERMISSIONS, { mode: 'all', codes }),
  any: (...codes: string[]) => SetMetadata(PERMISSIONS, { mode: 'any', codes }),
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!user) throw unauthenticated();
    if (!roles.includes(user.role.code))
      throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    return true;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const rule = this.reflector.getAllAndOverride<{
      mode: 'all' | 'any';
      codes: string[];
    }>(PERMISSIONS, [context.getHandler(), context.getClass()]);
    if (!rule) return true;
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!user) throw unauthenticated();
    const granted =
      rule.mode === 'all'
        ? rule.codes.every((c) => user.permissions.includes(c))
        : rule.codes.some((c) => user.permissions.includes(c));
    if (!granted) throw new ApiError(403, 'FORBIDDEN', 'Access is forbidden.');
    return true;
  }
}

// Use with Roles/Permissions metadata on future protected routes.
export const Authorize = () =>
  UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard);
