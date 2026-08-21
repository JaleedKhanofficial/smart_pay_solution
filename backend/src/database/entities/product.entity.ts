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
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'integer' })
  category_id: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    enumName: 'ProductStatus',
    default: ProductStatus.Active,
  })
  status: ProductStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: Relation<ProductCategory>;

  @OneToMany(() => Contract, (contract) => contract.product)
  contracts: Relation<Contract>[];
}
