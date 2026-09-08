import type { AccountStatus, RoleDto } from '../../auth/types/auth.types'

export interface MyProfileDto {
  id: string; employeeId: string; email: string; firstName: string; lastName: string
  position: string | null; personalEmail: string | null; contactNumber: string | null
  addressLine1: string | null; addressLine2: string | null; city: string | null; postalCode: string | null
  role: RoleDto; accountStatus: AccountStatus; activatedAt: string | null; deactivatedAt: string | null
  createdAt: string; updatedAt: string; permissions: string[]
}

export interface UpdateMyProfileRequest {
  firstName?: string; lastName?: string; personalEmail?: string | null; contactNumber?: string | null
  addressLine1?: string | null; addressLine2?: string | null; city?: string | null; postalCode?: string | null
}
