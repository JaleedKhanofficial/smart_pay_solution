import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CreateUserDto, MIN_PASSWORD_LENGTH } from './create-user.dto';

/**
 * FR-USR-01 / FR-USR-02-v2. Everything is optional; a password is set only
 * when the admin is forcing a reset, and omitting it leaves the existing hash
 * untouched rather than clearing it.
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({
    minLength: MIN_PASSWORD_LENGTH,
    description:
      'Send only to force a reset; omit to leave the password alone.',
  })
  @IsOptional()
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  })
  @MaxLength(200)
  password?: string;
}
