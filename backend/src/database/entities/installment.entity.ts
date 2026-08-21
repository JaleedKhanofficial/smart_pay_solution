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

/** SRS §5.8 — the plan, generated per BR-04-v2 / BR-05. Module 4. */
@Entity('installments')
@Index('installments_contract_id_seq_key', ['contract_id', 'seq'], {
  unique: true,
})
@Index('installments_due_date_idx', ['due_date'])
export class Installment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  contract_id: number;

  @Column({ type: 'integer' })
  seq: number;

  @Column({ type: 'date' })
  due_date: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Contract, (contract) => contract.installments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Relation<Contract>;
}
