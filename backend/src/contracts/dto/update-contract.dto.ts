import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ContractStatus } from '../../common/enums';
import { trim } from '../../common/normalise';
import { CreateContractDto } from './create-contract.dto';

/**
 * FR-CON-07-v2. Financial terms are editable only while the contract has zero
 * non-voided payments; once money has been taken they are locked and only
 * status, product condition and notes remain. The service enforces that — the
 * DTO cannot know how many payments exist.
 */
export class UpdateContractDto extends PartialType(CreateContractDto) {
  @ApiPropertyOptional({
    enum: ContractStatus,
    description: 'Cancelling is admin-only and needs a reason (FR-CON-08-v2).',
  })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ description: 'Required when cancelling.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancel_reason?: string;

  /**
   * FR-CON-08-v2. Cancelling a contract that still has a balance is refused
   * unless the admin says outright that the remainder is written off.
   */
  @ApiPropertyOptional({
    description: 'Accept the outstanding balance as a write-off.',
  })
  @IsOptional()
  @IsBoolean()
  write_off?: boolean;
}
