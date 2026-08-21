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
@Index('installments_contract_id_seq_key', ['contractId', 'seq'], {
  unique: true,
})
@Index('installments_due_date_idx', ['dueDate'])
export class Installment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  contractId: string;

  @Column({ type: 'integer' })
  seq: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Contract, (contract) => contract.installments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Relation<Contract>;
}
