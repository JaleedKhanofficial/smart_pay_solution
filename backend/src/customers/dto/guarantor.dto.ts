import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Length, Matches } from 'class-validator';
import {
  CNIC_MESSAGE,
  CNIC_PATTERN,
  MOBILE_MESSAGE,
  MOBILE_PATTERN,
  normaliseCnic,
  normaliseMobile,
  trim,
} from '../../common/normalise';

/** SRS §5.4 / FR-CUS-03-v2. Exactly two per customer, positions 1 and 2. */
export class GuarantorDto {
  @ApiProperty({ enum: [1, 2] })
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2], { message: 'position must be 1 or 2' })
  position: number;

  @ApiProperty({ example: 'Bilal Ahmed' })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  full_name: string;

  /** v1 collected this and never wrote it; v2 persists it. */
  @ApiProperty({ example: 'Ahmed Khan' })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  father_name: string;

  @ApiProperty({ example: 'Brother' })
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  relationship: string;

  @ApiProperty({ example: '12345-1234567-1' })
  @Transform(normaliseCnic)
  @IsString()
  @Matches(CNIC_PATTERN, { message: `cnic_number ${CNIC_MESSAGE}` })
  cnic_number: string;

  @ApiProperty({ example: '0300-1234567' })
  @Transform(normaliseMobile)
  @IsString()
  @Matches(MOBILE_PATTERN, { message: `mobile_number ${MOBILE_MESSAGE}` })
  mobile_number: string;

  @ApiProperty({ example: 'Shop 7, Anarkali, Lahore' })
  @Transform(trim)
  @IsString()
  @Length(5, 500)
  address: string;
}
