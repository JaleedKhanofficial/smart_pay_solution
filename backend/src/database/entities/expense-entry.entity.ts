import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from './user.entity';

/** SRS §5.11 — running costs, netted off profit. Module 8. */
@Entity('expense_entries')
export class ExpenseEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 20 })
  period_label: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'integer' })
  entered_by: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ManyToOne(() => User, (user) => user.expenseEntries, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'entered_by' })
  enteredBy: Relation<User>;
}
