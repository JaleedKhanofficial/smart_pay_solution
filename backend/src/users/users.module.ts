import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities';
import { UsersService } from './users.service';

// Module 9 (FR-USR-01..03) adds the admin-facing controller; for now this
// module exists so Auth can resolve and update users.
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
