import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../common/enums';
import { ListBinDto } from './dto/list-bin.dto';
import type { BinKind, BinRow } from './recycle-bin.registry';
import { RecycleBinService, type BinSummary } from './recycle-bin.service';

/** Module 10 (SRS §4.10). Admin only. */
@ApiTags('recycle-bin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.admin)
@Controller('recycle-bin')
export class RecycleBinController {
  constructor(private readonly bin: RecycleBinService) {}

  @Get()
  @ApiOperation({ summary: 'Deleted records, newest first (FR-BIN-01)' })
  findAll(@Query() query: ListBinDto): Promise<BinRow[]> {
    return this.bin.findAll(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'How many of each kind are in the bin' })
  summary(): Promise<BinSummary> {
    return this.bin.summary();
  }

  @Post(':kind/:id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Return a record to service (FR-BIN-02)' })
  restore(
    @Param('kind') kind: BinKind,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.bin.restore(kind, id, user, req.ip);
  }

  /**
   * FR-BIN-03. The only route in the application that destroys data.
   * The typed confirmation is the screen's job; this refuses anything that is
   * not already deleted, and anything still holding dependants.
   */
  @Delete(':kind/:id/purge')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete permanently, audit-logged (FR-BIN-03)' })
  purge(
    @Param('kind') kind: BinKind,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.bin.purge(kind, id, user, req.ip);
  }
}
