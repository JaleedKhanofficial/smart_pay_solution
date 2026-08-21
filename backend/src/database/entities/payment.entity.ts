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
@Index('payments_contract_id_idx', ['contract_id'])
@Index('payments_payment_date_idx', ['payment_date'])
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  contract_id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'date' })
  payment_date: string;

  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'PaymentMethod' })
  method: PaymentMethod;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'integer' })
  recorded_by: number;

  @Column({ type: 'text', nullable: true })
  void_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

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
