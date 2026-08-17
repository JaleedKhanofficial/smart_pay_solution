import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    LoginAttemptsService,
    JwtAccessStrategy,
  ],
  exports: [AuthService, PasswordService],
})
export class AuthModule {}
