import type { PaginatedResponse, SuccessResponse } from '../../../services/api/api.types'

export type NotificationType =
  | 'REPORT_SUBMITTED'
  | 'REPORT_RESUBMITTED'
  | 'REPORT_APPROVED'
  | 'REPORT_NEEDS_CORRECTION'
  | 'TASK_ASSIGNED'

export interface NotificationDto {
  id: string
  type: NotificationType
  actor: { id: string; firstName: string; lastName: string }
  title: string
  message: string
  reportId: string | null
  reportVersionId: string | null
  reportReviewId: string | null
  taskId: string | null
  createdAt: string
  readAt: string | null
}

export interface NotificationsQuery {
  readStatus?: 'all' | 'unread' | 'read'
  page?: number
  pageSize?: number
}

export interface UnreadCountDto { count: number }
export interface ReadAllDto { updatedCount: number; readThrough: string }
export type NotificationsResponse = PaginatedResponse<NotificationDto>
export type NotificationResponse = SuccessResponse<NotificationDto>
