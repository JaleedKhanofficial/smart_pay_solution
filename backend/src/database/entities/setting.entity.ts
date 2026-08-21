import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** SRS §5.13 — application settings, keyed by name. Module 10. */
@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'jsonb' })
  value: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
