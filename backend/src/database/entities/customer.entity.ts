import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Contract } from './contract.entity';
import { File } from './file.entity';
import { Guarantor } from './guarantor.entity';

/**
 * SRS §5.3. Two deliberate departures from the base spec, both recorded in
 * SRS §2.7:
 *   1. the key is a sequential integer, so staff can quote a short reference;
 *   2. cnic_file_id holds a filename rather than a UUID.
 *
 * CNIC is unique among live rows only, through the partial index
 * `uq_customers_cnic_live` (FR-CUS-08). TypeORM cannot express a partial index,
 * so it lives in the baseline migration; CustomersService checks first anyway so
 * the client gets a field-level 409 rather than a driver error.
 */
@Entity('customers')
@Index('customers_full_name_idx', ['fullName'])
@Index('customers_cnic_number_idx', ['cnicNumber'])
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ name: 'father_husband_name', type: 'varchar', length: 150 })
  fatherHusbandName: string;

  @Column({ name: 'cnic_number', type: 'varchar', length: 15 })
  cnicNumber: string;

  @Column({ name: 'mobile_number', type: 'varchar', length: 20 })
  mobileNumber: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 120 })
  occupation: string;

  /** `pg` returns DECIMAL as a string, which keeps the value exact end to end. */
  @Column({
    name: 'monthly_income',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  monthlyIncome: string;

  @Column({ name: 'cnic_file_id', type: 'text', nullable: true })
  cnicFileId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** Soft delete (FR-CUS-09-v2). TypeORM excludes these rows on its own. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => File, (file) => file.customers, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'cnic_file_id' })
  cnicFile: Relation<File> | null;

  // No cascade: CustomersService writes guarantors explicitly, inside the same
  // transaction, so it controls the order and can attach the right file to each.
  @OneToMany(() => Guarantor, (guarantor) => guarantor.customer)
  guarantors: Relation<Guarantor>[];

  @OneToMany(() => Contract, (contract) => contract.customer)
  contracts: Relation<Contract>[];
}
