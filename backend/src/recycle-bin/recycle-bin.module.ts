import { Module } from '@nestjs/common';
import { ContractsModule } from '../contracts/contracts.module';
import { RecycleBinController } from './recycle-bin.controller';
import { RecycleBinService } from './recycle-bin.service';

/**
 * Module 10 (SRS §4.10). No `forFeature`: the service works through the
 * DataSource's manager because the entity it operates on is chosen at runtime
 * from the registry, not injected per kind.
 */
@Module({
  imports: [ContractsModule],
  controllers: [RecycleBinController],
  providers: [RecycleBinService],
})
export class RecycleBinModule {}
