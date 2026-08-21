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
@Index('refresh_tokens_user_id_idx', ['userId'])
@Index('refresh_tokens_family_id_idx', ['familyId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** HMAC-SHA256 of the raw token, so the table alone cannot replay a session. */
  @Index('refresh_tokens_token_hash_key', { unique: true })
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  /** Rotation chain. Reusing a spent token revokes the whole family. */
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;
}
