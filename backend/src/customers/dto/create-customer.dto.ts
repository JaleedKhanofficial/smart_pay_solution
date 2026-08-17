import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Accepts a CNIC with or without dashes (1234512345671 or 12345-1234567-1)
 * and normalises it to the dashed form before validation runs.
 */
const normaliseCnic = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;

  const digits = value.replace(/\D/g, '');

  if (digits.length !== 13) return value.trim();

  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

export class CreateCustomerDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'name must be between 2 and 120 characters' })
  name: string;

  @Transform(trim)
  @IsString()
  @Length(5, 500, { message: 'address must be between 5 and 500 characters' })
  address: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\+?[\d][\d\s-]{6,18}$/, {
    message:
      'phoneNumber must be 7-20 characters and may only contain digits, spaces, dashes and a leading +',
  })
  phoneNumber: string;

  @Transform(normaliseCnic)
  @IsString()
  @Matches(/^\d{5}-\d{7}-\d$/, {
    message: 'cnic must be 13 digits, e.g. 12345-1234567-1',
  })
  cnic: string;
}
