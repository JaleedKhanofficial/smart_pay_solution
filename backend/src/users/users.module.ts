import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordService } from '../auth/password.service';
import { User } from '../database/entities';
import { UsersAdminService } from './users-admin.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Module 9 (SRS §4.9). `UsersService` is the slice Auth needs and is exported;
 * `UsersAdminService` is the admin CRUD and stays inside.
 *
 * `PasswordService` is provided here rather than imported from AuthModule,
 * which would be circular — Auth already depends on this module. It is a
 * stateless wrapper around Argon2id, so a second instance costs nothing and
 * both hash identically.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UsersAdminService, PasswordService],
  exports: [UsersService],
})
export class UsersModule {}
