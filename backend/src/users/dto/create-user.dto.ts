import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role, UserStatus } from '../../common/enums';
import { trim } from '../../common/normalise';

/** NFR-04 / FR-USR-02-v2. Ten characters is the floor, and it is enforced here
 *  as well as on the change-password route so both paths agree. */
export const MIN_PASSWORD_LENGTH = 10;

const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserDto {
  @ApiProperty({ example: 'Asif Raza' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'asif@smartpay.local' })
  @Transform(lower)
  @IsEmail({}, { message: 'email must be a valid address' })
  @MaxLength(160)
  email: string;

  @ApiProperty({
    minLength: MIN_PASSWORD_LENGTH,
    description: 'Stored only as an Argon2id hash (FR-USR-02-v2).',
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  })
  @MaxLength(200)
  password: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.active })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
