import { HttpException } from '@nestjs/common';

export interface FieldError {
  field: string;
  code: string;
  message: string;
}
export class ApiError extends HttpException {
  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: FieldError[] = [],
  ) {
    super({ statusCode, code, message, details, context: null }, statusCode);
  }
}
export const unauthenticated = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
export const invalidCredentials = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
export const invalidRefresh = () =>
  new ApiError(401, 'INVALID_REFRESH_SESSION', 'Invalid refresh session.');
export const invalidInvitation = () =>
  new ApiError(
    400,
    'INVALID_INVITATION',
    'Invitation is invalid or unavailable.',
  );
export const validationFailed = (details: FieldError[] = []) =>
  new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed.', details);
