import {
  Body,
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
import { EntryDto } from './dto/entry.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import {
  ReportsService,
  type EntryResponse,
  type SummaryResponse,
} from './reports.service';

/**
 * Module 8 (SRS §4.8). The internal workbook.
 *
 * Admin only, and not because of the deal rows — an operator may read the
 * summary per §2.3 — but because capital, expenses and net balance are the
 * business's own position, which NFR-15 keeps to the owner. Splitting the
 * response by role would mean two shapes for one screen; a second read-only
 * route for operators is the cleaner answer if that is ever wanted.
 */
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.admin)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'The workbook, computed server-side (FR-SUM-01-v2)',
  })
  summary(@Query() query: SummaryQueryDto): Promise<SummaryResponse> {
    return this.reports.summary(query);
  }

  @Post('capital')
  @ApiOperation({ summary: 'Record capital put in (FR-SUM-02-v2)' })
  addCapital(
    @Body() body: EntryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<EntryResponse> {
    return this.reports.addCapital(body, user, req.ip);
  }

  @Delete('capital/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCapital(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.reports.removeCapital(id, user, req.ip);
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Record an expense (FR-SUM-02-v2)' })
  addExpense(
    @Body() body: EntryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<EntryResponse> {
    return this.reports.addExpense(body, user, req.ip);
  }

  @Delete('expenses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExpense(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.reports.removeExpense(id, user, req.ip);
  }
}
