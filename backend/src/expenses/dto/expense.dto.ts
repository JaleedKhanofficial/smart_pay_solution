import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExpenseKind } from '../../common/enums';
import { trim } from '../../common/normalise';

const MONEY = { maxDecimalPlaces: 2 } as const;

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** SRS §4.15. A period whose common costs share one set of investors. */
export class PeriodDto {
  @ApiProperty({ example: 'Common-1' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  label: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601({ strict: true })
  starts_on: string;

  @ApiPropertyOptional({ example: '2026-08-10' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601({ strict: true })
  ends_on?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** A closed period takes no further expenses. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  closed?: boolean;
}

/** BR-28/BR-29. One investor's place in a period's split. */
export class MemberDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id: number;

  @ApiPropertyOptional({ description: 'Left out of the split (BR-29).' })
  @IsOptional()
  @IsBoolean()
  waived?: boolean;

  @ApiPropertyOptional({ description: 'Required when waived.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  waive_reason?: string;
}

/** The whole membership of a period, replaced in one call. */
export class MembersDto {
  @ApiProperty({ type: [MemberDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members: MemberDto[];
}

/** SRS §4.15. One thing the business paid for. */
export class ExpenseDto {
  @ApiProperty({ enum: ExpenseKind })
  @IsEnum(ExpenseKind)
  kind: ExpenseKind;

  /** Required on a common expense, refused on an individual one. */
  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  period_id?: number;

  /** Required on an individual expense, refused on a common one. */
  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id?: number;

  @ApiProperty({ example: '2026-08-12' })
  @IsISO8601({ strict: true })
  spent_on: string;

  @ApiProperty({ example: 'Mouse' })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 700 })
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(9_999_999_999)
  amount: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export const EXPENSE_SORT = ['spent_on', 'amount', 'description'] as const;
export type ExpenseSort = (typeof EXPENSE_SORT)[number];

/** SRS §4.15. The register's filters. */
export class ListExpensesDto {
  @ApiPropertyOptional({ enum: ExpenseKind })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsEnum(ExpenseKind)
  kind?: ExpenseKind;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  period_id?: number;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id?: number;

  /** Spent on or after this date, inclusive. */
  @ApiPropertyOptional({ example: '2026-08-01' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /** Spent on or before this date, inclusive. */
  @ApiPropertyOptional({ example: '2026-08-31' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  search?: string;
}
