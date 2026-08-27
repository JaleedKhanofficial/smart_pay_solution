import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../common/enums';
import type { Paginated } from '../common/pagination';
import type { AuditEntryResponse } from './audit.mapper';
import { AuditService } from './audit.service';
import { ListAuditDto } from './dto/list-audit.dto';

/**
 * Module 11 (SRS §4.11). Admin only, and **read only**.
 *
 * FR-AUD-03 is enforced by what is absent: there is no POST, PATCH or DELETE
 * here and there never will be. An audit trail that the application can edit
 * is not an audit trail, so the guarantee is the shape of this file rather
 * than a check inside it.
 */
@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.admin)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'The audit trail, newest first (FR-AUD-02)' })
  findAll(
    @Query() query: ListAuditDto,
  ): Promise<Paginated<AuditEntryResponse>> {
    return this.audit.findAll(query);
  }

  @Get('facets')
  @ApiOperation({ summary: 'Entities, actions and actors present in the log' })
  facets(): Promise<{
    entities: string[];
    actions: string[];
    actors: { id: number; name: string }[];
  }> {
    return this.audit.facets();
  }
}
