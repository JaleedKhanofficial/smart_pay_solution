import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
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
 * One sentence for both the missing case and the empty case, so the form has a
 * single message to show whichever way the field arrives wrong.
 */
const NEEDS_AN_INVESTOR =
  'A contract needs at least one investor. The business does not fund deals from its own capital.';

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
   * FR-CON-11. Who funded this deal — **required**, and at least one line.
   *
   * This business does not put its own capital into a deal: every contract is
   * backed by an investor, so a create with nothing here is rejected rather
   * than quietly stored as house-funded. That is a deliberate departure from
   * FR-CON-13, which allows a wholly house-funded activation; the rule lives
   * here as well as in the form because a rule that only exists in a browser
   * is not a rule.
   *
   * The remainder above the funded amount is still the house's own money
   * (BR-14) — what is refused is a contract with *no* investor at all.
   *
   * Fixed at activation and immutable thereafter (FR-CON-15), so this is
   * accepted on create only. `UpdateContractDto` makes every field optional
   * again through `PartialType`, and the service refuses it on a PATCH.
   */
  // `ArrayMinSize` alone: it already fails a missing or non-array value, and
  // pairing it with `IsArray` reported the same sentence twice.
  @ApiProperty({ type: [FundingLineDto] })
  @ArrayMinSize(1, { message: NEEDS_AN_INVESTOR })
  @ValidateNested({ each: true })
  @Type(() => FundingLineDto)
  fundings: FundingLineDto[];

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
