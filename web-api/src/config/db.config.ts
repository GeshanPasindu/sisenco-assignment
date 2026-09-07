import { registerAs } from '@nestjs/config';

export default registerAs('db', () => ({
  databaseUrl: process.env.DATABASE_URL,
}));
