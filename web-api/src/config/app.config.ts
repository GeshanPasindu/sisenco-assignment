import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number(process.env.PORT) || 3001,
  environment: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGN,
}));
