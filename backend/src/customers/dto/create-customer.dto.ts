import { ApiProperty } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CNIC_MESSAGE,
  CNIC_PATTERN,
  MOBILE_MESSAGE,
  MOBILE_PATTERN,
  normaliseCnic,
  normaliseMobile,
  trim,
} from '../../common/normalise';
import { GuarantorDto } from './guarantor.dto';

/**
 * Customers are submitted as multipart/form-data so the three CNIC images ride
 * along with the record (FR-CUS-06 atomicity), which means guarantors arrive as
 * a JSON string in one field.
 */
const parseGuarantors = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? plainToInstance(GuarantorDto, parsed)
      : value;
  } catch {
    // Left as a string so @IsArray reports it rather than throwing a 500.
    return value;
  }
};

export class CreateCustomerDto {
  @ApiProperty({ example: 'Ali Raza', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty({ example: 'Muhammad Raza', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(2, 150)
  fatherHusbandName: string;

  @ApiProperty({ example: '12345-1234567-1' })
  @Transform(normaliseCnic)
  @IsString()
  @Matches(CNIC_PATTERN, { message: `cnicNumber ${CNIC_MESSAGE}` })
  cnicNumber: string;

  @ApiProperty({ example: '0300-1234567' })
  @Transform(normaliseMobile)
  @IsString()
  @Matches(MOBILE_PATTERN, { message: `mobileNumber ${MOBILE_MESSAGE}` })
  mobileNumber: string;

  @ApiProperty({ example: 'House 12, Street 5, Lahore' })
  @Transform(trim)
  @IsString()
  @Length(5, 500)
  address: string;

  @ApiProperty({ example: 'Shopkeeper', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  occupation: string;

  @ApiProperty({ example: 85000, description: 'PKR per month' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  monthlyIncome: number;

  @ApiProperty({
    type: [GuarantorDto],
    description:
      'Exactly two, positions 1 and 2. Sent as a JSON string in multipart requests.',
  })
  @Transform(parseGuarantors)
  @IsArray()
  @ArrayMinSize(2, { message: 'exactly two guarantors are required' })
  @ArrayMaxSize(2, { message: 'exactly two guarantors are required' })
  @ValidateNested({ each: true })
  @Type(() => GuarantorDto)
  guarantors: GuarantorDto[];
}
