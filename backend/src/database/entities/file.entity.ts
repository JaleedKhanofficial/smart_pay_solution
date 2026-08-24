import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Guarantor } from './guarantor.entity';
import { LedgerSnapshot } from './ledger-snapshot.entity';
import { User } from './user.entity';

/**
 * SRS §5.5. Served only through the authenticated endpoint (FR-CUS-05-v2), so
 * the filename never appears in a URL.
 */
@Entity('files')
export class File {
  /**
   * The filename on disk, e.g. "Ali Raza - 35201-1234567-1 - 18-08-2026.png".
   * It doubles as the key, so customers.cnic_file_front_id reads as the filename
   * rather than an opaque id (SRS §2.7 deviation 2). Clashes gain " (2)".
   */
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  original_name: string;

  @Column({ type: 'varchar', length: 120 })
  mime: string;

  @Column({ type: 'integer' })
  size_bytes: number;

  @Index('files_storage_path_key', { unique: true })
  @Column({ type: 'text' })
  storage_path: string;

  @Column({ type: 'integer' })
  uploaded_by: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, (user) => user.uploadedFiles, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: Relation<User>;

  /** Customers whose CNIC *front* scan this file is. */
  @OneToMany(() => Customer, (customer) => customer.cnicFileFront)
  customerFronts: Relation<Customer>[];

  /** Customers whose CNIC *back* scan this file is. */
  @OneToMany(() => Customer, (customer) => customer.cnicFileBack)
  customerBacks: Relation<Customer>[];

  /** Guarantors whose CNIC *front* scan this file is. */
  @OneToMany(() => Guarantor, (guarantor) => guarantor.cnicFileFront)
  guarantorFronts: Relation<Guarantor>[];

  /** Guarantors whose CNIC *back* scan this file is. */
  @OneToMany(() => Guarantor, (guarantor) => guarantor.cnicFileBack)
  guarantorBacks: Relation<Guarantor>[];

  @OneToMany(() => LedgerSnapshot, (snapshot) => snapshot.pdfFile)
  ledgerSnapshots: Relation<LedgerSnapshot>[];
}
