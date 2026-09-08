import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

const meta = {
  type: 'object' as const,
  required: ['requestId'],
  properties: { requestId: { type: 'string' as const } },
};
export function ApiSuccess(model: Type<unknown>, cookie = false) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      headers: {
        'X-Request-Id': { schema: { type: 'string' } },
        ...(cookie
          ? {
              'Set-Cookie': {
                description:
                  'refreshToken; HttpOnly; Path=/api/v1/auth; Secure (development exception only); SameSite=Lax or None by deployment; absolute remaining lifetime.',
                schema: { type: 'string' },
              },
            }
          : {}),
      },
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: { data: { $ref: getSchemaPath(model) }, meta },
      },
    }),
  );
}
export function ApiAuthErrors(...specific: string[]) {
  return applyDecorators(
    ...[400, 401, 403, 429, 500, 503].map((status) =>
      ApiResponse({
        status,
        description: `${specific.join(', ')}. Common VALIDATION_FAILED, UNAUTHENTICATED, FORBIDDEN, RATE_LIMITED, INTERNAL_ERROR and SERVICE_UNAVAILABLE as applicable.`,
        headers: {
          'X-Request-Id': { schema: { type: 'string' } },
          ...(status === 429
            ? {
                'Retry-After': {
                  schema: { type: 'string' },
                  description: 'Seconds until retry.',
                },
              }
            : {}),
        },
        schema: {
          type: 'object',
          required: ['error', 'meta'],
          properties: {
            meta,
            error: {
              type: 'object',
              required: ['statusCode', 'code', 'message', 'details', 'context'],
              properties: {
                statusCode: { type: 'integer' },
                code: { type: 'string' },
                message: { type: 'string' },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['field', 'code', 'message'],
                    properties: {
                      field: { type: 'string' },
                      code: { type: 'string' },
                      message: { type: 'string' },
                    },
                  },
                },
                context: {
                  type: 'object',
                  nullable: true,
                  additionalProperties: true,
                },
              },
            },
          },
        },
      }),
    ),
  );
}
export function ApiEmptySuccess() {
  return ApiResponse({
    status: 204,
    description:
      'No response body. Refresh cookie is expired with matching attributes.',
    headers: {
      'X-Request-Id': { schema: { type: 'string' } },
      'Set-Cookie': {
        schema: { type: 'string' },
        description:
          'refreshToken=; Max-Age=0; HttpOnly; Path=/api/v1/auth; matching Secure/SameSite.',
      },
    },
  });
}
