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
import { User } from './user.entity';

/**
 * SRS §5.5. Served only through the authenticated endpoint (FR-CUS-05-v2), so
 * the filename never appears in a URL.
 *
 * The owner columns are plain integers with **no foreign key** and no relation:
 * a file records who it belongs to, and the owner records which file it uses,
 * but neither is joined by the ORM. Nothing at the database level enforces that
 * the ids exist — see SRS §2.7 deviation 11.
 */
@Entity('files')
@Index('files_customer_id_idx', ['customer_id'])
@Index('files_guarantor_id_idx', ['guarantor_id'])
export class File {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * The filename on disk, e.g. "Ali Raza - 35201-1234567-1 - 18-08-2026.png".
   * It used to be the key (SRS §2.7 deviation 2); it is now data, so the name
   * stays readable without being the identifier. Clashes gain " (2)".
   */
  @Column({ type: 'text' })
  stored_name: string;

  /** Whose record this file belongs to. Null for anything not customer-related. */
  @Column({ type: 'integer', nullable: true })
  customer_id: number | null;

  /** Set when the file is a guarantor's scan; customer_id is set as well. */
  @Column({ type: 'integer', nullable: true })
  guarantor_id: number | null;

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
}
