import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** SRS §5.13 — application settings, keyed by name. Module 10. */
@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  key: string;

  /**
   * JSONB holds any JSON, and settings genuinely are a mix — `true`, `20`, and
   * the letterhead object all live in this column. Typing it as an object was
   * wrong and forced every reader to cast through `unknown`; the settings
   * registry is what narrows a key to its real shape.
   */
  @Column({ type: 'jsonb' })
  value: unknown;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
