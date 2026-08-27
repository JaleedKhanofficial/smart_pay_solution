import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Role, UserStatus } from '../../common/enums';

/** Whitelisted so a query string can never reach an arbitrary column (NFR-13.5). */
export const SORT_FIELDS = [
  'name',
  'email',
  'role',
  'status',
  'last_login_at',
  'created_at',
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const blankToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** FR-USR-01 / §7. */
export class ListUsersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size: number = 25;

  @ApiPropertyOptional({ description: 'Matches name or email' })
  @Transform(blankToUndefined)
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn([Role.admin, Role.operator])
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn([UserStatus.active, UserStatus.disabled])
  status?: UserStatus;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'name' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort: SortField = 'name';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'asc' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  dir: SortDirection = 'asc';
}
