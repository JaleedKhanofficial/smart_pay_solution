import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Contract,
  ContractFunding,
  ContractRecycleSnapshot,
  Customer,
  Installment,
  Investor,
  InvestorTransaction,
  Payment,
  Product,
} from '../database/entities';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { FundingService } from './funding.service';

/** Module 4 (SRS §4.4): installment agreements, priced and scheduled server-side. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Installment,
      Customer,
      Product,
      Payment,
      ContractFunding,
      ContractRecycleSnapshot,
      Investor,
      InvestorTransaction,
    ]),
  ],
  controllers: [ContractsController],
  providers: [ContractsService, FundingService],
  exports: [FundingService],
})
export class ContractsModule {}
