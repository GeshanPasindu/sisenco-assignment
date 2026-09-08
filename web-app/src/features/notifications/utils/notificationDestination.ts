import { ROUTES } from '../../../constants/routes'
import type { NotificationDto } from '../types/notification.types'

export function notificationDestination(notification: NotificationDto) {
  if (notification.taskId) return ROUTES.tasks
  if (notification.reportId || notification.reportVersionId || notification.reportReviewId) {
    return ROUTES.reports
  }
  return ROUTES.notifications
}
