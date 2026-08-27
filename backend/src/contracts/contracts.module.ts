import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Contract,
  Customer,
  Installment,
  Payment,
  Product,
} from '../database/entities';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

/** Module 4 (SRS §4.4): installment agreements, priced and scheduled server-side. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Installment,
      Customer,
      Product,
      Payment,
    ]),
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
