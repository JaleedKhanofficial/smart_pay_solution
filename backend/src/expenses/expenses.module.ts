import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import {
  Expense,
  ExpensePeriod,
  ExpensePeriodMember,
  Investor,
} from '../database/entities';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

/** Module 15 (SRS §4.15): what the business spends, and who carries it. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expense,
      ExpensePeriod,
      ExpensePeriodMember,
      Investor,
    ]),
    AuditModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  // The Summary Report nets expenses off its balance, and investor balances
  // net off what each investor carries.
  exports: [ExpensesService],
})
export class ExpensesModule {}
