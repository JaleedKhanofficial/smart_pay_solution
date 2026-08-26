import {
  Body,
  Controller,
  Delete,
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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import type {
  CollectableContract,
  PaymentResponse,
  PaymentWriteResult,
} from './payment.mapper';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a collection (FR-PAY-04, FR-PAY-07-v2)' })
  create(
    @Body() body: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<PaymentWriteResult> {
    return this.payments.create(body, user, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'List payments (FR-PAY-01)' })
  findAll(
    @Query() query: ListPaymentsDto,
  ): Promise<Paginated<PaymentResponse>> {
    return this.payments.findAll(query);
  }

  /**
   * FR-PAY-02 / FR-PAY-03. The contract picker with its prefill figures.
   * Declared before ':id' so the literal path is matched first.
   */
  @Get('collectable')
  @ApiOperation({ summary: 'Contracts that can still take money' })
  collectable(): Promise<CollectableContract[]> {
    return this.payments.collectable();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PaymentResponse> {
    return this.payments.findOne(id);
  }

  /**
   * FR-PAY-08-v2. DELETE by verb, void by behaviour: the row is kept, the
   * reason recorded, and the contract's status re-derived. Nothing is erased,
   * which is why this carries a body where a delete normally would not.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Void a payment with a reason (FR-PAY-08-v2)' })
  void(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: VoidPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<PaymentWriteResult> {
    return this.payments.void(id, body, user, req.ip);
  }
}
