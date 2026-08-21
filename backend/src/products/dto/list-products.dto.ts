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
import { ProductStatus } from '../../common/enums';

export const PRODUCT_STATUS_FILTERS = [
  ProductStatus.Active,
  ProductStatus.Inactive,
] as const;

/** Whitelisted so a query string can never reach an arbitrary column (NFR-13.5). */
export const SORT_FIELDS = ['name', 'status', 'created_at'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

/** Category sorts by the joined name, so it is handled separately. */
export const CATEGORY_SORT = 'category';

export const ALL_SORT_FIELDS = [...SORT_FIELDS, CATEGORY_SORT] as const;
export type ProductSortField = (typeof ALL_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Empty query strings arrive as '' from an HTML form; treat them as absent. */
const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * FR-PRD-01 / §7. Defaults to name ascending, which is what the clause asks
 * for and what a catalogue is actually read in.
 */
export class ListProductsDto {
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

  @ApiPropertyOptional({ description: 'Matches the product name' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ description: 'product_categories.id' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id?: number;

  @ApiPropertyOptional({ enum: PRODUCT_STATUS_FILTERS })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(PRODUCT_STATUS_FILTERS)
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: ALL_SORT_FIELDS, default: 'name' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(ALL_SORT_FIELDS)
  sort: ProductSortField = 'name';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'asc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'asc';
}
