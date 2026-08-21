import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { PaymentMethod } from '../../common/enums';
import { Contract } from './contract.entity';
import { User } from './user.entity';

/**
 * SRS §5.9 — the money, and the single source of truth for it. A voided payment
 * is soft-deleted with a reason rather than erased. Module 6.
 */
@Entity('payments')
@Index('payments_contract_id_idx', ['contractId'])
@Index('payments_payment_date_idx', ['paymentDate'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: string;

  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'PaymentMethod' })
  method: PaymentMethod;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedById: string;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Contract, (contract) => contract.payments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Relation<Contract>;

  @ManyToOne(() => User, (user) => user.recordedPayments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'recorded_by' })
  recordedBy: Relation<User>;
}
