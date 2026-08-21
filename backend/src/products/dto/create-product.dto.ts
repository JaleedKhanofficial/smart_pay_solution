import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ProductStatus } from '../../common/enums';
import { trim } from '../../common/normalise';

/** FR-PRD-01..04. Name, category and status are the whole record (SRS §5.6). */
export class CreateProductDto {
  @ApiProperty({ example: 'Samsung Galaxy A55', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 1, description: 'product_categories.id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id: number;

  @ApiProperty({
    enum: ProductStatus,
    default: ProductStatus.Active,
    description: 'Only Active products can be put on a contract (FR-PRD-05)',
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status: ProductStatus = ProductStatus.Active;
}
