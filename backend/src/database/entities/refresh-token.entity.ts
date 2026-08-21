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

/** SRS §5.2 — one row per issued refresh token (FR-AUT-02). */
@Entity('refresh_tokens')
@Index('refresh_tokens_user_id_idx', ['user_id'])
@Index('refresh_tokens_family_id_idx', ['family_id'])
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  user_id: number;

  /** HMAC-SHA256 of the raw token, so the table alone cannot replay a session. */
  @Index('refresh_tokens_token_hash_key', { unique: true })
  @Column({ type: 'text' })
  token_hash: string;

  /** Rotation chain. Reusing a spent token revokes the whole family. */
  @Column({ type: 'uuid' })
  family_id: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;
}
