import { PartialType } from '@nestjs/swagger';
import { CreateInvestorDto } from './create-investor.dto';

/**
 * FR-IVT-03. Everything is optional. Changing `loss_participation` affects
 * future write-offs only — funded contracts keep the rate stored on their
 * own funding row.
 */
export class UpdateInvestorDto extends PartialType(CreateInvestorDto) {}
