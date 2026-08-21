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
@Index('contracts_customer_id_idx', ['customerId'])
@Index('contracts_product_id_idx', ['productId'])
@Index('contracts_status_idx', ['status'])
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'integer' })
  customerId: number;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'sale_price', type: 'decimal', precision: 12, scale: 2 })
  salePrice: string;

  @Column({ name: 'markup_pct', type: 'decimal', precision: 5, scale: 2 })
  markupPct: string;

  @Column({ name: 'markup_amount', type: 'decimal', precision: 12, scale: 2 })
  markupAmount: string;

  @Column({ name: 'net_amount', type: 'decimal', precision: 12, scale: 2 })
  netAmount: string;

  @Column({ name: 'down_payment', type: 'decimal', precision: 12, scale: 2 })
  downPayment: string;

  @Column({ name: 'financed_amount', type: 'decimal', precision: 12, scale: 2 })
  financedAmount: string;

  @Column({
    name: 'monthly_installment',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  monthlyInstallment: string;

  @Column({ name: 'plan_months', type: 'integer' })
  planMonths: number;

  @Column({
    name: 'product_condition',
    type: 'enum',
    enum: ProductCondition,
    enumName: 'ProductCondition',
  })
  productCondition: ProductCondition;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    enumName: 'ContractStatus',
    default: ContractStatus.active,
  })
  status: ContractStatus;

  @Column({ name: 'write_off', type: 'boolean', default: false })
  writeOff: boolean;

  @Column({ name: 'terms_locked_at', type: 'timestamptz', nullable: true })
  termsLockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

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
