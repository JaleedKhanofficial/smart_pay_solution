import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../database/entities';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Module 12 (SRS §4.12). Global, because settings are read by contracts,
 * payments and the ledger — every one of which previously reached into the
 * table itself with its own default.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
