import { Module } from '@nestjs/common';
import { RecycleBinController } from './recycle-bin.controller';
import { RecycleBinService } from './recycle-bin.service';

/**
 * Module 10 (SRS §4.10). No `forFeature`: the service works through the
 * DataSource's manager because the entity it operates on is chosen at runtime
 * from the registry, not injected per kind.
 */
@Module({
  controllers: [RecycleBinController],
  providers: [RecycleBinService],
})
export class RecycleBinModule {}
