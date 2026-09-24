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
import { ExpenseKind } from '../../common/enums';
import { ExpensePeriod } from './expense-period.entity';
import { Investor } from './investor.entity';
import { User } from './user.entity';

/**
 * SRS §4.15. One thing the business paid for.
 *
 * **Editable and deletable**, unlike an investor ledger line. This is a record
 * of spending, not a movement of someone's money: a mistyped amount is a
 * mistyped amount, and correcting it should not need a reversing entry. Every
 * figure that depends on it is derived, so a correction lands everywhere at
 * once (BR-31).
 */
@Entity('expenses')
@Index('expenses_spent_on_idx', ['spent_on'])
export class Expense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 12 })
  kind: ExpenseKind;

  /** Set on a common expense, null on an individual one. */
  @Column({ type: 'integer', nullable: true })
  period_id: number | null;

  /** Set on an individual expense, null on a common one. */
  @Column({ type: 'integer', nullable: true })
  investor_id: number | null;

  @Column({ type: 'date' })
  spent_on: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'integer' })
  entered_by: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => ExpensePeriod, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'period_id' })
  period: Relation<ExpensePeriod> | null;

  @ManyToOne(() => Investor, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'investor_id' })
  investor: Relation<Investor> | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'entered_by' })
  enteredBy: Relation<User>;
}
