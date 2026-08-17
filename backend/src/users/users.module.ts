import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

// Module 9 (FR-USR-01..03) adds the admin-facing controller; for now this
// module exists so Auth can resolve and update users.
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
