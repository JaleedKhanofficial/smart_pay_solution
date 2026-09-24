import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { ExpensePeriodMember } from './expense-period-member.entity';
import { User } from './user.entity';

/**
 * SRS §4.15. A stretch of time whose common costs are split between the same
 * set of investors.
 *
 * Periods exist because the roster changes. The August sheet has two of them —
 * "up to 10-08" and "from 11-08" — and dividing either by today's investor
 * count would quietly recharge people who were never in it.
 */
@Entity('expense_periods')
export class ExpensePeriod {
  @PrimaryGeneratedColumn()
  id: number;

  /** What the owner calls it: "Common-1", "August", "Q3". */
  @Column({ type: 'varchar', length: 60 })
  label: string;

  @Column({ type: 'date' })
  starts_on: string;

  /** Open-ended until the period is closed. */
  @Column({ type: 'date', nullable: true })
  ends_on: string | null;

  /** A closed period takes no further expenses. */
  @Column({ type: 'boolean', default: false })
  closed: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'integer' })
  created_by: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: Relation<User>;

  @OneToMany(() => ExpensePeriodMember, (member) => member.period)
  members: Relation<ExpensePeriodMember[]>;
}
