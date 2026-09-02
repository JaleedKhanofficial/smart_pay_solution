import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

/**
 * FR-CON-11. One investor's stake in a contract, as the funding panel sends it.
 *
 * The share percentage is **not** here: BR-15 computes it from the amount
 * against the cost price, so a caller cannot state a share that disagrees with
 * the money.
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
}
