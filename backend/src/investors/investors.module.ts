import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsModule } from '../contracts/contracts.module';
import { Investor, InvestorTransaction } from '../database/entities';
import { InvestorsController } from './investors.controller';
import { InvestorsService } from './investors.service';

/** Module 13 (SRS amendment): investor capital. */
@Module({
  // ContractsModule exports FundingService, which is the only thing that
  // reads both an investor's ledger and the contracts their money is in.
  imports: [
    TypeOrmModule.forFeature([Investor, InvestorTransaction]),
    ContractsModule,
  ],
  controllers: [InvestorsController],
  providers: [InvestorsService],
})
export class InvestorsModule {}
