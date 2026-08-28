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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import type { Paginated } from '../common/pagination';
import type {
  ContractDetailResponse,
  ContractResponse,
} from './contract.mapper';
import {
  ContractsService,
  type ContractWriteResult,
} from './contracts.service';
import {
  CreateContractDto,
  PreviewContractDto,
} from './dto/create-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';
import {
  FundingService,
  type FundingResponse,
  type LossPreview,
} from './funding.service';
import type { LedgerResponse } from './ledger.mapper';
import type { InvoiceResponse } from './invoice.mapper';
import { UpdateContractDto } from './dto/update-contract.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly funding: FundingService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Create and activate a contract; the server recomputes every figure (FR-CON-04-v2)',
  })
  create(
    @Body() body: CreateContractDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ContractWriteResult> {
    return this.contracts.create(body, user, req.ip);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Price a contract without saving it — the live plan preview (FR-CON-04-v2)',
  })
  preview(@Body() body: PreviewContractDto) {
    return this.contracts.preview(body);
  }

  @Get()
  @ApiOperation({ summary: 'List contracts (FR-CON-01)' })
  findAll(
    @Query() query: ListContractsDto,
  ): Promise<Paginated<ContractResponse>> {
    return this.contracts.findAll(query);
  }

  /**
   * BR-20 / FR-CON-16. What cancelling or purging this contract would cost its
   * funders, so the confirmation can name them before anyone commits.
   *
   * Admin-only: it reads investor positions, which NFR-15 keeps off an
   * operator's screen — and only an admin can cancel a contract anyway.
   */
  @Get(':id/loss-preview')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Per-investor write-off preview (BR-20)' })
  lossPreview(@Param('id', ParseIntPipe) id: number): Promise<LossPreview[]> {
    return this.funding.previewLoss(id);
  }

  /** FR-CON-11. Who funded this contract, and out of which bucket. */
  @Get(':id/fundings')
  @ApiOperation({ summary: 'The funding rows fixed at activation (FR-CON-11)' })
  fundings(@Param('id', ParseIntPipe) id: number): Promise<FundingResponse[]> {
    return this.funding.forContract(id);
  }

  /** FR-REC-01-v2 / §7. The derived recovery ledger for one contract. */
  @Get(':id/ledger')
  @ApiOperation({
    summary: 'Recovery ledger: per-month grading, summary and loyalty tier',
  })
  ledger(@Param('id', ParseIntPipe) id: number): Promise<LedgerResponse> {
    return this.contracts.ledger(id);
  }

  /** FR-INV-01..05 / §7. Everything the printed agreement renders. */
  @Get(':id/invoice')
  @ApiOperation({
    summary: 'Invoice payload: contract, schedule, customer, guarantors',
  })
  invoice(@Param('id', ParseIntPipe) id: number): Promise<InvoiceResponse> {
    return this.contracts.invoice(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'A contract with its installment schedule' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractDetailResponse> {
    return this.contracts.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a contract; terms lock once a payment exists (FR-CON-07-v2)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ContractWriteResult> {
    return this.contracts.update(id, dto, user, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a contract (FR-CON-09)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.contracts.remove(id, user, req.ip);
  }
}
