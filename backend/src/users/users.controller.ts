import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../common/enums';
import type { Paginated } from '../common/pagination';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { UserResponse } from './user.mapper';
import { UsersAdminService } from './users-admin.service';

/** Module 9 (SRS §4.9). Admin only, every route. */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.admin)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersAdminService) {}

  @Post()
  @ApiOperation({ summary: 'Create a staff account (FR-USR-01/02-v2)' })
  create(
    @Body() body: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserResponse> {
    return this.users.create(body, user, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'List staff accounts (FR-USR-01)' })
  findAll(@Query() query: ListUsersDto): Promise<Paginated<UserResponse>> {
    return this.users.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponse> {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit, enable/disable, or force a password reset (FR-USR-01..03)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<UserResponse> {
    return this.users.update(id, body, user, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a staff account (FR-USR-01/03)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.users.remove(id, user, req.ip);
  }
}
