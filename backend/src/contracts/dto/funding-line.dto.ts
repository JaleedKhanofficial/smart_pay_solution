import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim } from '../../common/normalise';

/**
 * FR-CON-11. One investor's stake in a contract, as the funding panel sends it.
 *
 * The share percentage is **not** here: BR-15 computes it from the amount
 * against the cost price, so a caller cannot state a share that disagrees with
 * the money. The profit share is optional and seeded from the investor's own
 * rate; overriding it needs a reason (FR-CON-12).
 */
export class FundingLineDto {
  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id: number;

  @ApiProperty({ example: 200000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999)
  amount: number;

  @ApiPropertyOptional({
    description:
      'BR-16. Omitted, the investor’s own rate applies. Overriding needs a reason.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  profit_share_pct?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  share_override_reason?: string;
}
