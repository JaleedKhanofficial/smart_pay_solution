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
import { ContractStatus, ProductCondition } from '../../common/enums';
import { Customer } from './customer.entity';
import { Installment } from './installment.entity';
import { LedgerSnapshot } from './ledger-snapshot.entity';
import { Payment } from './payment.entity';
import { Product } from './product.entity';

/**
 * SRS §5.7. Module 4. There is deliberately no running-balance column:
 * outstanding is always derived from payments, which are the single source of
 * truth for money.
 */
@Entity('contracts')
@Index('contracts_customer_id_idx', ['customer_id'])
@Index('contracts_product_id_idx', ['product_id'])
@Index('contracts_status_idx', ['status'])
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  customer_id: number;

  @Column({ type: 'integer' })
  product_id: number;

  /**
   * BR-14. What the business paid, and the basis for capital deployed —
   * distinct from the sale price. `sale_price - cost_price` is retail
   * margin: house profit, never part of the investor split.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  cost_price: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  sale_price: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  markup_pct: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  markup_amount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  net_amount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  down_payment: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  financed_amount: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  monthly_installment: string;

  @Column({ type: 'integer' })
  plan_months: number;

  @Column({
    type: 'enum',
    enum: ProductCondition,
    enumName: 'ProductCondition',
  })
  product_condition: ProductCondition;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    enumName: 'ContractStatus',
    default: ContractStatus.active,
  })
  status: ContractStatus;

  @Column({ type: 'boolean', default: false })
  write_off: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  terms_locked_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => Customer, (customer) => customer.contracts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Relation<Customer>;

  @ManyToOne(() => Product, (product) => product.contracts, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @OneToMany(() => Installment, (installment) => installment.contract)
  installments: Relation<Installment>[];

  @OneToMany(() => Payment, (payment) => payment.contract)
  payments: Relation<Payment>[];

  @OneToMany(() => LedgerSnapshot, (snapshot) => snapshot.contract)
  snapshots: Relation<LedgerSnapshot>[];
}
