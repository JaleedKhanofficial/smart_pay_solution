import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** BR-07's tiers, plus the state before any installment has completed. */
export const TIER_FILTERS = [
  'platinum',
  'gold',
  'silver',
  'caution',
  'awaiting',
] as const;

/** FR-REC-01-v2. Health, as a collector thinks about it. */
export const HEALTH_FILTERS = ['past_due', 'on_track', 'settled'] as const;

export const SORT_FIELDS = [
  'customer',
  'recovered_pct',
  'net_days',
  'outstanding',
  'tier',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-REC-01-v2. The contract list, seen through recovery health. */
export class ListRecoveryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size: number = 25;

  @ApiPropertyOptional({
    description: 'Matches customer name, CNIC or product',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ enum: TIER_FILTERS })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(TIER_FILTERS)
  tier?: (typeof TIER_FILTERS)[number];

  @ApiPropertyOptional({ enum: HEALTH_FILTERS })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(HEALTH_FILTERS)
  health?: (typeof HEALTH_FILTERS)[number];

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'net_days' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort: SortField = 'net_days';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'desc';
}
