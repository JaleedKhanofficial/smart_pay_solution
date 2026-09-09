import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CapitalEntry,
  Contract,
  ContractFunding,
  ExpenseEntry,
  Investor,
  Payment,
} from '../database/entities';
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
      ExpenseEntry,
      ContractFunding,
      Investor,
    ]),
    // FR-SUM-11 reports the investor position beside the portfolio.
    InvestorsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, FundingReportService],
})
export class ReportsModule {}
