import type { SuccessResponse } from '../../../services/api/api.types'
import { isRecord } from '../../../services/api/error.utils'
import type { ActivationDto, AuthTokensDto, InvitationPrefillDto } from '../types/auth.types'

function hasEnvelope(value: unknown): value is { data: Record<string, unknown>; meta: { requestId: string } } {
  return isRecord(value) && isRecord(value.data) && isRecord(value.meta) &&
    typeof value.meta.requestId === 'string'
}

export function isAuthResponse(value: unknown): value is SuccessResponse<AuthTokensDto> {
  if (!hasEnvelope(value)) return false
  const { data } = value
  const user = data.user
  return typeof data.accessToken === 'string' && data.accessToken.length > 0 &&
    data.tokenType === 'Bearer' && typeof data.expiresIn === 'number' &&
    Number.isFinite(data.expiresIn) && data.expiresIn > 0 && isRecord(user) &&
    ['id', 'employeeId', 'email', 'firstName', 'lastName'].every((key) => typeof user[key] === 'string') &&
    isRecord(user.role) && typeof user.role.id === 'string' && typeof user.role.name === 'string' &&
    (user.role.code === 'TEAM_MEMBER' || user.role.code === 'MANAGER_ADMIN') &&
    Array.isArray(user.permissions) && user.permissions.every((code: unknown) => typeof code === 'string') &&
    user.accountStatus === 'ACTIVE'
}

export function isInvitationResponse(value: unknown): value is SuccessResponse<InvitationPrefillDto> {
  return hasEnvelope(value) && ['email', 'firstName', 'lastName', 'expiresAt']
    .every((key) => typeof value.data[key] === 'string')
}

export function isActivationResponse(value: unknown): value is SuccessResponse<ActivationDto> {
  return hasEnvelope(value) && value.data.activated === true
}
