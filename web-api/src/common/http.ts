import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  ValidationError,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map } from 'rxjs/operators';
import { ApiError, FieldError, validationFailed } from './api-error';

export type ApiRequest = Request & { requestId: string; bodyLength?: number };
export function validationException(errors: ValidationError[]) {
  const details: FieldError[] = [];
  const visit = (items: ValidationError[], prefix = '') => {
    for (const item of items) {
      const field = prefix + item.property;
      for (const code of Object.keys(item.constraints ?? {}))
        details.push({
          field,
          code:
            code === 'whitelistValidation' ? 'UNKNOWN_FIELD' : 'INVALID_VALUE',
          message:
            code === 'whitelistValidation'
              ? 'This field is not allowed.'
              : 'Invalid field value.',
        });
      visit(item.children ?? [], `${field}.`);
    }
  };
  visit(errors);
  return validationFailed(details);
}

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    return next.handle().pipe(
      map((data: unknown) =>
        http.getResponse<Response>().statusCode === 204
          ? undefined
          : {
              data,
              meta: { requestId: http.getRequest<ApiRequest>().requestId },
            },
      ),
    );
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<ApiRequest>();
    if (response.headersSent) return;
    let status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const errorCode =
      typeof exception === 'object' && exception !== null && 'code' in exception
        ? String(exception.code)
        : '';
    if (
      [
        'P1001',
        'P1002',
        'P1008',
        'P1017',
        'P2024',
        'P2028',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
      ].includes(errorCode)
    )
      status = 503;
    // Express parser errors are not Nest HttpExceptions.
    if (exception instanceof SyntaxError && 'body' in exception) status = 400;
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'type' in exception &&
      exception.type === 'entity.too.large'
    )
      status = 413;
    const defaults: Record<number, [string, string]> = {
      400: ['VALIDATION_FAILED', 'Request validation failed.'],
      401: ['UNAUTHENTICATED', 'Authentication is required.'],
      403: ['FORBIDDEN', 'Access is forbidden.'],
      404: ['NOT_FOUND', 'Resource not found.'],
      413: ['VALIDATION_FAILED', 'Request body is too large.'],
      429: ['RATE_LIMITED', 'Too many requests.'],
      500: ['INTERNAL_ERROR', 'An internal error occurred.'],
      503: ['SERVICE_UNAVAILABLE', 'Service is temporarily unavailable.'],
    };
    const [code, message] = defaults[status] ?? defaults[500];
    const error =
      exception instanceof ApiError
        ? exception.getResponse()
        : { statusCode: status, code, message, details: [], context: null };
    if (status === 429 && !response.hasHeader('Retry-After'))
      response.setHeader('Retry-After', '60');
    response
      .status(status)
      .json({ error, meta: { requestId: request.requestId } });
  }
}
