import type { AccountStatus, RoleCode, RoleDto } from '../../auth/types/auth.types'

export type InvitationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED'
export interface ReportingPeriodDto { id: string; startWeek: string; endWeek: string | null }
export interface ManualInvitationDto { token: string; expiresAt: string }
export interface InvitationDto { expiresAt: string; consumedAt: string | null; revokedAt: string | null; deliveryStatus: InvitationDeliveryStatus; emailSentAt: string | null; emailAttemptCount: number; manualInvitation?: ManualInvitationDto }
export interface UserListItemDto { id: string; employeeId: string; email: string; firstName: string; lastName: string; role: RoleDto; accountStatus: AccountStatus; createdAt: string; invitationDeliveryStatus: InvitationDeliveryStatus | null }
export interface UserDetailDto extends UserListItemDto { position: string | null; personalEmail: string | null; contactNumber: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; postalCode: string | null; activatedAt: string | null; deactivatedAt: string | null; updatedAt: string; reportingPeriods: ReportingPeriodDto[]; latestInvitation: InvitationDto | null }
export interface UsersQuery { q?: string; roleCode?: RoleCode; accountStatus?: AccountStatus; page: number; pageSize: number }
export interface CreateUserRequest { email: string; firstName: string; lastName: string; roleId: string; position?: string | null; personalEmail?: string | null; contactNumber?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; postalCode?: string | null; reportingStartWeek?: string }
export interface UpdateUserRequest { id: string; firstName?: string; lastName?: string; personalEmail?: string | null; contactNumber?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; postalCode?: string | null; position?: string | null; roleId?: string }
export interface ReportingScheduleRequest { id: string; effectiveWeek: string; required: boolean }
