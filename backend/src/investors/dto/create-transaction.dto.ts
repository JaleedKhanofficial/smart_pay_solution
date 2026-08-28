import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InvestorBucket, PaymentMethod } from '../../common/enums';
import { trim } from '../../common/normalise';

const MONEY = { maxDecimalPlaces: 2 } as const;

/**
 * FR-IVT-05 / FR-IVT-06. A deposit or a withdrawal.
 *
 * Only the hand-enterable types have a DTO at all: deployment, capital
 * recovery, profit and loss lines are system-generated (FR-IVT-07) and there
 * is deliberately no shape here that could describe one.
 */
export class CreateTransactionDto {
  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(9_999_999_999)
  amount: number;

  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601()
  txn_date: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({
    enum: InvestorBucket,
    description:
      'Withdrawals only. Omitted, the withdrawal_source setting decides (FR-IVT-06).',
  })
  @IsOptional()
  @IsEnum(InvestorBucket)
  bucket?: InvestorBucket;

  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'Cheque number, bank reference, or a short note. §5.17 has no separate note column — this is it.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}
