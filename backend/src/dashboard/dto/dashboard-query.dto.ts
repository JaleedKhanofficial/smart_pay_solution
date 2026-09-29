import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * FR-DSH-13 and FR-DSH-16. Narrow every figure to one investor, to a period,
 * or both.
 */
export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Show one investor’s position only.' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id?: number;

  /** First day of the period, inclusive. */
  @ApiPropertyOptional({ example: '2026-01-01' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Last day of the period, inclusive. */
  @ApiPropertyOptional({ example: '2026-06-30' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
