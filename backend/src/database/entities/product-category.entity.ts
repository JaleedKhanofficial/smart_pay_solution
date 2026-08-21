import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Product } from './product.entity';

/** SRS §5.6 / FR-PRD-07. Module 3. */
@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('product_categories_name_key', { unique: true })
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => Product, (product) => product.category)
  products: Relation<Product>[];
}
