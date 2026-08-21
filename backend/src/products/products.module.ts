import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract, Product, ProductCategory } from '../database/entities';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductCategoriesService } from './product-categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/** Module 3 (SRS §4.3): the catalogue and the category lookup behind it. */
@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductCategory, Contract])],
  controllers: [ProductsController, ProductCategoriesController],
  providers: [ProductsService, ProductCategoriesService],
})
export class ProductsModule {}
