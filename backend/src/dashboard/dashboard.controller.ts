import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService, type DashboardResponse } from './dashboard.service';

/** Module 1 (SRS §4.1). One call, not v1's nine (NFR-07). */
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Portfolio KPIs in one aggregate (FR-DSH-01..12)' })
  summary(): Promise<DashboardResponse> {
    return this.dashboard.summary();
  }
}
