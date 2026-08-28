import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CapitalEntry,
  Contract,
  ContractFunding,
  ExpenseEntry,
  Payment,
} from '../database/entities';
import { InvestorsModule } from '../investors/investors.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** Module 8 (SRS §4.8): the internal summary workbook. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Payment,
      CapitalEntry,
      ExpenseEntry,
      ContractFunding,
    ]),
    // BR-25 nets investor participation out of the house's figures, and
    // FR-SUM-11 reports what was netted out.
    InvestorsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
