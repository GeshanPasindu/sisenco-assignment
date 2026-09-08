import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  secret: Buffer;
  issuer: string;
  audience: string;
  origins: string[];
  secure: boolean;
  sameSite: 'lax' | 'none';
  accessSeconds: number;
  refreshSeconds: number;
  passwordMinLength: number;
  passwordMaxLength: number;
}

export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const environment = env.NODE_ENV ?? 'development';
  const secret = env.JWT_SECRET;
  if (
    !secret ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(secret) ||
    Buffer.from(secret, 'base64').length < 32
  ) {
    throw new Error(
      'JWT_SECRET must be a base64-encoded random secret of at least 32 bytes.',
    );
  }
  const issuer = env.JWT_ISSUER;
  const audience = env.JWT_AUDIENCE;
  if (!issuer?.trim() || !audience?.trim())
    throw new Error('JWT_ISSUER and JWT_AUDIENCE are required.');
  const origins = (env.CORS_ORIGINS ?? env.CORS_ORIGN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origins.length)
    throw new Error('CORS_ORIGINS must specify the frontend origins.');
  for (const origin of origins) {
    const url = new URL(origin);
    const localHttp =
      environment === 'development' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.origin !== origin || (url.protocol !== 'https:' && !localHttp))
      throw new Error(
        'Origins must be exact HTTPS origins, or loopback HTTP in development.',
      );
  }
  if (
    env.COOKIE_SECURE !== undefined &&
    !['true', 'false'].includes(env.COOKIE_SECURE)
  )
    throw new Error('COOKIE_SECURE must be true or false.');
  const secure =
    env.COOKIE_SECURE === undefined ? true : env.COOKIE_SECURE === 'true';
  const sameSite = env.COOKIE_SAME_SITE ?? 'lax';
  if (sameSite !== 'lax' && sameSite !== 'none')
    throw new Error('COOKIE_SAME_SITE must be lax or none.');
  if (
    !secure &&
    (environment !== 'development' ||
      origins.some(
        (o) =>
          !['localhost', '127.0.0.1', '[::1]'].includes(new URL(o).hostname),
      ))
  )
    throw new Error('Insecure cookies are restricted to loopback development.');
  if (sameSite === 'none' && !secure)
    throw new Error('SameSite=None requires Secure cookies.');
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = env[key] === undefined ? fallback : Number(env[key]);
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw new Error(`${key} must be an integer between ${min} and ${max}.`);
    return value;
  };
  const passwordMinLength = integer('PASSWORD_MIN_LENGTH', 8, 8, 128);
  const passwordMaxLength = integer(
    'PASSWORD_MAX_LENGTH',
    128,
    passwordMinLength,
    1024,
  );
  return {
    secret: Buffer.from(secret, 'base64'),
    issuer,
    audience,
    origins,
    secure,
    sameSite,
    accessSeconds: integer('ACCESS_TOKEN_SECONDS', 900, 1, 3600),
    refreshSeconds: integer('REFRESH_SESSION_SECONDS', 604800, 60, 2592000),
    passwordMinLength,
    passwordMaxLength,
  };
}

export default registerAs('auth', () => loadAuthConfig());
