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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { LookupOption } from '../common/lookup';
import type { Paginated } from '../common/pagination';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { ProductResponse } from './product.mapper';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a product to the catalogue (FR-PRD-02)' })
  create(
    @Body() body: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ProductResponse> {
    return this.products.create(body, user, req.ip);
  }

  @Get()
  @ApiOperation({ summary: 'List products, name ascending (FR-PRD-01)' })
  findAll(
    @Query() query: ListProductsDto,
  ): Promise<Paginated<ProductResponse>> {
    return this.products.findAll(query);
  }

  /**
   * FR-PRD-05. Only Active products, as `{ id, label }` for the contract
   * picker — an Inactive product must not be offerable on a new contract, and
   * the paged list would stop at 100 rows.
   *
   * Declared before ':id' so the literal path is matched first.
   */
  @Get('lookup')
  @ApiOperation({ summary: 'Active products as picker options' })
  lookup(): Promise<LookupOption[]> {
    return this.products.lookup();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductResponse> {
    return this.products.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a product (FR-PRD-03)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ProductResponse> {
    return this.products.update(id, body, user, req.ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a product (FR-PRD-04)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.products.remove(id, user, req.ip);
  }
}
