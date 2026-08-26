import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { InvestorStatus } from '../../common/enums';
import { ContractFunding } from './contract-funding.entity';
import { InvestorTransaction } from './investor-transaction.entity';

/**
 * SRS §5.16. A party who deposits capital for deployment into contracts against
 * a contracted share of profit.
 *
 * No balance is stored here. Everything an investor is owed — principal, profit,
 * deployed, idle — derives from `investor_transactions` and `contract_fundings`
 * against the payments table (BR-21), for the same reason the contract balance
 * is derived: a stored figure is a figure that can disagree with the money.
 */
@Entity('investors')
@Index('investors_full_name_idx', ['full_name'])
export class Investor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  full_name: string;

  @Column({ type: 'varchar', length: 150 })
  father_husband_name: string;

  /**
   * Unique among live rows through the partial index `uq_investors_cnic_live`,
   * exactly as customers (FR-CUS-08). TypeORM cannot express a partial index,
   * so it lives in the migration.
   */
  @Column({ type: 'varchar', length: 15 })
  cnic_number: string;

  @Column({ type: 'varchar', length: 20 })
  mobile_number: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  /**
   * The standing rate for *future* deployments only. A funded contract keeps
   * the rate snapshotted on its funding row, so changing this never restates a
   * deal already done (FR-IVT-03, BR-16).
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 50 })
  profit_share_pct: string;

  /** False means the house absorbs an unrecovered loss instead (BR-20). */
  @Column({ type: 'boolean', default: true })
  loss_participation: boolean;

  @Column({ type: 'date', nullable: true })
  agreement_date: string | null;

  @Column({
    type: 'enum',
    enum: InvestorStatus,
    enumName: 'InvestorStatus',
    default: InvestorStatus.active,
  })
  status: InvestorStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  /** FR-IVT-04 blocks the delete while capital is outstanding or a balance remains. */
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => InvestorTransaction, (txn) => txn.investor)
  transactions: Relation<InvestorTransaction>[];

  @OneToMany(() => ContractFunding, (funding) => funding.investor)
  fundings: Relation<ContractFunding>[];
}
