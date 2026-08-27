import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Contract, Payment } from '../database/entities';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/** Module 6 (SRS §4.6): collection against a contract, inside one transaction. */
@Module({
  imports: [TypeOrmModule.forFeature([Payment, Contract]), AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
