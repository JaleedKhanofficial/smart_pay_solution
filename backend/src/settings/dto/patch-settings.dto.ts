import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * FR-SET-02. A free-form bag on purpose: the keys and their shapes live in the
 * settings registry, which validates each one and reports per-key errors. A
 * class-validator DTO per key would be a second declaration of the same rules,
 * and the two would drift.
 */
export class PatchSettingsDto {
  @ApiPropertyOptional({
    description: 'Only the keys being changed, each validated by the registry.',
    example: { allow_overpayment: true, plan_months_max: 24 },
  })
  @IsObject()
  settings: Record<string, unknown>;
}
