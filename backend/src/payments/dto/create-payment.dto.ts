import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../common/enums';
import { trim } from '../../common/normalise';

const MONEY = { maxDecimalPlaces: 2 } as const;
const MAX_MONEY = 9_999_999_999;

/** FR-PAY-04/05. What the collector types; everything else is derived. */
export class CreatePaymentDto {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contract_id: number;

  @ApiProperty({ example: 5500 })
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_MONEY)
  amount: number;

  @ApiProperty({ example: '2026-10-01' })
  @IsISO8601()
  payment_date: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Cheque number, bank reference, or a note.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /**
   * FR-PAY-06-v2. Only consulted when the `allow_overpayment` setting is on:
   * the excess is then accepted, but the collector has to have seen it and
   * said so. With the setting off, this changes nothing — an overpayment is
   * refused whatever the browser sends.
   */
  @ApiPropertyOptional({
    description: 'Acknowledge an amount above the outstanding balance.',
  })
  @IsOptional()
  @IsBoolean()
  confirm_overpayment?: boolean;
}
