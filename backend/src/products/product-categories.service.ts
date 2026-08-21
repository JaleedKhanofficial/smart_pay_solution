import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Product, ProductCategory } from '../database/entities';
import { CategoryDto } from './dto/category.dto';
import {
  toAuditSnapshot,
  toCategoryResponse,
  type CategoryResponse,
} from './product.mapper';

/**
 * FR-PRD-07: the category lookup behind the catalogue.
 *
 * A category can be added, renamed, and deleted **only while nothing is filed
 * under it**. Once a product exists in a category the name is part of the
 * Summary Report's "Deal" dimension (FR-PRD-06), and deleting it would rewrite
 * reporting history — so that case is refused rather than cascaded.
 */
@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categories: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly audit: AuditService,
  ) {}

  /** Name ascending, each with the number of live products filed under it. */
  async findAll(): Promise<CategoryResponse[]> {
    const categories = await this.categories.find({
      order: { name: 'ASC' },
    });

    const counts = await this.countsByCategory();

    return categories.map((category) =>
      toCategoryResponse(category, counts.get(category.id) ?? 0),
    );
  }

  async create(
    body: CategoryDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<CategoryResponse> {
    await this.assertNameIsFree(body.name);

    const saved = await this.categories.save(
      this.categories.create({ name: body.name }),
    );

    const created = toCategoryResponse(saved, 0);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'product_category',
      entity_id: String(saved.id),
      action: 'create',
      after: toAuditSnapshot(created),
      ip,
    });

    return created;
  }

  async rename(
    id: number,
    body: CategoryDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<CategoryResponse> {
    const category = await this.categories.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category with id "${id}" was not found`);
    }

    if (body.name !== category.name) {
      await this.assertNameIsFree(body.name, id);
    }

    const count = await this.products.countBy({ category_id: id });
    const before = toCategoryResponse(category, count);

    await this.categories.update({ id }, { name: body.name });

    const renamed = await this.categories.findOneOrFail({ where: { id } });
    const after = toCategoryResponse(renamed, count);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'product_category',
      entity_id: String(id),
      action: 'rename',
      before: toAuditSnapshot(before),
      after: toAuditSnapshot(after),
      ip,
    });

    return after;
  }

  /** One grouped query rather than a count per row. */
  /**
   * Deletable only while empty. "Empty" counts soft-deleted products too: a
   * recycled product still holds the foreign key, so the database would refuse
   * the delete anyway (ON DELETE RESTRICT) and the user would see a driver
   * error instead of an explanation.
   */
  async remove(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const category = await this.categories.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category with id "${id}" was not found`);
    }

    const live = await this.products.countBy({ category_id: id });
    const total = await this.products.count({
      where: { category_id: id },
      withDeleted: true,
    });

    if (total > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message:
          live > 0
            ? `"${category.name}" still has ${live} product${live === 1 ? '' : 's'} filed under it. Move or delete them first.`
            : `"${category.name}" has no live products, but ${total} deleted one${total === 1 ? ' still references' : 's still reference'} it. Purge it from the Recycle Bin first.`,
        product_count: live,
        deleted_product_count: total - live,
      });
    }

    await this.categories.delete({ id });

    await this.audit.record({
      actor_id: actor.id,
      entity: 'product_category',
      entity_id: String(id),
      action: 'delete',
      before: toAuditSnapshot(toCategoryResponse(category, 0)),
      ip,
    });
  }

  private async countsByCategory(): Promise<Map<number, number>> {
    const rows = await this.products
      .createQueryBuilder('product')
      .select('product.category_id', 'category_id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('product.category_id')
      .getRawMany<{ category_id: number; count: string }>();

    return new Map(
      rows.map((row) => [Number(row.category_id), Number(row.count)]),
    );
  }

  private async assertNameIsFree(
    name: string,
    exceptId?: number,
  ): Promise<void> {
    const clash = await this.categories
      .createQueryBuilder('category')
      .where('LOWER(category.name) = LOWER(:name)', { name })
      .andWhere(exceptId ? 'category.id <> :exceptId' : '1=1', { exceptId })
      .getExists();

    if (clash) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `A category named "${name}" already exists`,
        field_errors: { name: 'This category already exists' },
      });
    }
  }
}
