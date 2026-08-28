import { PartialType } from '@nestjs/swagger';
import { CreateInvestorDto } from './create-investor.dto';

/**
 * FR-IVT-03. Everything is optional. Changing `profit_share_pct` affects
 * **future deployments only** — a funded contract keeps the rate stored on its
 * own funding row (BR-16), and the service does not touch those.
 */
export class UpdateInvestorDto extends PartialType(CreateInvestorDto) {}
