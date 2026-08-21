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
   * It doubles as the key, so customers.cnic_file_id reads as the filename
   * rather than an opaque id (SRS §2.7 deviation 2). Clashes gain " (2)".
   */
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ name: 'original_name', type: 'text' })
  originalName: string;

  @Column({ type: 'varchar', length: 120 })
  mime: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Index('files_storage_path_key', { unique: true })
  @Column({ name: 'storage_path', type: 'text' })
  storagePath: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.uploadedFiles, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: Relation<User>;

  @OneToMany(() => Customer, (customer) => customer.cnicFile)
  customers: Relation<Customer>[];

  @OneToMany(() => Guarantor, (guarantor) => guarantor.cnicFile)
  guarantors: Relation<Guarantor>[];

  @OneToMany(() => LedgerSnapshot, (snapshot) => snapshot.pdfFile)
  ledgerSnapshots: Relation<LedgerSnapshot>[];
}
