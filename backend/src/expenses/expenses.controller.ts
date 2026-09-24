import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import {
  ExpenseDto,
  ListExpensesDto,
  MembersDto,
  PeriodDto,
} from './dto/expense.dto';
import {
  ExpensesService,
  type ExpenseReport,
  type ExpenseResponse,
  type PeriodResponse,
} from './expenses.service';

/**
 * Module 15 (SRS §4.15). Expenses and who carries them.
 *
 * **Admin only.** A common split names every investor and what they owe, which
 * is investor data by any reading of NFR-15.
 */
@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.admin)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  /**
   * BR-31. The matrix. Declared before ':id' so the literal path wins.
   */
  @Get('report')
  @ApiOperation({ summary: 'Expenses by investor and period (BR-31)' })
  report(): Promise<ExpenseReport> {
    return this.expenses.report();
  }

  @Get('periods')
  @ApiOperation({ summary: 'Common expense periods with their members' })
  listPeriods(): Promise<PeriodResponse[]> {
    return this.expenses.listPeriods();
  }

  @Post('periods')
  @ApiOperation({ summary: 'Open a period (BR-28)' })
  createPeriod(
    @Body() body: PeriodDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<PeriodResponse> {
    return this.expenses.createPeriod(body, user, req.ip);
  }

  @Patch('periods/:id')
  @ApiOperation({ summary: 'Rename, re-date, open or close a period' })
  updatePeriod(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PeriodDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<PeriodResponse> {
    return this.expenses.updatePeriod(id, body, user, req.ip);
  }

  @Delete('periods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an empty period' })
  removePeriod(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.expenses.removePeriod(id, user, req.ip);
  }

  /** BR-28/BR-29. Who carries this pot, replaced in one call. */
  @Put('periods/:id/members')
  @ApiOperation({ summary: 'Set a period’s members and waivers' })
  setMembers(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MembersDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<PeriodResponse> {
    return this.expenses.setMembers(id, body, user, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'The expense register (SRS §4.15)' })
  findAll(@Query() query: ListExpensesDto): Promise<ExpenseResponse[]> {
    return this.expenses.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Record an expense' })
  create(
    @Body() body: ExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ExpenseResponse> {
    return this.expenses.create(body, user, req.ip);
  }

  /**
   * Editable, unlike an investor ledger line: this records what the business
   * spent, not a movement of someone's money, and a typo is just a typo.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Correct an expense' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ExpenseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ExpenseResponse> {
    return this.expenses.update(id, body, user, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an expense' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.expenses.remove(id, user, req.ip);
  }
}
