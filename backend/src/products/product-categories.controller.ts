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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CategoryDto } from './dto/category.dto';
import type { CategoryResponse } from './product.mapper';
import { ProductCategoriesService } from './product-categories.service';

/** FR-PRD-07. Delete is allowed only while the category is empty. */
@ApiTags('products')
@ApiBearerAuth()
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly categories: ProductCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories with their product counts' })
  findAll(): Promise<CategoryResponse[]> {
    return this.categories.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Add a category (FR-PRD-07)' })
  create(
    @Body() body: CategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CategoryResponse> {
    return this.categories.create(body, user, req.ip);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a category (FR-PRD-07)' })
  rename(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CategoryResponse> {
    return this.categories.rename(id, body, user, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an unused category; 409 while any product references it',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.categories.remove(id, user, req.ip);
  }
}
