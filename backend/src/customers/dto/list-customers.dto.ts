import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const GUARANTOR_FILTERS = ['two', 'one', 'none'] as const;
export type GuarantorFilter = (typeof GUARANTOR_FILTERS)[number];

export const IMAGE_FILTERS = ['with', 'without'] as const;
export type ImageFilter = (typeof IMAGE_FILTERS)[number];

/** Whitelisted so a query string can never reach an arbitrary column. */
export const SORT_FIELDS = [
  'fullName',
  'cnicNumber',
  'mobileNumber',
  'occupation',
  'createdAt',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Empty query strings arrive as '' from an HTML form; treat them as absent. */
const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-CUS-01 / §7: page, pageSize (default 25, max 100), search and filters. */
export class ListCustomersDto {
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
  pageSize: number = 25;

  @ApiPropertyOptional({ description: 'Matches name, CNIC or mobile' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Exact occupation' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @ApiPropertyOptional({ enum: GUARANTOR_FILTERS })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(GUARANTOR_FILTERS)
  guarantors?: GuarantorFilter;

  @ApiPropertyOptional({
    enum: IMAGE_FILTERS,
    description: 'Whether the customer has a CNIC scan on file',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(IMAGE_FILTERS)
  cnicImage?: ImageFilter;

  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Added on or after',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  addedFrom?: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description: 'Added on or before',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  addedTo?: string;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'createdAt' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort: SortField = 'createdAt';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'desc';
}
