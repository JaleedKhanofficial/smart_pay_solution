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
import { PaymentMethod } from '../../common/enums';

export const PAYMENT_METHODS = [
  PaymentMethod.Cash,
  PaymentMethod.BankTransfer,
  PaymentMethod.Cheque,
] as const;

/** Whitelisted so a query string can never reach an arbitrary column (NFR-13.5). */
export const SORT_FIELDS = [
  'payment_date',
  'amount',
  'method',
  'created_at',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

/** Sorts on a joined name rather than a foreign key. */
export const JOINED_SORTS = ['customer', 'product'] as const;

export const ALL_SORT_FIELDS = [...SORT_FIELDS, ...JOINED_SORTS] as const;
export type PaymentSortField = (typeof ALL_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * FR-PAY-09. Voided payments stay in the list, struck through — hiding them
 * would make the register disagree with the ledger and with the audit log.
 * `voided` narrows to one side when someone is specifically looking.
 */
export const VOID_FILTERS = ['only', 'exclude'] as const;

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-PAY-01 / §7. Newest first, filterable by contract, method and date. */
export class ListPaymentsDto {
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
    description: 'Matches customer name, CNIC, mobile, product or reference',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contract_id?: number;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Paid on or after',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  paid_from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Paid on or before',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  paid_to?: string;

  @ApiPropertyOptional({
    enum: VOID_FILTERS,
    description: 'Default shows both, with voids struck through.',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(VOID_FILTERS)
  voided?: (typeof VOID_FILTERS)[number];

  @ApiPropertyOptional({ enum: ALL_SORT_FIELDS, default: 'payment_date' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(ALL_SORT_FIELDS)
  sort: PaymentSortField = 'payment_date';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'desc';
}
