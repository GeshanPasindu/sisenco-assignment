import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FoundationController } from './foundation.controller';
import { FoundationService } from './foundation.service';
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FoundationController],
  providers: [FoundationService],
})
export class FoundationModule {}
