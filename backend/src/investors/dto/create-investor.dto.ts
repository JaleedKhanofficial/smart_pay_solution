import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InvestorStatus } from '../../common/enums';
import {
  CNIC_MESSAGE,
  CNIC_PATTERN,
  MOBILE_MESSAGE,
  MOBILE_PATTERN,
  normaliseCnic,
  normaliseMobile,
  trim,
} from '../../common/normalise';

/** FR-IVT-02. The same identity fields as a customer, plus the money terms. */
export class CreateInvestorDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  full_name: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  father_husband_name: string;

  @ApiProperty({ example: '12345-1234567-1' })
  @Transform(normaliseCnic)
  @Matches(CNIC_PATTERN, { message: `cnic_number ${CNIC_MESSAGE}` })
  cnic_number: string;

  @ApiProperty({ example: '0300-1234567' })
  @Transform(normaliseMobile)
  @Matches(MOBILE_PATTERN, { message: `mobile_number ${MOBILE_MESSAGE}` })
  mobile_number: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  address: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'BR-20. Whether losses are charged to this investor.',
  })
  @IsOptional()
  @IsBoolean()
  loss_participation?: boolean;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsISO8601()
  agreement_date?: string;

  @ApiPropertyOptional({ enum: InvestorStatus })
  @IsOptional()
  @IsEnum(InvestorStatus)
  status?: InvestorStatus;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
