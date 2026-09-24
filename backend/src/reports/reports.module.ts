import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CapitalEntry,
  Contract,
  ContractFunding,
  Investor,
  Payment,
} from '../database/entities';
import { ExpensesModule } from '../expenses/expenses.module';
import { InvestorsModule } from '../investors/investors.module';
import { FundingReportService } from './funding-report.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** Module 8 (SRS §4.8): the internal summary workbook. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Payment,
      CapitalEntry,
      ContractFunding,
      Investor,
    ]),
    // FR-SUM-11 reports the investor position beside the portfolio.
    InvestorsModule,
    // SRS §4.15 owns what the business spends; the workbook only totals it.
    ExpensesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, FundingReportService],
})
export class ReportsModule {}
