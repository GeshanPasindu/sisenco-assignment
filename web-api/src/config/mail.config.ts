import { registerAs } from '@nestjs/config';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  invitationBaseUrl: string;
}

export function loadMailConfig(
  env: NodeJS.ProcessEnv = process.env,
): MailConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(env.SMTP_PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(password))
    throw new Error('SMTP_USER and SMTP_PASSWORD must be set together.');
  const from = env.SMTP_FROM?.trim() || user;
  if (!from) throw new Error('SMTP_FROM is required when SMTP is configured.');
  const invitationBaseUrl = (
    env.INVITATION_URL_BASE ??
    env.CORS_ORIGINS?.split(',')[0] ??
    env.CORS_ORIGN
  )?.trim();
  if (
    !invitationBaseUrl ||
    new URL(invitationBaseUrl).origin !== invitationBaseUrl
  )
    throw new Error('INVITATION_URL_BASE must be an exact frontend origin.');
  if (
    env.SMTP_SECURE !== undefined &&
    !['true', 'false'].includes(env.SMTP_SECURE)
  )
    throw new Error('SMTP_SECURE must be true or false.');
  return {
    host,
    port,
    secure:
      env.SMTP_SECURE === undefined ? port === 465 : env.SMTP_SECURE === 'true',
    ...(user && password ? { user, password } : {}),
    from,
    invitationBaseUrl,
  };
}

export default registerAs('mail', () => ({ config: loadMailConfig() }));
