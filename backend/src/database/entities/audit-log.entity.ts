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
 * SRS §5.14 — append-only (FR-AUD-03). Written from every module; Module 11
 * adds the admin-facing viewer.
 */
@Entity('audit_logs')
@Index('audit_logs_entity_entity_id_idx', ['entity', 'entity_id'])
@Index('audit_logs_actor_id_idx', ['actor_id'])
@Index('audit_logs_created_at_idx', ['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** Null for events with no signed-in actor, such as a failed login. */
  @Column({ type: 'integer', nullable: true })
  actor_id: number | null;

  @Column({ type: 'varchar', length: 60 })
  entity: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entity_id: string | null;

  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, (user) => user.auditLogs, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'actor_id' })
  actor: Relation<User> | null;
}
