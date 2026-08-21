import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { ProductStatus } from '../../common/enums';
import { Contract } from './contract.entity';
import { ProductCategory } from './product-category.entity';

/** SRS §5.6. Module 3. */
@Entity('products')
@Index('products_name_idx', ['name'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    enumName: 'ProductStatus',
    default: ProductStatus.Active,
  })
  status: ProductStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: Relation<ProductCategory>;

  @OneToMany(() => Contract, (contract) => contract.product)
  contracts: Relation<Contract>[];
}
