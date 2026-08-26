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
import { ContractStatus } from '../../common/enums';

export const CONTRACT_STATUS_FILTERS = [
  ContractStatus.active,
  ContractStatus.completed,
  ContractStatus.cancelled,
] as const;

/** FR-CON-01 / FR-DSH-12: contracts carrying an unpaid installment past due. */
export const DUE_FILTERS = ['past_due'] as const;

/** Whitelisted so a query string can never reach an arbitrary column (NFR-13.5). */
export const SORT_FIELDS = [
  'created_at',
  'start_date',
  'end_date',
  'sale_price',
  'financed_amount',
  'status',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

/** Sorts on a joined name rather than a foreign key. */
export const JOINED_SORTS = ['customer', 'product'] as const;

export const ALL_SORT_FIELDS = [...SORT_FIELDS, ...JOINED_SORTS] as const;
export type ContractSortField = (typeof ALL_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Empty query strings arrive as '' from an HTML form; treat them as absent. */
const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-CON-01 / §7. Newest first, filterable by status, customer, product and due state. */
export class ListContractsDto {
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
    description: 'Matches customer name, CNIC, mobile or product',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ enum: CONTRACT_STATUS_FILTERS })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(CONTRACT_STATUS_FILTERS)
  status?: ContractStatus;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id?: number;

  @ApiPropertyOptional({
    enum: DUE_FILTERS,
    description:
      'past_due: at least one unpaid installment a day or more overdue',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(DUE_FILTERS)
  due?: (typeof DUE_FILTERS)[number];

  @ApiPropertyOptional({
    example: '2027-01-01',
    description: 'Started on or after',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  started_from?: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description: 'Started on or before',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  started_to?: string;

  @ApiPropertyOptional({ enum: ALL_SORT_FIELDS, default: 'created_at' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(ALL_SORT_FIELDS)
  sort: ContractSortField = 'created_at';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'desc';
}
