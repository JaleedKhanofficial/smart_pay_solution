import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * The refresh token normally arrives in the httpOnly cookie (FR-AUT-01). The
 * body field exists for the Next.js server, which is the only client that talks
 * to this API and keeps the token in its own httpOnly cookie.
 */
export class RefreshDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
