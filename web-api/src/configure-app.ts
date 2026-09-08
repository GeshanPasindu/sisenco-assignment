import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { json } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AuthConfig } from './config/auth.config';
import type { ApiRequest } from './common/http';
import { validationException } from './common/http';
import { ApiError } from './common/api-error';

// Used by production bootstrap and HTTP integration tests alike.
export function configureApp(app: INestApplication) {
  const settings = app.get(ConfigService).getOrThrow<AuthConfig>('auth');
  app.setGlobalPrefix('api/v1');
  app.use((request: ApiRequest, response: Response, next: NextFunction) => {
    const candidate = request.headers['x-request-id'];
    request.requestId =
      typeof candidate === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(candidate)
        ? candidate
        : randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    if (request.path.startsWith('/api/v1/auth'))
      response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(helmet());
  app.enableCors({
    origin: (
      origin: string | undefined,
      done: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || settings.origins.includes(origin)) done(null, true);
      else done(new ApiError(403, 'FORBIDDEN', 'Origin is not permitted.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.use(cookieParser());
  app.use(
    json({
      limit: '32kb',
      verify: (request, _response, buffer) => {
        (request as ApiRequest).bodyLength = buffer.length;
      },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
      exceptionFactory: validationException,
    }),
  );
  const document = new DocumentBuilder()
    .setTitle('StorePilot-Web-API')
    .setDescription(
      'Weekly reporting API. Auth routes require an allowed Origin. Refresh uses an HttpOnly cookie and no JSON body.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(
      'refreshToken',
      { type: 'apiKey', in: 'cookie' },
      'refreshToken',
    )
    .build();
  SwaggerModule.setup('api', app, () => {
    const api = SwaggerModule.createDocument(app, document);
    for (const [model, field] of [
      ['AcceptInvitationDto', 'password'],
      ['ChangePasswordDto', 'newPassword'],
    ]) {
      const schema = api.components?.schemas?.[model];
      const property =
        schema && 'properties' in schema
          ? schema.properties?.[field]
          : undefined;
      if (property && !('$ref' in property)) {
        property.minLength = settings.passwordMinLength;
        property.maxLength = settings.passwordMaxLength;
      }
    }
    return api;
  });
}
