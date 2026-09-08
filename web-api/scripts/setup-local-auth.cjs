// Fill only missing development settings; never print or replace a secret.
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const filename = '.env';
const existing = fs.readFileSync(filename, 'utf8');
const values = dotenv.parse(existing);
const environment = process.env.NODE_ENV ?? values.NODE_ENV ?? 'development';
const target = new URL(process.env.DATABASE_URL ?? values.DATABASE_URL);
if (
  environment !== 'development' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
) {
  throw new Error('Local auth setup requires a loopback development database.');
}
const defaults = {
  NODE_ENV: 'development',
  JWT_SECRET: randomBytes(48).toString('base64'),
  JWT_ISSUER: 'weekly-report-api',
  JWT_AUDIENCE: 'weekly-report-frontend',
  CORS_ORIGINS: values.CORS_ORIGN || 'http://localhost:5173',
  COOKIE_SECURE: 'false',
  COOKIE_SAME_SITE: 'lax',
  ACCESS_TOKEN_SECONDS: '900',
  REFRESH_SESSION_SECONDS: '604800',
  PASSWORD_MIN_LENGTH: '15',
  PASSWORD_MAX_LENGTH: '128',
};
const placeholder = 'REPLACE_WITH_RANDOM_BASE64_SECRET_OF_AT_LEAST_32_BYTES';
const copiedExample = values.JWT_SECRET === placeholder;
const missing = Object.entries(defaults).filter(
  ([key]) =>
    (values[key] === undefined || (key === 'JWT_SECRET' && copiedExample)) &&
    process.env[key] === undefined,
);
if (copiedExample && missing.some(([key]) => key === 'JWT_SECRET')) {
  fs.writeFileSync(
    filename,
    existing.replace(
      /^JWT_SECRET=REPLACE_WITH_RANDOM_BASE64_SECRET_OF_AT_LEAST_32_BYTES\r?$/m,
      '# JWT_SECRET placeholder replaced by local setup below.',
    ),
  );
}
if (missing.length)
  fs.appendFileSync(
    filename,
    '\n# Local authentication settings\n' +
      missing
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join('\n') +
      '\n',
  );
console.log(
  `Added ${missing.length} missing local auth settings. Existing values and credentials were preserved.`,
);
