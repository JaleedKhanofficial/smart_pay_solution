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

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * FR-AUD-02. Filterable by entity, actor, action and date range.
 *
 * There is no sort field: an audit log is read newest-first, and letting it be
 * ordered by anything else would invite reading it as a table of records
 * rather than as a sequence of events. Only the direction is offered.
 */
export class ListAuditDto {
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

  @ApiPropertyOptional({ example: 'contract' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(60)
  entity?: string;

  @ApiPropertyOptional({
    description: 'With `entity`, this is one record’s whole history.',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(64)
  entity_id?: string;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  actor_id?: number;

  @ApiPropertyOptional({ example: 'update' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(40)
  action?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'On or after' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'On or before' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'desc';
}
