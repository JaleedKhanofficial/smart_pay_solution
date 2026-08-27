import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Contract,
  Customer,
  Installment,
  Payment,
  Product,
} from '../database/entities';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Module 1 (SRS §4.1): portfolio KPIs, all derived. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Payment,
      Product,
      Customer,
      Installment,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
