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
import { Contract } from './contract.entity';
import { Investor } from './investor.entity';
import { User } from './user.entity';

/**
 * SRS §5.18. One investor's stake in one contract, written inside the
 * activation transaction (FR-CON-14) and immutable afterwards (FR-CON-15).
 *
 * `profit_share_pct` is a **snapshot**, not a lookup: changing an investor's
 * standing rate must never restate a deal already funded (BR-16). Two investors
 * on the same contract may hold different rates for the same reason.
 *
 * The bucket split is what BR-19 reverses on recovery — capital returns to the
 * bucket it came from — so it has to account for the whole deployment, which
 * the database checks.
 */
@Entity('contract_fundings')
@Index(
  'uq_contract_fundings_contract_investor',
  ['contract_id', 'investor_id'],
  {
    unique: true,
  },
)
@Index('contract_fundings_investor_id_idx', ['investor_id'])
export class ContractFunding {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  contract_id: number;

  @Column({ type: 'integer' })
  investor_id: number;

  /** BR-15. Capital deployed against this contract's cost price. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /** BR-15. amount ÷ cost_price × 100, fixed at activation. */
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  share_pct: string;

  /** BR-16. Seeded from the investor, overridable per deal, then immutable. */
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  profit_share_pct: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  funded_from_principal: string;

  /** Non-zero marks this deployment as reinvestment (BR-23, BR-24a). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  funded_from_profit: string;

  /** Required when an admin departs from the investor's standing rate. */
  @Column({ type: 'text', nullable: true })
  share_override_reason: string | null;

  @Column({ type: 'timestamptz' })
  funded_at: Date;

  @Column({ type: 'integer' })
  created_by: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Contract, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contract_id' })
  contract: Relation<Contract>;

  @ManyToOne(() => Investor, (investor) => investor.fundings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'investor_id' })
  investor: Relation<Investor>;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: Relation<User>;
}
