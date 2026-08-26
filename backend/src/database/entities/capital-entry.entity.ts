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
import { CapitalSource } from '../../common/enums';
import { User } from './user.entity';

/** SRS §5.11 — capital injected into the business. Module 8. */
@Entity('capital_entries')
export class CapitalEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /**
   * FR-SUM-10. Only `own` exists in v2: investor money lives in the
   * investor ledger and must never be counted as owner equity by BR-25.
   */
  @Column({
    type: 'enum',
    enum: CapitalSource,
    enumName: 'CapitalSource',
    default: CapitalSource.own,
  })
  source: CapitalSource;

  /** e.g. "2026-08"; the period the entry belongs to. */
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

  @ManyToOne(() => User, (user) => user.capitalEntries, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'entered_by' })
  enteredBy: Relation<User>;
}
