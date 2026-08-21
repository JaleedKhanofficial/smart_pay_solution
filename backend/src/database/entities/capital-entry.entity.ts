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

/** SRS §5.11 — capital injected into the business. Module 8. */
@Entity('capital_entries')
export class CapitalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /** e.g. "2026-08"; the period the entry belongs to. */
  @Column({ name: 'period_label', type: 'varchar', length: 20 })
  periodLabel: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'entered_by', type: 'uuid' })
  enteredById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => User, (user) => user.capitalEntries, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'entered_by' })
  enteredBy: Relation<User>;
}
