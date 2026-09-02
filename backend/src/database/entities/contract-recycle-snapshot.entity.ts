import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Contract } from './contract.entity';

/** One funding line frozen when a contract entered the Recycle Bin. */
export type RecycleFundingSnapshot = {
  investor_id: number;
  investor_name: string;
  amount: string;
  share_pct: string;
  funded_from_principal: string;
  funded_from_profit: string;
};

/** Everything needed to restore or purge investor stakes fairly. */
export type ContractRecycleSnapshotData = {
  captured_at: string;
  fundings: RecycleFundingSnapshot[];
  recovery: {
    down_payment: string;
    /** Every payment row at capture time, voided ones included. */
    paid: string;
    markup_amount: string;
  };
};

/**
 * FR-CON-09 / FR-BIN-02. Investor stakes are frozen when a contract is soft-
 * deleted, so restore can reassign funders and purge can settle from fact, not
 * from whatever the rows happen to say later.
 */
@Entity('contract_recycle_snapshots')
export class ContractRecycleSnapshot {
  @PrimaryColumn({ type: 'integer' })
  contract_id: number;

  @Column({ type: 'jsonb' })
  snapshot: ContractRecycleSnapshotData;

  @Column({ type: 'timestamptz' })
  captured_at: Date;

  @OneToOne(() => Contract, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Relation<Contract>;
}
