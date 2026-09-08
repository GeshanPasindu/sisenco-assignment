export interface SuccessResponse<T> {
  data: T
  meta: { requestId: string }
}

export interface PaginatedResponse<T> {
  data: {
    data: T[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
      hasMore: boolean
    }
  }
  meta: { requestId: string }
}

export interface ApiFieldError {
  field: string
  code: string
  message: string
}

export interface ApiErrorResponse {
  error: {
    statusCode: number
    code: string
    message: string
    details: ApiFieldError[]
    context: Record<string, unknown> | null
  }
  meta: { requestId: string }
}

/** Only these safe values enter Redux or appear in the interface. */
export interface ApiError {
  statusCode: number | null
  code: string
  message: string
  fieldErrors: ApiFieldError[]
  requestId?: string
}

export interface ApiMeta {
  requestId?: string
}
