import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim } from '../../common/normalise';

const MONEY = { maxDecimalPlaces: 2 } as const;

/**
 * FR-SUM-02-v2. A capital or expense entry.
 *
 * One DTO for both because they carry the same fields — the difference is
 * which table they land in, and that is the route, not the payload. v1 kept
 * these in localStorage, which is the bug this module exists to fix (§9.6).
 */
export class EntryDto {
  @ApiProperty({ example: 500000 })
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(9_999_999_999)
  amount: number;

  @ApiProperty({ example: '2026-08', description: 'The period it belongs to.' })
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  period_label: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
