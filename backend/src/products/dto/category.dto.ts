import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { trim } from '../../common/normalise';

/**
 * FR-PRD-07: categories are a lookup that can be added to and renamed, and
 * nothing else. There is deliberately no delete — a category is the Summary
 * Report's "Deal" dimension (FR-PRD-06), so removing one would rewrite history.
 * Retire a category by renaming it or by leaving it unused.
 */
export class CategoryDto {
  @ApiProperty({ example: 'Mobile Phones', maxLength: 80 })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name: string;
}
