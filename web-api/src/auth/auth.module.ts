import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import type { AuthConfig } from '../config/auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthRequestGuard } from './auth-request.guard';
import { RefreshCookieService } from './refresh-cookie.service';
import { PermissionsGuard, RolesGuard } from './authorization';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.getOrThrow<AuthConfig>('auth');
        return {
          secret: auth.secret,
          signOptions: {
            algorithm: 'HS256',
            issuer: auth.issuer,
            audience: auth.audience,
            expiresIn: auth.accessSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    AuthRequestGuard,
    RefreshCookieService,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard, PermissionsGuard],
})
export class AuthModule {}
