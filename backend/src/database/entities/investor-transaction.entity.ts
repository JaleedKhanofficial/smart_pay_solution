import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import {
  InvestorBucket,
  InvestorTxnType,
  PaymentMethod,
} from '../../common/enums';
import { Contract } from './contract.entity';
import { Investor } from './investor.entity';
import { User } from './user.entity';

/**
 * SRS §5.17. Every hand-entered movement of an investor's money.
 *
 * **Append-only** (FR-IVT-07/08): no `deleted_at`, no `updated_at`, and no
 * update path through the application. A mis-entered Deposit is corrected by a
 * reversing Adjustment with a reason, never by editing the original — the same
 * discipline as the audit log.
 *
 * Deployment, capital recovery and profit are *not* here. They derive from
 * `contract_fundings` and the payments table (BR-18, BR-21), which is what
 * makes an investor statement unable to disagree with the money.
 */
@Entity('investor_transactions')
@Index('investor_transactions_investor_id_idx', ['investor_id'])
@Index('investor_transactions_txn_date_idx', ['txn_date'])
export class InvestorTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  investor_id: number;

  @Column({ type: 'enum', enum: InvestorTxnType, enumName: 'InvestorTxnType' })
  type: InvestorTxnType;

  /** A movement spanning both buckets is written as two rows (§5.17). */
  @Column({ type: 'enum', enum: InvestorBucket, enumName: 'InvestorBucket' })
  bucket: InvestorBucket;

  /** Negative only on an Adjustment, which is how a reversal is written. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'date' })
  txn_date: string;

  /** Null on Adjustment and Loss: neither is a cash movement. */
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    nullable: true,
  })
  method: PaymentMethod | null;

  @Column({ type: 'text', nullable: true })
  reference: string | null;

  /** Set on a Loss, naming the contract that did not recover (BR-20). */
  @Column({ type: 'integer', nullable: true })
  contract_id: number | null;

  /** Required on Adjustment and Loss; the database enforces it. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'integer' })
  entered_by: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Investor, (investor) => investor.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'investor_id' })
  investor: Relation<Investor>;

  @ManyToOne(() => Contract, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contract_id' })
  contract: Relation<Contract> | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'entered_by' })
  enteredBy: Relation<User>;
}
