import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('db.databaseUrl');
    const schema =
      new URL(connectionString).searchParams.get('schema') ?? 'public';
    const adapter = new PrismaPg({ connectionString }, { schema });
    super({ adapter });
  }
}
