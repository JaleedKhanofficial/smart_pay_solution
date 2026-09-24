import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** FR-DSH-13. Narrow every figure to one investor's contracts. */
export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Show one investor’s position only.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id?: number;
}
