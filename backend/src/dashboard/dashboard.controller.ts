import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService, type DashboardResponse } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

/** Module 1 (SRS §4.1). One call, not v1's nine (NFR-07). */
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Portfolio KPIs in one aggregate (FR-DSH-01..13)' })
  summary(@Query() query: DashboardQueryDto): Promise<DashboardResponse> {
    return this.dashboard.summary(query.investor_id);
  }
}
