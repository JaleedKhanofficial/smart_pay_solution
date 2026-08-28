import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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
import { ProductCondition } from '../../common/enums';
import { trim } from '../../common/normalise';
import { FundingLineDto } from './funding-line.dto';

/** Money arrives as a number and is validated to the column's precision. */
const MONEY = { maxDecimalPlaces: 2 } as const;
const MAX_MONEY = 9_999_999_999;

/**
 * FR-CON-04-v2. The pricing terms alone — everything `POST /contracts/preview`
 * needs and nothing more.
 *
 * Split out from the create payload on purpose: pricing is arithmetic and
 * touches no table, so demanding a customer and a product would force the
 * preview caller to invent two ids that mean nothing to the answer.
 */
export class PreviewContractDto {
  @ApiProperty({
    example: 45000,
    description:
      'What the business paid. Must not exceed the sale price (BR-14).',
  })
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_MONEY)
  cost_price: number;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_MONEY)
  sale_price: number;

  @ApiProperty({
    example: 20,
    description: 'BR-01. Ignored when markup_amount is sent.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999.99)
  markup_pct: number;

  @ApiPropertyOptional({
    example: 9000,
    description:
      'BR-01 override in rupees; the effective percentage is recomputed.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_MONEY)
  markup_amount?: number;

  @ApiProperty({ example: 10000 })
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_MONEY)
  down_payment: number;

  @ApiProperty({
    example: 8,
    description: 'Range is the plan_months setting (FR-SET-01).',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  plan_months: number;

  @ApiProperty({ enum: ProductCondition })
  @IsEnum(ProductCondition)
  product_condition: ProductCondition;

  @ApiProperty({ example: '2027-05-01' })
  @IsISO8601()
  start_date: string;
}

/**
 * FR-CON-03-v2. The raw terms a person types, plus who the deal is with. Every
 * derived figure — markup amount, net, financed, the installment schedule, the
 * end date — is computed by the server from these and persisted from its own
 * arithmetic (FR-CON-04-v2), so a crafted request cannot store inconsistent
 * money.
 */
export class CreateContractDto extends PreviewContractDto {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /**
   * FR-CON-11. Who funded this deal, if anyone. Omitted or empty means the
   * contract is entirely house-funded, which FR-CON-13 allows explicitly.
   *
   * Fixed at activation and immutable thereafter (FR-CON-15), so this is
   * accepted on create only — `UpdateContractDto` inherits it but the service
   * refuses it.
   */
  @ApiPropertyOptional({ type: [FundingLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FundingLineDto)
  fundings?: FundingLineDto[];

  /**
   * FR-CON-04-v2. What the browser calculated, sent so the server can say
   * whether it agreed. Never trusted, never stored — a disagreement over Rs. 1
   * is reported back in `corrections` and the server's figure stands.
   */
  @ApiPropertyOptional({
    description: 'Client preview figures, checked not trusted',
  })
  @IsOptional()
  preview?: Record<string, number | string>;
}
