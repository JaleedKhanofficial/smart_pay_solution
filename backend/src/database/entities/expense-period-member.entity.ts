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
import { ExpensePeriod } from './expense-period.entity';
import { Investor } from './investor.entity';

/**
 * BR-28/BR-29. One investor's place in a period's split.
 *
 * Membership is recorded rather than inferred from who is active today: a
 * period read a year later has to divide by the people who were actually in
 * it, and has to remember that Hamid's share was written off and why.
 */
@Entity('expense_period_members')
@Index('expense_period_members_period_id_idx', ['period_id'])
export class ExpensePeriodMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  period_id: number;

  @Column({ type: 'integer' })
  investor_id: number;

  /**
   * BR-29. Left out of the split. Their share is absorbed by the business,
   * never spread across the others — the rest carry what they always carried.
   */
  @Column({ type: 'boolean', default: false })
  waived: boolean;

  /** Required whenever `waived` is set; the database enforces it. */
  @Column({ type: 'text', nullable: true })
  waive_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => ExpensePeriod, (period) => period.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'period_id' })
  period: Relation<ExpensePeriod>;

  @ManyToOne(() => Investor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'investor_id' })
  investor: Relation<Investor>;
}
