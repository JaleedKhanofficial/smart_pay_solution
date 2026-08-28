import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract, LedgerSnapshot, Payment } from '../database/entities';
import { RecoveryController, SnapshotsController } from './recovery.controller';
import { RecoveryService } from './recovery.service';

/** Module 7 (SRS §4.7): the recovery register and its immutable archive. */
@Module({
  imports: [TypeOrmModule.forFeature([Contract, Payment, LedgerSnapshot])],
  controllers: [RecoveryController, SnapshotsController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
