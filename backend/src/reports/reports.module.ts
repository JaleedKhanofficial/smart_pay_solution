import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CapitalEntry,
  Contract,
  ExpenseEntry,
  Payment,
} from '../database/entities';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** Module 8 (SRS §4.8): the internal summary workbook. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Payment, CapitalEntry, ExpenseEntry]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
