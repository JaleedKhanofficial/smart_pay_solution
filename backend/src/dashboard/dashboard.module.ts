import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Contract,
  ContractFunding,
  Customer,
  Installment,
  Investor,
  Payment,
} from '../database/entities';
import { InvestorsModule } from '../investors/investors.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Module 1 (SRS §4.1): portfolio KPIs, all derived. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Payment,
      Customer,
      Installment,
      Investor,
      ContractFunding,
    ]),
    // FR-DSH-13: the Net capital tile and the per-investor view read the same
    // derived balances the investor register does.
    InvestorsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
