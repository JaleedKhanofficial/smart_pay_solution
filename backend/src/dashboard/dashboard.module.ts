import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Contract,
  Customer,
  Installment,
  Investor,
  Payment,
} from '../database/entities';
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
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
