import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { InvestorBucket } from '../../common/enums';
import { trim } from '../../common/normalise';

/**
 * FR-IVT-08. The only way to correct a mis-entered line.
 *
 * The amount is **signed**: a deposit recorded 100,000 too high is corrected
 * with −100,000, not by editing the original away. The reason is required,
 * because an adjustment with no explanation is indistinguishable from a
 * mistake of its own.
 */
export class CreateAdjustmentDto {
  @ApiProperty({
    example: -100000,
    description: 'Signed. Negative reduces the bucket, positive increases it.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-9_999_999_999)
  @Max(9_999_999_999)
  amount: number;

  @ApiProperty({ enum: InvestorBucket })
  @IsEnum(InvestorBucket)
  bucket: InvestorBucket;

  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601()
  txn_date: string;

  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Say why this adjustment is being made' })
  @MaxLength(500)
  reason: string;
}
