import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'current_password is required' })
  current_password: string;

  // FR-USR-02-v2: minimum 10 characters
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'new_password must be at least 10 characters' })
  @MaxLength(200)
  new_password: string;
}
