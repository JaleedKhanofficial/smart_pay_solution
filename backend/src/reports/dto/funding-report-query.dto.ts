import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ContractStatus } from '../../common/enums';

/**
 * How a contract's capital was raised.
 *
 * `sole` — one investor bought the whole unit.
 * `joint` — two or more put in together.
 */
export const ARRANGEMENTS = ['sole', 'joint'] as const;
export type Arrangement = (typeof ARRANGEMENTS)[number];

export const FUNDING_SORT_FIELDS = [
  'contract_id',
  'customer_name',
  'funded',
  'recovered',
  'start_date',
] as const;
export type FundingSortField = (typeof FUNDING_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-IVT-16. The funding register's filters. */
export class FundingReportQueryDto {
  /** Only deals raised this way. Omitted means both. */
  @ApiPropertyOptional({ enum: ARRANGEMENTS })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(ARRANGEMENTS)
  arrangement?: Arrangement;

  /** Only deals this investor has money in. */
  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id?: number;

  @ApiPropertyOptional({ enum: ContractStatus })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(Object.values(ContractStatus))
  status?: ContractStatus;

  /** Matches a customer, a product or an investor by name. */
  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ enum: FUNDING_SORT_FIELDS, default: 'contract_id' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(FUNDING_SORT_FIELDS)
  sort: FundingSortField = 'contract_id';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'desc';
}
