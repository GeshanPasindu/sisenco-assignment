export type RoleCode = 'TEAM_MEMBER' | 'MANAGER_ADMIN'
export type AccountStatus = 'INVITED' | 'ACTIVE' | 'DEACTIVATED'

export interface RoleDto {
  id: string
  code: RoleCode
  name: string
}

export interface SessionUserDto {
  id: string
  employeeId: string
  email: string
  firstName: string
  lastName: string
  role: RoleDto
  permissions: string[]
  accountStatus: AccountStatus
}

export interface AuthTokensDto {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: SessionUserDto
}

export interface InvitationPrefillDto {
  email: string
  firstName: string
  lastName: string
  expiresAt: string
}

export interface ActivationDto {
  activated: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface CheckInvitationRequest {
  token: string
}

export interface AcceptInvitationRequest {
  token: string
  password: string
  firstName: string
  lastName: string
  personalEmail?: string | null
  contactNumber?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  postalCode?: string | null
}

/** Keep request secrets in a transient closure, never in serializable Redux arguments. */
export type PrivatePayload<T> = () => T

export type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED'

export interface AuthState {
  accessToken: string | null
  user: SessionUserDto | null
  status: AuthStatus
}
