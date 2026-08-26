import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ProductStatus } from '../common/enums';
import type { LookupOption } from '../common/lookup';
import { paginate, type Paginated } from '../common/pagination';
import { Contract, Product, ProductCategory } from '../database/entities';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  toAuditSnapshot,
  toProductResponse,
  type ProductResponse,
} from './product.mapper';
import {
  applyProductFilters,
  applyProductSort,
  CATEGORY_ALIAS,
  PRODUCT_ALIAS,
} from './product.query';

/**
 * Module 3 (SRS §4.3). Mirrors CustomersService: rules and transaction
 * boundaries here, filtering in product.query.ts, the response shape in
 * product.mapper.ts.
 *
 * Soft-deleted products are invisible to every query below without a filter,
 * because `deleted_at` is a @DeleteDateColumn on the entity (§2.8.5).
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categories: Repository<ProductCategory>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    private readonly audit: AuditService,
  ) {}

  /** FR-PRD-02 */
  async create(
    body: CreateProductDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<ProductResponse> {
    await this.assertCategoryExists(body.category_id);
    await this.assertNameIsFree(body.name);

    const saved = await this.products.save(
      this.products.create({
        name: body.name,
        category_id: body.category_id,
        status: body.status,
      }),
    );

    const created = await this.findOne(saved.id);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'product',
      entity_id: String(saved.id),
      action: 'create',
      after: toAuditSnapshot(created),
      ip,
    });

    return created;
  }

  /** FR-PRD-01: name ascending by default, paginated, searchable, filterable. */
  async findAll(query: ListProductsDto): Promise<Paginated<ProductResponse>> {
    const qb = this.products
      .createQueryBuilder(PRODUCT_ALIAS)
      .innerJoinAndSelect(`${PRODUCT_ALIAS}.category`, CATEGORY_ALIAS);

    applyProductFilters(qb, query);
    applyProductSort(qb, query);

    const [rows, total] = await qb
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();

    return paginate(
      rows.map(toProductResponse),
      total,
      query.page,
      query.page_size,
    );
  }

  /**
   * FR-PRD-05. Active products only, name ascending — an Inactive product is
   * kept for history but must not be offerable on a new contract.
   */
  async lookup(): Promise<LookupOption[]> {
    const rows = await this.products.find({
      select: { id: true, name: true },
      where: { status: ProductStatus.Active },
      order: { name: 'ASC' },
    });

    return rows.map((row) => ({ id: row.id, label: row.name }));
  }

  async findOne(id: number): Promise<ProductResponse> {
    return toProductResponse(await this.loadOrFail(id));
  }

  /** FR-PRD-03 */
  async update(
    id: number,
    body: UpdateProductDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<ProductResponse> {
    const before = await this.loadOrFail(id);

    if (body.category_id !== undefined) {
      await this.assertCategoryExists(body.category_id);
    }

    if (body.name !== undefined && body.name !== before.name) {
      await this.assertNameIsFree(body.name, id);
    }

    await this.products.update(
      { id },
      {
        name: body.name,
        category_id: body.category_id,
        status: body.status,
      },
    );

    const after = await this.findOne(id);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'product',
      entity_id: String(id),
      action: 'update',
      before: toAuditSnapshot(toProductResponse(before)),
      after: toAuditSnapshot(after),
      ip,
    });

    return after;
  }

  /**
   * FR-PRD-04: soft delete, blocked with 409 and the blocking contract list
   * while any non-deleted contract still references the product.
   */
  async remove(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const before = await this.loadOrFail(id);

    const blocking = await this.contracts.find({
      where: { product_id: id },
      select: { id: true, status: true, start_date: true },
    });

    if (blocking.length) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message:
          'This product is used by existing contracts. Deactivate it instead, or remove those contracts first.',
        blocking_contracts: blocking,
      });
    }

    await this.products.softDelete({ id });

    await this.audit.record({
      actor_id: actor.id,
      entity: 'product',
      entity_id: String(id),
      action: 'soft_delete',
      before: toAuditSnapshot(toProductResponse(before)),
      ip,
    });
  }

  private async loadOrFail(id: number): Promise<Product> {
    const product = await this.products.findOne({
      where: { id },
      relations: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" was not found`);
    }

    return product;
  }

  private async assertCategoryExists(category_id: number): Promise<void> {
    if (await this.categories.existsBy({ id: category_id })) return;

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: `Category "${category_id}" does not exist`,
      field_errors: { category_id: 'Choose a category from the list' },
    });
  }

  /**
   * Two products with the same name are indistinguishable on a contract picker,
   * so the name is unique among live rows. There is no database index behind
   * this — a soft-deleted product should not block reuse of its name, and the
   * catalogue is small enough that the check is cheap.
   */
  private async assertNameIsFree(
    name: string,
    exceptId?: number,
  ): Promise<void> {
    const clash = await this.products
      .createQueryBuilder(PRODUCT_ALIAS)
      .where(`LOWER(${PRODUCT_ALIAS}.name) = LOWER(:name)`, { name })
      .andWhere(exceptId ? `${PRODUCT_ALIAS}.id <> :exceptId` : '1=1', {
        exceptId,
      })
      .getExists();

    if (clash) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `A product named "${name}" already exists`,
        field_errors: { name: 'This product name is already in the catalogue' },
      });
    }
  }
}
