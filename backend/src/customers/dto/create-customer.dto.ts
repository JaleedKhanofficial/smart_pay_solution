import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsString, Length, Matches, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Accepts `1234512345671` or `12345-1234567-1`, stores `12345-1234567-1`. */
export const normaliseCnic = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;

  const digits = value.replace(/\D/g, '');

  if (digits.length !== 13) return value.trim();

  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

/** Accepts `03001234567`, `0300-1234567` or `+923001234567`; stores `0300-1234567`. */
export const normaliseMobile = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;

  let digits = value.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('92')) {
    digits = `0${digits.slice(2)}`;
  }

  if (digits.length !== 11) return value.trim();

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
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
  @Matches(/^\d{5}-\d{7}-\d$/, {
    message: 'cnicNumber must be 13 digits, e.g. 12345-1234567-1',
  })
  cnicNumber: string;

  @ApiProperty({ example: '0300-1234567' })
  @Transform(normaliseMobile)
  @IsString()
  @Matches(/^03\d{2}-\d{7}$/, {
    message: 'mobileNumber must be a Pakistani mobile, e.g. 0300-1234567',
  })
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
}
