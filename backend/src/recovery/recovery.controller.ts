import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Paginated } from '../common/pagination';
import { ListRecoveryDto } from './dto/list-recovery.dto';
import {
  RecoveryService,
  type RecoveryRow,
  type RecoveryTotals,
  type SnapshotDetail,
  type SnapshotResponse,
} from './recovery.service';

/** Module 7 (SRS §4.7). The recovery register; readable by any signed-in role. */
@ApiTags('recovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get()
  @ApiOperation({ summary: 'Contracts by recovery health (FR-REC-01-v2)' })
  findAll(@Query() query: ListRecoveryDto): Promise<{
    rows: Paginated<RecoveryRow>;
    totals: RecoveryTotals;
  }> {
    return this.recovery.findAll(query);
  }

  /**
   * FR-REC-08. Read by snapshot id rather than nested under a contract: an
   * archived copy outlives the state it was taken from, and addressing it
   * through the contract would imply otherwise.
   */
  @Get('snapshots/:id')
  @ApiOperation({ summary: 'An archived ledger, exactly as it was stored' })
  snapshot(@Param('id', ParseIntPipe) id: number): Promise<SnapshotDetail> {
    return this.recovery.findSnapshot(id);
  }
}

/**
 * FR-REC-08. Snapshots of one contract.
 *
 * There is no PATCH and no DELETE, and there never will be: an archive that
 * the application can change is not an archive. That is the whole point of
 * replacing v1's editable `recovery_reports` rows.
 */
@ApiTags('recovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts/:contractId/snapshots')
export class SnapshotsController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get()
  @ApiOperation({ summary: 'Archived ledgers for this contract (FR-REC-08)' })
  list(
    @Param('contractId', ParseIntPipe) contractId: number,
  ): Promise<SnapshotResponse[]> {
    return this.recovery.listSnapshots(contractId);
  }

  @Post()
  @ApiOperation({ summary: 'Archive the ledger as it reads now (FR-REC-08)' })
  create(
    @Param('contractId', ParseIntPipe) contractId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SnapshotResponse> {
    return this.recovery.createSnapshot(contractId, user, req.ip);
  }
}
