import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { BIN_KINDS, type BinKind } from '../recycle-bin.registry';

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-BIN-01. Filterable by entity and by when it was deleted. */
export class ListBinDto {
  @ApiPropertyOptional({ enum: BIN_KINDS, description: 'Omit for everything.' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(BIN_KINDS)
  kind?: BinKind;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Deleted on or after',
  })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ default: 100, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 100;
}
