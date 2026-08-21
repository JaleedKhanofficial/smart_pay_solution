import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Role, UserStatus } from '../../common/enums';
import { AuditLog } from './audit-log.entity';
import { CapitalEntry } from './capital-entry.entity';
import { ExpenseEntry } from './expense-entry.entity';
import { File } from './file.entity';
import { LedgerSnapshot } from './ledger-snapshot.entity';
import { Payment } from './payment.entity';
import { RefreshToken } from './refresh-token.entity';
import { SummaryScenario } from './summary-scenario.entity';

/**
 * SRS §5.1. Email is unique among live rows only, through the partial index
 * `uq_users_email_live` — a soft-deleted account never blocks reuse of its
 * address. TypeORM cannot express a partial index, so it lives in the baseline
 * migration and is noted here.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 190 })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: Role,
    enumName: 'Role',
    default: Role.operator,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'UserStatus',
    default: UserStatus.active,
  })
  status: UserStatus;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: Relation<RefreshToken>[];

  @OneToMany(() => File, (file) => file.uploadedBy)
  uploadedFiles: Relation<File>[];

  @OneToMany(() => Payment, (payment) => payment.recordedBy)
  recordedPayments: Relation<Payment>[];

  @OneToMany(() => AuditLog, (log) => log.actor)
  auditLogs: Relation<AuditLog>[];

  @OneToMany(() => LedgerSnapshot, (snapshot) => snapshot.createdBy)
  ledgerSnapshots: Relation<LedgerSnapshot>[];

  @OneToMany(() => CapitalEntry, (entry) => entry.enteredBy)
  capitalEntries: Relation<CapitalEntry>[];

  @OneToMany(() => ExpenseEntry, (entry) => entry.enteredBy)
  expenseEntries: Relation<ExpenseEntry>[];

  @OneToMany(() => SummaryScenario, (scenario) => scenario.user)
  scenarios: Relation<SummaryScenario>[];
}
