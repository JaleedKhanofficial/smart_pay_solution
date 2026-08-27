import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../common/enums';
import { PatchSettingsDto } from './dto/patch-settings.dto';
import { SettingsService, type SettingResponse } from './settings.service';

/** Module 12 (SRS §4.12). Admin only — these are the business rules. */
@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.admin)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Every setting, defaults filled in (FR-SET-01)' })
  findAll(): Promise<SettingResponse[]> {
    return this.settings.findAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Change settings; audit-logged (FR-SET-02)' })
  patch(
    @Body() body: PatchSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SettingResponse[]> {
    return this.settings.patch(body.settings, user, req.ip);
  }
}
