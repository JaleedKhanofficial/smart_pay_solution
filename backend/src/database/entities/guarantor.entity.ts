import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Customer } from './customer.entity';
import { File } from './file.entity';

/**
 * SRS §5.4. Position 1 is required and position 2 is optional — a deliberate
 * relaxation of FR-CUS-03-v2 (SRS §2.7 deviation 4). The unique index on
 * (customer_id, position) is what stops a customer holding two guarantors in
 * the same slot; CustomersService checks first so the client gets a 400.
 */
@Entity('guarantors')
@Index('guarantors_customer_id_position_key', ['customer_id', 'position'], {
  unique: true,
})
export class Guarantor {
  /** Sequential like the customer key, so staff can quote a short number. */
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  customer_id: number;

  /** 1 or 2. */
  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'varchar', length: 150 })
  full_name: string;

  @Column({ type: 'varchar', length: 150 })
  father_name: string;

  @Column({ type: 'varchar', length: 60 })
  relationship: string;

  @Column({ type: 'varchar', length: 15 })
  cnic_number: string;

  @Column({ type: 'varchar', length: 20 })
  mobile_number: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'text', nullable: true })
  cnic_file_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Customer, (customer) => customer.guarantors, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Relation<Customer>;

  @ManyToOne(() => File, (file) => file.guarantors, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'cnic_file_id' })
  cnicFile: Relation<File> | null;
}
