import { AuditLog } from './audit-log.entity';
import { CapitalEntry } from './capital-entry.entity';
import { Contract } from './contract.entity';
import { Customer } from './customer.entity';
import { ExpenseEntry } from './expense-entry.entity';
import { File } from './file.entity';
import { Guarantor } from './guarantor.entity';
import { Installment } from './installment.entity';
import { LedgerSnapshot } from './ledger-snapshot.entity';
import { Payment } from './payment.entity';
import { Product } from './product.entity';
import { ProductCategory } from './product-category.entity';
import { RefreshToken } from './refresh-token.entity';
import { Setting } from './setting.entity';
import { SummaryScenario } from './summary-scenario.entity';
import { User } from './user.entity';

export {
  AuditLog,
  CapitalEntry,
  Contract,
  Customer,
  ExpenseEntry,
  File,
  Guarantor,
  Installment,
  LedgerSnapshot,
  Payment,
  Product,
  ProductCategory,
  RefreshToken,
  Setting,
  SummaryScenario,
  User,
};

/**
 * Registered with both the runtime DataSource and the CLI. Listed explicitly
 * rather than by glob so a compiled build and a ts-node run always see the same
 * set — a glob over `dist` and a glob over `src` are easy to let drift.
 */
export const ENTITIES = [
  AuditLog,
  CapitalEntry,
  Contract,
  Customer,
  ExpenseEntry,
  File,
  Guarantor,
  Installment,
  LedgerSnapshot,
  Payment,
  Product,
  ProductCategory,
  RefreshToken,
  Setting,
  SummaryScenario,
  User,
];
