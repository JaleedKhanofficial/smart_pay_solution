import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

class RestoreContractFundingDto {
  @ApiPropertyOptional({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  investor_id: number;
}

/** FR-BIN-02. Only contracts with funding need a body. */
export class RestoreBinDto {
  @ApiPropertyOptional({
    description:
      'One investor per funding line, in the same order as the restore preview.',
    type: [RestoreContractFundingDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RestoreContractFundingDto)
  fundings?: RestoreContractFundingDto[];
}
