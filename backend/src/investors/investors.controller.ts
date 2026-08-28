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
import type { Paginated } from '../common/pagination';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { CreateInvestorDto } from './dto/create-investor.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListInvestorsDto } from './dto/list-investors.dto';
import { UpdateInvestorDto } from './dto/update-investor.dto';
import type {
  InvestorResponse,
  InvestorRow,
  TransactionResponse,
} from './investor.mapper';
import { InvestorsService } from './investors.service';

/**
 * Module 13. **FR-IVT-16: every route is admin.** An operator receives 403,
 * not a filtered payload — investor identities and figures are not something
 * to trim from a response and hope.
 *
 * Transactions have no PATCH and no DELETE, and never will: §5.17 makes
 * `investor_transactions` append-only, and FR-IVT-08 says a mistake is
 * corrected by a reversing Adjustment rather than by editing the original.
 */
@ApiTags('investors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.admin)
@Controller('investors')
export class InvestorsController {
  constructor(private readonly investors: InvestorsService) {}

  @Post()
  @ApiOperation({ summary: 'Add an investor (FR-IVT-02)' })
  create(
    @Body() body: CreateInvestorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvestorResponse> {
    return this.investors.create(body, user, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'The investor register (FR-IVT-01)' })
  findAll(@Query() query: ListInvestorsDto): Promise<Paginated<InvestorRow>> {
    return this.investors.findAll(query);
  }

  /**
   * FR-CON-11. Investors with money to deploy, for the contract funding panel.
   * Declared before ':id' so the literal path is matched first.
   */
  @Get('fundable')
  @ApiOperation({ summary: 'Active investors with an available balance' })
  fundable() {
    return this.investors.fundable();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One investor: derived balances and ledger (FR-IVT-09)',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.investors.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit an investor (FR-IVT-03)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateInvestorDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<InvestorResponse> {
    return this.investors.update(id, body, user, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove an investor with no money left (FR-IVT-04)',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.investors.remove(id, user, req.ip);
  }

  @Post(':id/deposits')
  @ApiOperation({ summary: 'Record a deposit to principal (FR-IVT-05)' })
  deposit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<TransactionResponse> {
    return this.investors.deposit(id, body, user, req.ip);
  }

  @Post(':id/withdrawals')
  @ApiOperation({ summary: 'Record a withdrawal (FR-IVT-06)' })
  withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<TransactionResponse> {
    return this.investors.withdraw(id, body, user, req.ip);
  }

  @Post(':id/adjustments')
  @ApiOperation({
    summary: 'Correct a line with a signed, reasoned adjustment (FR-IVT-08)',
  })
  adjust(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<TransactionResponse> {
    return this.investors.adjust(id, body, user, req.ip);
  }
}
