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

/** FR-SUM-05. The scoped search tabs. */
export const SEARCH_SCOPES = ['all', 'name', 'mobile', 'cnic'] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

/** FR-SUM-05. Sortable columns; whitelisted so a query cannot reach further. */
export const SORT_FIELDS = [
  'customer_name',
  'sale_price',
  'paid',
  'pct_completed',
  'score',
  'outstanding',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-SUM-01-v2 / FR-SUM-09. */
export class SummaryQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  page_size: number = 50;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ enum: SEARCH_SCOPES, default: 'all' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SEARCH_SCOPES)
  scope: SearchScope = 'all';

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'customer_name' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort: SortField = 'customer_name';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'asc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'asc';
}
