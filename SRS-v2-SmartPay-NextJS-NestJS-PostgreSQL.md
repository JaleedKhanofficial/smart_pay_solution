# Software Requirements Specification, Version 2
## SmartPay Solutions: Installment Sales & Recovery Management System
### Rebuild on Next.js + NestJS + PostgreSQL

| | |
|---|---|
| **Document version** | 2.5 |
| **Date** | 08-17-2026, amended 08-18-2026 |
| **Amendments** | 2.1 — added NFR-12 and §8.1, responsive layout. 2.2 — added §2.7 as-built deviations, §8.2 list-screen conventions (NFR-13) and §8.3 interface system (NFR-14). 2.3 — ORM changed from Prisma to TypeORM; added §2.8 persistence layer. 2.4 — identity updated to the navy/sky logo palette; all data-shape names follow the database columns; all primary keys sequential. 2.5 — Module 3 built; deviations 8–10 added. |
| **Supersedes** | SRS 1.0 (08-14-2026, CodeIgniter 3 / MySQL as-built) |
| **Status** | Target specification for the greenfield rebuild |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **SmartPay Solutions v2 (SPS v2)**, a full rebuild of the existing CodeIgniter 3 back-office application on a modern stack: **Next.js** frontend, **NestJS** API backend, and **PostgreSQL** database. Unlike SRS 1.0, which documented the system as-built including its defects, this document is a *target* specification: it carries every working v1 capability forward and mandates fixes for every gap catalogued in SRS 1.0 §9.

### 1.2 Scope
SPS v2 covers the same business domain as v1: the full life cycle of an installment credit sale for a Pakistani installment-sales business.

1. Register a customer with two guarantors and scanned CNIC images.
2. Maintain a product catalogue.
3. Create an installment agreement (contract) with markup, down payment, and a month plan, with all financials computed and enforced server-side.
4. Generate a stored installment schedule at contract activation.
5. Print a formal invoice/agreement.
6. Record payments against a contract inside a database transaction; the contract balance is always derived, never hand-maintained.
7. View a per-contract recovery ledger that is **derived from actual payments**, grades punctuality, and awards a loyalty tier.
8. View a portfolio-wide internal summary with profit maturity, capital, and expense analysis, with capital and expenses persisted in the database.
9. Authenticate users and enforce role-based access.
10. Soft-delete records into a working Recycle Bin, with a full audit trail.

New in scope versus v1: authentication and RBAC, audit logging, Recycle Bin, installment scheduling, persisted portfolio figures, data migration from the v1 MySQL database. Still out of scope: accounting integration, SMS/email notification, multi-branch operation, customer-facing portal, online payment collection.

### 1.3 Intended audience
The development team building v2, the business owner acting as product owner, and QA.

### 1.4 Definitions and abbreviations
Definitions from SRS 1.0 §1.4 carry over unchanged (CNIC, Contract, Down payment, Markup, Net amount, Recovery ledger, Mature profit, PKR). New terms:

| Term | Meaning |
|---|---|
| **Financed amount** | Net amount minus down payment, fixed at contract activation. Replaces v1's dual-purpose `remaining_amount`. |
| **Outstanding balance** | Financed amount minus the sum of non-voided payments. Always derived, never stored. |
| **Installment schedule** | The stored set of due dates and amounts generated at contract activation. |
| **Void** | Soft-deleting a payment. Voided payments are excluded from all balances but retained for audit. |
| **RBAC** | Role-based access control. |

### 1.5 References
- SRS 1.0 (08-14-2026): source of all v1 behaviour, business rules, and the defect register in its §9.
- `smartpaysolution` MySQL schema dump: the migration source.

---

## 2. Overall description

### 2.1 Product perspective
SPS v2 is a two-tier web application: a Next.js frontend served to the browser, and a NestJS REST API that owns all business logic and is the only writer to a PostgreSQL database. Every financial figure the browser displays is either returned by the API or explicitly labelled as a client-side preview that the server will recompute and enforce on save.

### 2.2 Architecture

```
Browser
  │  Next.js 15 (App Router, React 19, TypeScript)
  │  TanStack Query · react-hook-form + zod · Tailwind CSS + shadcn/ui
  ▼  HTTPS, JSON, Bearer JWT
NestJS 11 API (TypeScript)
  │  Controllers → Services → Repositories (TypeORM)
  │  Guards (JWT + roles) · DTO validation (class-validator)
  │  OpenAPI/Swagger at /api/docs
  ▼
PostgreSQL 16 (schema `sps`)          Local disk or S3-compatible
  FKs, transactions, soft deletes      object store for CNIC images
```

| Layer | Decision |
|---|---|
| Frontend | Next.js 15, App Router. Server Components for list/detail reads; Client Components for the contract calculator, ledger, and summary workbook. Responsive from 320 px per NFR-12. |
| API | NestJS 11, REST, versioned under `/api/v1`. |
| ORM / migrations | **TypeORM**, with entity classes under `src/database/entities/` as the single source of schema truth and versioned migrations under `src/database/migrations/`. Services take repositories by constructor injection; `synchronize` is permanently off, so the schema changes only through a reviewed migration. No hand-run SQL bootstrap (replaces v1 `/setup`, which had drifted from the live schema). |
| Database | PostgreSQL 16. `NUMERIC(12,2)` for all money. UTC timestamps (`timestamptz`); dates as `date`. |
| Auth | JWT access token (15 min) + rotating refresh token (7 days, httpOnly cookie). Argon2id password hashing. |
| Validation | zod on the frontend for UX; class-validator DTOs on the API as the enforced layer. The API never trusts client-computed money figures. |
| File storage | Uploads stored outside the web root with UUID filenames; served only through an authenticated API endpoint. Replaces v1's world-readable `assets/customer/*`. |
| API docs | Swagger auto-generated from decorators. |
| Deployment | Docker Compose: `web` (Next.js), `api` (NestJS), `db` (Postgres), optional `minio`. Configuration via environment variables only; no hard-coded `base_url`. |

### 2.3 User classes
Two roles, enforced by API guards on every route (fixes v1 §9.1 item 1):

| Role | Access |
|---|---|
| **admin** | Everything, plus user management, Recycle Bin restore/purge, audit log, portfolio capital/expense entry. |
| **operator** | Customers, products, contracts, payments, invoices, recovery ledger, summary report (read), own profile. |

### 2.4 Operating environment
Any Docker-capable Linux host. Evergreen browsers. Internet access is not required at runtime: all frontend assets are bundled, no CDN dependencies (removes v1's Bootstrap/FontAwesome/SweetAlert CDN reliance).

### 2.5 Design constraints
- All money math defined in §6 is implemented exactly once, in a shared server-side service, and covered by unit tests. The frontend calculator imports the same formulas from a shared TypeScript package so preview and enforcement cannot drift (fixes v1 §9.3 rounding disagreements).
- Currency remains PKR only, displayed `Rs. n,nnn` with `en-PK` grouping. Dates display `dd-mm-yyyy`, stored ISO.
- Every destructive action is a soft delete behind a confirmation dialog. Hard deletes exist only as an admin "purge" from the Recycle Bin.
- All state-changing endpoints are POST/PATCH/DELETE with a Bearer token; nothing state-changing is reachable by GET (fixes v1 §9.1 items 2-3).

### 2.6 Key improvements over v1 (normative summary)

| # | v1 problem (SRS 1.0 ref) | v2 resolution |
|---|---|---|
| 1 | No authentication, public `/setup`, GET deletes, no CSRF (§9.1) | JWT auth + RBAC on every route; migrations replace `/setup`; state changes are non-GET with Bearer auth. |
| 2 | Two independent ledgers for the same money (§9.2) | `payments` is the single source of truth. The recovery ledger is derived from payments matched against the stored installment schedule. The JSON-blob workbook is retired. |
| 3 | Dual-purpose `remaining_amount`, non-transactional balance write-back, clamp/restore bug, no auto-complete (§9.4) | Balance is always derived (`financed_amount − SUM(payments)`), computed in the same transaction as any payment write. Contract status transitions to `completed`/`active` automatically. |
| 4 | Installment rounding disagrees between screens (§9.3, BR-04) | One rule (BR-04 v2): equal whole-rupee installments, final installment absorbs the remainder, sum always equals the financed amount exactly. |
| 5 | No FKs, orphaned rows on delete (§9.4) | Full foreign keys with `ON DELETE RESTRICT`; soft deletes make restriction practical. |
| 6 | All financials browser-computed and trusted (§4.4 defect) | Server recomputes and persists every derived figure; a crafted POST cannot store inconsistent amounts. |
| 7 | Capital/expenses/edits live in `localStorage` per browser (§9.6) | Capital and expense entries are database rows; summary "what-if" edits are explicitly labelled simulations, storable as named scenarios in the database. |
| 8 | Recycle Bin is a dead link; User Management orphaned (§9.5) | Both fully implemented. |
| 9 | No audit trail (NFR-08) | Append-only audit log of every write with actor, before/after, timestamp. |
| 10 | `g1/g2_father_name` collected but never written (§4.2 defect) | Guarantors normalised into their own table; all fields persisted. |
| 11 | Plan months 3-15 vs 1-20 inconsistency (§9.3) | Unified 1-20, configurable system setting. |
| 12 | Dashboard profit tile hard-coded at 15% (§4.1 defect) | Real mature-profit figure from BR-09. |
| 13 | Stored XSS via unescaped output (§9.1 item 4) | React escapes by default; no `dangerouslySetInnerHTML` on user data; API returns JSON only. |

---

### 2.7 As-built deviations

Modules 2 and 3 are built. These decisions differ from the text above; each was
taken deliberately and each binds the modules still to come. They are recorded here so
the document and the code stop disagreeing.

| # | Clause | As built | Reason |
|---|---|---|---|
| 1 | §5 — `id UUID PK` on every table | `customers.id` and `guarantors.id` are **sequential integers** | staff quote a short reference number; ids appear in conversation and on paper |
| 2 | §5.5 / FR-CUS-04-v2 — UUID filenames | uploads are stored as `<name> - <cnic> - <dd-mm-yyyy>.<ext>` in a folder per subject (`customer/`, `guarantor_1/`, `guarantor_2/`), and **the filename is the `files` key**, so `cnic_file_id` reads as the filename | a filename that means something is worth more than an opaque one; the security property is unaffected because filenames never appear in a URL — files are fetched by key through the authenticated endpoint (FR-CUS-05-v2) |
| 3 | FR-CUS-04-v2 — 5 MB max | **10 MB** per image (the clause text is updated) | phone cameras exceed 5 MB routinely |
| 4 | FR-CUS-03-v2 — exactly two guarantors | **guarantor 1 required, guarantor 2 optional**; positions must still be unique, enforced by `(customer_id, position)` | a second guarantor is not always available at registration |
| 5 | §5 — `updated_at` trigger-maintained | maintained by the ORM (`@UpdateDateColumn`), with `DEFAULT CURRENT_TIMESTAMP` on the column | the API is the only writer, so a trigger adds no guarantee. The default is not decoration: TypeORM writes `DEFAULT` for this column on INSERT and expects the database to supply the value |
| 6 | FR-CUS-10 / NFR-01 — toast feedback | **result dialogs** replace toasts for create, update and delete (§8.3) | the owner preferred an explicit acknowledgement over a self-dismissing toast |
| 7 | §2.2 — TanStack Query, react-hook-form + zod, shadcn/ui | Server Components and Server Actions, native form validation, a hand-built component set (§8.3) | **open decision, not settled** — every screen now depends on it, and retrofitting costs more the longer it waits |
| 8 | FR-PRD-07 — categories managed "under Settings" | categories are managed at **`/products/categories`**, shipped with Module 3 | FR-PRD-07 is a Module 3 requirement, and a catalogue whose every product is `misc` is not usable. Module 12 can surface the same screen under Settings without rework |
| 9 | FR-PRD-07 — category lifecycle | categories can be added, renamed, and **deleted only while empty**; products soft-delete as specified | once a product is filed under a category the name is part of the Summary Report's deal dimension (FR-PRD-06), so that delete is refused rather than cascaded. "Empty" counts soft-deleted products too — a recycled product still holds the foreign key |
| 10 | §8.2 — registers are list screens | the product catalogue is added to and edited **entirely in a popup** (`Modal`); it has no add/edit pages at all, so filters, sort and page survive every edit | a catalogue is edited in short bursts, and losing a filtered view on each one is the friction the owner asked to remove. Customer registration keeps its pages: three uploads and two guarantor blocks are a page's worth of work, not a panel's |

Item 7 is the one still worth revisiting. Items 1–6 and 8–10 are closed.

---

### 2.8 Persistence layer (TypeORM)

The rules below apply to every module. Module 2 is the reference
implementation; a new module should be readable by anyone who has read it.

| ID | Requirement |
|---|---|
| §2.8.1 | **One entity per table**, under `src/database/entities/`, registered in the `ENTITIES` barrel. The entity is the schema's source of truth; column names, lengths and nullability match the database exactly. |
| §2.8.2 | **`synchronize` is permanently false.** The schema changes only through a migration in `src/database/migrations/`, applied with `npm run migration:run`. A migration that touches live data states in a comment what it preserves. |
| §2.8.3 | **One DataSource.** `buildDataSourceOptions()` in `src/database/data-source.ts` is shared by the running application and the CLI, so the app and the migration tooling cannot describe different databases. |
| §2.8.4 | **Services take repositories by constructor injection** (`@InjectRepository`), and `DataSource` only where a transaction spans more than one table. A service must not build its own connection. |
| §2.8.5 | **Soft delete is `@DeleteDateColumn`**, so the ORM excludes deleted rows itself. No query carries a hand-written `deleted_at IS NULL`, and no module can forget one. Recovering a row is `restore()`; `withDeleted()` is required to see one. |
| §2.8.6 | **Money is `decimal(12,2)` and stays a string** from the database to the JSON response. It is never parsed into a float anywhere in the API. |
| §2.8.7 | **`created_at` and `updated_at` carry `DEFAULT CURRENT_TIMESTAMP` in the database.** TypeORM writes `DEFAULT` for both on INSERT and expects the database to supply the value; a column without a default fails with a NOT NULL violation on every insert. |
| §2.8.8 | **Entities are not returned directly.** Each module maps to an explicit response type, which fixes the JSON contract and doubles as the audit snapshot. Adding a column cannot silently widen the API. |
| §2.8.9 | **Sortable columns are whitelisted in the DTO** and applied through the query builder against the entity alias, never interpolated from the query string (NFR-13.5). |
| §2.8.10 | **Paginating a joined one-to-many makes TypeORM select ids through a subquery**, which can only order by columns on the root table. Child collections are ordered after the fetch, in the mapper. |

---

## 3. Module inventory

| # | Module | Frontend route | API prefix | State |
|---|---|---|---|---|
| 0 | Authentication & session | `/login` | `/api/v1/auth` | New |
| 1 | Dashboard & KPIs | `/dashboard` | `/api/v1/dashboard` | Carried over, fixed |
| 2 | Customer Management | `/customers` | `/api/v1/customers` | **Built**, guarantors normalised |
| 3 | Product Catalogue | `/products` | `/api/v1/products`, `/api/v1/product-categories` | **Built** |
| 4 | Contracts | `/contracts` | `/api/v1/contracts` | Carried over, server-authoritative |
| 5 | Invoice / Agreement | `/contracts/{id}/invoice` | `/api/v1/contracts/{id}/invoice` | Carried over |
| 6 | Payment Collection | `/payments` | `/api/v1/payments` | Carried over, transactional |
| 7 | Recovery Ledger (derived) | `/contracts/{id}/ledger` | `/api/v1/contracts/{id}/ledger` | Redesigned |
| 8 | Internal Summary Report | `/reports/summary` | `/api/v1/reports/summary` | Carried over, persisted figures |
| 9 | User Management | `/settings/users` | `/api/v1/users` | Completed (was orphaned) |
| 10 | Recycle Bin | `/settings/recycle-bin` | `/api/v1/recycle-bin` | New (was dead link) |
| 11 | Audit Log | `/settings/audit` | `/api/v1/audit` | New |
| 12 | System Settings | `/settings/system` | `/api/v1/settings` | New |

---

## 4. Functional requirements

Requirement IDs keep the v1 prefix where the capability carries over; a `v2` suffix marks changed behaviour. New modules get new prefixes.

### 4.0 Module 0: Authentication & session

| ID | Requirement |
|---|---|
| FR-AUT-01 | Log in with email + password. Passwords stored as Argon2id hashes. Return a 15-minute JWT access token; set a 7-day httpOnly, Secure, SameSite=Strict refresh cookie. |
| FR-AUT-02 | Refresh rotates the refresh token; a reused (already-rotated) refresh token revokes the whole token family. |
| FR-AUT-03 | Log out revokes the refresh token server-side and clears the cookie. |
| FR-AUT-04 | Rate-limit login: 5 failed attempts per account per 15 minutes, then a lockout with a generic error. |
| FR-AUT-05 | Every API route except `/auth/login` and `/auth/refresh` requires a valid access token; role guards enforce §2.3 per route. |
| FR-AUT-06 | The frontend redirects unauthenticated users to `/login` and hides navigation the user's role cannot access; the API remains the enforcement layer. |
| FR-AUT-07 | A logged-in user can change their own password (current password required). |
| FR-AUT-08 | Inactive (`disabled`) users cannot log in and existing refresh tokens are revoked on disable. |

### 4.1 Module 1: Dashboard & KPIs
Single API call `GET /api/v1/dashboard` returning one aggregate payload (replaces v1's nine separate queries; NFR-07 fix).

| ID | Requirement |
|---|---|
| FR-DSH-01..03 | Today's collections, current-month collections, all-time collections: `SUM(amount)` of non-voided payments for the respective window. |
| FR-DSH-04-v2 | **Total Outstanding** = `SUM(financed_amount − paid)` across `active` contracts, where `paid` is that contract's non-voided payment sum. Includes markup, agreeing with the contract screen and summary report (fixes v1 §9.3 item 1). |
| FR-DSH-05..08 | Active plan count, active product count, customer count, total contract count (soft-deleted rows excluded everywhere). |
| FR-DSH-09 | Five most recent payments with customer and product name. |
| FR-DSH-10-v2 | **Mature Profit** tile computed per BR-09 across the portfolio (replaces the hard-coded 15% placeholder). |
| FR-DSH-11 | All monetary values render `Rs. n,nnn`, no decimals. |
| FR-DSH-12 | An **Attention** strip: count of contracts with at least one installment ≥ 1 day past due and unpaid, linking to a filtered contract list. *(New; enabled by the installment schedule.)* |

### 4.2 Module 2: Customer Management

| ID | Requirement |
|---|---|
| FR-CUS-01 | Paginated customer list (default 25/page), newest first, with search on name, CNIC, mobile; CNIC image thumbnail where present. |
| FR-CUS-02 | Create/edit a customer: full name, father/husband name, CNIC, mobile, address, occupation, monthly income. CNIC input auto-formats `#####-#######-#`; mobile auto-formats `0300-1234567`; both validated server-side by regex. |
| FR-CUS-03-v2 | Exactly two guarantor records per customer, each capturing full name, **father name** (now persisted; v1 bug fix), relationship, CNIC, mobile, address, CNIC image. Stored in the normalised `guarantors` table. |
| FR-CUS-04-v2 | Up to three image uploads (customer, G1, G2 CNIC): jpg/jpeg/png/webp, 10 MB max, MIME verified by magic bytes server-side, stored under UUID filenames outside the web root. |
| FR-CUS-05-v2 | Images are served only via `GET /api/v1/files/{uuid}` with a valid session; direct URL access without auth returns 401. |
| FR-CUS-06 | A failed upload aborts the whole save atomically and returns a field-level error naming which upload failed. |
| FR-CUS-07 | On edit, an omitted image keeps the existing file; a replacement marks the old file for deletion after the transaction commits. |
| FR-CUS-08 | CNIC uniqueness enforced by a database unique index (soft-deleted customers excluded via partial index), surfaced as a friendly field error. |
| FR-CUS-09-v2 | Delete is a **soft delete** requiring the customer to have no non-deleted contracts; otherwise the API returns 409 with the blocking contract list (fixes orphaning). |
| FR-CUS-10 | Success/error feedback as toast notifications. |

### 4.3 Module 3: Product Catalogue

| ID | Requirement |
|---|---|
| FR-PRD-01..04 | List (name ascending), create, edit, soft-delete products with name, category (default `misc`), status `Active`/`Inactive`. Soft delete blocked while non-deleted contracts reference the product (409). Product names are unique among live rows, checked in the service so the client gets a field-level 409 — two identically named products are indistinguishable on a contract picker. |
| FR-PRD-05 | Only `Active` products are selectable when creating a contract; the edit form shows the contract's product even if since deactivated. |
| FR-PRD-06 | Category remains the "Deal" dimension of the Summary Report. |
| FR-PRD-07 | Categories are managed as a simple lookup (add/rename) under Settings, so the Summary's deal dimension stays consistent. *(New.)* |

### 4.4 Module 4: Contracts

| ID | Requirement |
|---|---|
| FR-CON-01 | Paginated contract list joined to customer and product, newest first, filterable by status and by "past due" (FR-DSH-12). |
| FR-CON-02 | Row actions: **Ledger**, **Invoice**, **Edit**, **Delete** (soft). |
| FR-CON-03-v2 | Create a contract capturing: customer, product, **sale price** (renamed from v1's misleading `total_amount`), markup % (dropdown) or direct markup amount override, down payment, plan months (1-20, default 8, range configurable), product condition (`New`/`Used`), start date. Status starts `active`. |
| FR-CON-04-v2 | The browser shows a live plan preview using the shared formula package; **on submit the server recomputes markup amount, net amount, financed amount, installment schedule, and end date from the raw inputs and persists its own figures**. A submission whose client figures disagree with the server's beyond Rs. 1 is accepted with the server's figures and the response flags the correction. (Fixes v1's trust-the-browser defect.) |
| FR-CON-05-v2 | On activation the server generates the **installment schedule**: one row per plan month, due on the first day of each month after the agreement month, amounts per BR-04 v2. |
| FR-CON-06 | Net amount, financed amount, monthly installment, and end date render read-only. |
| FR-CON-07-v2 | Editing financial terms (sale price, markup, down payment, plan months, start date) is allowed only while the contract has **zero non-voided payments**; the schedule regenerates. Once payments exist, financial terms are locked and only status, product condition, and notes are editable. An admin may unlock via a logged override. |
| FR-CON-08-v2 | Status transitions: `active → completed` automatically when outstanding balance reaches 0 (BR-12); `completed → active` automatically if a payment void raises the balance above 0; `cancelled` is a manual action requiring an admin and a reason, blocked while balance > 0 unless the admin confirms a write-off flag. |
| FR-CON-09 | Soft delete after confirmation; blocked (409) while non-voided payments exist, admin override logged. |
| FR-CON-10 | Redirect to the list with a toast after any successful write. |

### 4.5 Module 5: Invoice / Agreement Printout

| ID | Requirement |
|---|---|
| FR-INV-01..05 | Carried over from v1 unchanged in content: full customer + both guarantors + product, SPS letterhead ("Easy Monthly Installments") — **open:** the screen palette moved to navy/sky per NFR-01, and whether print follows or keeps v1's gold is decided when this module is built, headline monthly installment and duration, the 16-clause Terms and Conditions, three signature blocks. 404 page for a missing contract. |
| FR-INV-06 | Print via `window.print()` with a print stylesheet, plus **Download PDF** rendered server-side so the document is identical on every machine. *(PDF endpoint may land in Phase 2; print ships in Phase 1.)* |
| FR-INV-07 | The invoice additionally prints the generated installment schedule table (due date + amount per month). *(New.)* |

### 4.6 Module 6: Payment Collection

| ID | Requirement |
|---|---|
| FR-PAY-01 | Paginated payment list joined to contract, customer, product; filter by contract, method, date range. |
| FR-PAY-02 | The contract picker offers only `active` contracts with outstanding balance > 0. |
| FR-PAY-03 | Selecting a contract pre-fills the amount with the next unpaid scheduled installment amount and shows outstanding balance and next due date. |
| FR-PAY-04 | Capture amount, payment date, method (**Cash**, **Bank Transfer**, **Cheque**), and an optional note/reference. |
| FR-PAY-05 | Server-side validation: all fields required, amount > 0, payment date not in the future beyond today, contract must be `active`. Field-level errors returned, form state preserved. |
| FR-PAY-06-v2 | An amount exceeding the outstanding balance is **rejected by default** with the exact overage stated; a system setting `allow_overpayment` can permit it behind an explicit confirmation. (Fixes v1's unbounded overpayment.) |
| FR-PAY-07-v2 | Payment insert, balance derivation, and any status auto-transition (BR-12) occur in **one database transaction**. There is no stored balance column to drift. |
| FR-PAY-08-v2 | Deleting a payment is a **void** (soft delete with reason, actor, timestamp). Voiding recomputes the derived balance and may flip a `completed` contract back to `active`, in one transaction. The v1 clamp/restore inflation bug is structurally impossible. |
| FR-PAY-09 | Toast confirmation on record and void; voids visible in the payment list with a struck-through style and the void reason on hover. |
| FR-PAY-10 | Each payment records `recorded_by` (the logged-in user). *(New.)* |

### 4.7 Module 7: Recovery Ledger (derived)
The v1 hand-typed JSON workbook is retired. The ledger is a **read-only analytical view generated from the installment schedule and the payments table**, so it can never disagree with the money (fixes v1 §9.2). All grading logic runs server-side in `GET /api/v1/contracts/{id}/ledger`.

| ID | Requirement |
|---|---|
| FR-REC-01-v2 | The ledger register is the contract list filtered/sorted by recovery health; a dedicated "Recovery" tab lists contracts with their tier badge, % recovered, and net lag/advance. |
| FR-REC-02-v2 | Payment application: non-voided payments are applied to scheduled installments **oldest due date first** (FIFO). A payment may split across installments; an installment may be covered by multiple payments. The applied date of an installment is the date of the payment that completed it. |
| FR-REC-03 | Per row (per scheduled month) the ledger shows: due date, required amount, applied amount, completing payment date, variance, status (Pending, Paid, Advance, Short Paid; magnitude < Rs. 1 counts as Exact), and punctuality remark per BR-06 v2. |
| FR-REC-04 | Live summary: months, total payable, down payment, total paid, outstanding, installments completed, % recovered, and net lag or net advance (net of all rows, not per-row sum, as in v1). |
| FR-REC-05 | Alert bar when a net lag or net advance exists; distribution chart of completed installments across the punctuality bands. |
| FR-REC-06 | Loyalty tier awarded per BR-07 (Platinum / Gold / Silver / Caution) with behaviour summary, reward text, and stamp block; "Awaiting data" when no installment has been completed. |
| FR-REC-07 | Print via print stylesheet and export as image (client-side capture at 2× scale, filename `SPS-Recovery-Report-{contract}-{dd-mm-yyyy}.jpg`), matching v1's deliverable. |
| FR-REC-08 | **Archive snapshot**: an operator can save a timestamped immutable snapshot (rendered data as JSON + optional PDF) for handing to the customer; snapshots are listed per contract and are never editable. This replaces v1's editable `recovery_reports` rows and preserves the "survives later changes" property. |
| FR-REC-09 | Legacy v1 recovery reports imported during migration (§9) are viewable read-only under a "Legacy" badge. |

### 4.8 Module 8: Internal Summary Report

| ID | Requirement |
|---|---|
| FR-SUM-01-v2 | `GET /api/v1/reports/summary` returns one row per non-deleted contract: client name/mobile/CNIC, product category (deal type), sale price, markup %, plan months, down payment, paid amount (non-voided payment sum), plus all BR-08 derived columns **computed server-side**. |
| FR-SUM-02-v2 | **Capital** and **expense** entries are database records (amount, period label, note, entered_by), admin-editable under this report; totals feed BR-10. localStorage is no longer the system of record (fixes v1 §9.6). |
| FR-SUM-03 | The workbook renders the full ledger table with the v1 column set, portfolio counters (total deals, completed, in progress, total outstanding, average markup), Mature/Unmatured/Total Profit and Net Balance per BR-09/BR-10, and the Deal Counter banner ranking categories with shares and medal ranks. |
| FR-SUM-04-v2 | Inline edits to sale price, markup %, plan, down payment, and paid amount operate in an explicit **Simulation mode** with a visible banner; simulated figures never write back to contracts. A simulation can be saved as a named **scenario** (rows + capital + expenses) to the database, max 20 per user, with load and delete. Replaces v1's silent display-only edits and `SPS_slots_v1` localStorage. |
| FR-SUM-05 | Search with scoped tabs All / Name / Mobile / CNIC, auto-formatting mobile and CNIC input, live match count; column sorting on name, sale price, paid amount, % completed; row selection with keyboard delete (simulation mode only). |
| FR-SUM-06 | Missing-data counters (clients lacking mobile or CNIC) with drill-down lists. |
| FR-SUM-07 | Top Performer modal (BR-11 score and narrative), per-client Profile modal (KPI strip, deal breakdown, score ring, timeline), and Client Summary Search modal, carried over from v1. |
| FR-SUM-08 | Export: print/PDF, image capture, and copy-table-to-clipboard. |
| FR-SUM-09 | Server-side pagination or virtualised rendering keeps the report responsive beyond 1,000 contracts (v1 NFR-07 fix). |

### 4.9 Module 9: User Management (admin only)

| ID | Requirement |
|---|---|
| FR-USR-01 | List, create, edit, disable/enable, and soft-delete users: name, email (unique), role (`admin`/`operator`), status. |
| FR-USR-02-v2 | Admin sets an initial password at creation and can force a reset; passwords are writable (v1's fillable-list bug fixed), stored only as Argon2id hashes, minimum 10 characters. |
| FR-USR-03 | An admin cannot disable, demote, or delete their own account, and the last remaining active admin cannot be disabled or demoted. |

### 4.10 Module 10: Recycle Bin (admin only)

| ID | Requirement |
|---|---|
| FR-BIN-01 | List soft-deleted customers, products, contracts, and voided payments, filterable by entity and date, showing who deleted and when. |
| FR-BIN-02 | **Restore** returns the record to service; restore is blocked with a clear message if it would violate uniqueness (e.g. CNIC now reused) or referential rules. |
| FR-BIN-03 | **Purge** permanently deletes; requires typed confirmation and cascades only where safe (a purged customer requires its contracts purged first). Purges are audit-logged. |
| FR-BIN-04 | Optional retention setting: auto-purge items deleted more than N days ago (default: never). |

### 4.11 Module 11: Audit Log (admin only)

| ID | Requirement |
|---|---|
| FR-AUD-01 | Every create/update/soft-delete/void/restore/purge/login/lockout writes an append-only audit row: actor, entity, entity id, action, before/after JSON diff, timestamp, IP. |
| FR-AUD-02 | Filterable, paginated viewer by entity, actor, action, and date range; per-record history reachable from each detail screen. |
| FR-AUD-03 | Audit rows are never editable or deletable through the application. |

### 4.12 Module 12: System Settings (admin only)

| ID | Requirement |
|---|---|
| FR-SET-01 | Editable settings: plan-month range (default 1-20), `allow_overpayment` (default off), Recycle Bin retention, business identity block for the invoice letterhead, punctuality band thresholds and tier thresholds (defaults per BR-06/BR-07). |
| FR-SET-02 | Settings changes are audit-logged and take effect without redeploy. |

---

## 5. Data model (PostgreSQL)

All tables: `id UUID PK DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz` (trigger-maintained), `deleted_at timestamptz NULL` for soft-deletable entities. All money `NUMERIC(12,2)`. **Foreign keys everywhere, `ON DELETE RESTRICT`.**

### 5.1 `users`
`name`, `email` (unique, partial index where `deleted_at IS NULL`), `password_hash`, `role` (`admin`|`operator`), `status` (`active`|`disabled`), `last_login_at`.

### 5.2 `refresh_tokens`
`user_id FK`, `token_hash`, `family_id`, `expires_at`, `revoked_at`.

### 5.3 `customers`
`full_name` (indexed), `father_husband_name`, `cnic_number` (unique partial index), `mobile_number`, `address`, `occupation`, `monthly_income`, `cnic_file_id FK NULL → files`.

### 5.4 `guarantors`  *(new; replaces the g1_*/g2_* column blocks)*
`customer_id FK`, `position` (1|2, unique per customer), `full_name`, `father_name`, `relationship`, `cnic_number`, `mobile_number`, `address`, `cnic_file_id FK NULL`.

### 5.5 `files`
`uuid_name`, `original_name`, `mime`, `size_bytes`, `storage_path`, `uploaded_by FK users`. Served only via the authenticated file endpoint.

### 5.6 `products`
`name`, `category` (FK to `product_categories` or validated lookup, default `misc`), `status` (`Active`|`Inactive`).

### 5.7 `contracts`
`customer_id FK`, `product_id FK`, `sale_price`, `markup_pct NUMERIC(5,2)`, `markup_amount`, `net_amount`, `down_payment`, `financed_amount`, `monthly_installment`, `plan_months INT`, `product_condition` (`New`|`Used`), `start_date date`, `end_date date`, `status` (`active`|`completed`|`cancelled`), `write_off boolean DEFAULT false`, `terms_locked_at timestamptz NULL`, `notes`.
**No running-balance column.** Outstanding = `financed_amount − COALESCE(SUM(payments.amount) WHERE deleted_at IS NULL, 0)`, computed in queries/views.

### 5.8 `installments`  *(new)*
`contract_id FK`, `seq INT` (unique per contract), `due_date date`, `amount`. Regenerated only while FR-CON-07 allows term edits.

### 5.9 `payments`
`contract_id FK`, `amount`, `payment_date date` (indexed), `method` (`Cash`|`Bank Transfer`|`Cheque`), `note`, `recorded_by FK users`, `void_reason NULL`, `deleted_at` (= voided). The v1 `status` column is dropped: a stored payment is real; a voided one is soft-deleted with a reason.

### 5.10 `ledger_snapshots`  *(replaces `recovery_reports`)*
`contract_id FK`, `snapshot_no` (unique, e.g. `SPS-REC-0001`), `payload JSONB` (rendered ledger), `pdf_file_id FK NULL`, `created_by FK`, `legacy boolean DEFAULT false` (true for migrated v1 reports).

### 5.11 `capital_entries` / `expense_entries`
`amount`, `period_label` (e.g. `2026`, `2026-08`), `note`, `entered_by FK`.

### 5.12 `summary_scenarios`
`user_id FK`, `name`, `payload JSONB` (simulated rows + capital + expenses). Max 20 per user, enforced in service.

### 5.13 `settings`
Key/value (`key` unique, `value JSONB`).

### 5.14 `audit_logs`
`actor_id FK NULL`, `entity`, `entity_id`, `action`, `before JSONB`, `after JSONB`, `ip`, `created_at`. Append-only.

### 5.15 Relationships
```
users ──< payments.recorded_by, audit_logs, snapshots, scenarios
customers 1 ──< guarantors (exactly 2)
customers 1 ──< contracts >── 1 products
contracts 1 ──< installments   (the plan)
contracts 1 ──< payments       (the money; single source of truth)
contracts 1 ──< ledger_snapshots
files ──referenced by customers, guarantors, snapshots
```

---

## 6. Business rules and formulas
Implemented once in the shared formula package, unit-tested, used by both API and frontend preview.

### Contract pricing
| ID | Rule |
|---|---|
| BR-01 | `markup_amount = sale_price × markup_pct ÷ 100`, derived from the dropdown then overridable in rupees; overriding recomputes the effective % for display. |
| BR-02 | `net_amount = sale_price + markup_amount` |
| BR-03 | `financed_amount = net_amount − down_payment` (fixed at activation). |
| BR-04-v2 | **Installments:** `base = floor(financed_amount ÷ plan_months)` to whole rupees; installments 1..n−1 = `base`; installment n = `financed_amount − base × (n−1)`. The schedule always sums exactly to the financed amount. `monthly_installment` displays `base`. (Replaces v1's ceil-vs-unrounded disagreement.) |
| BR-05 | `end_date = start_date + plan_months` calendar months; installment k due on the first day of the k-th month after the agreement month. |

### Recovery grading (server-side)
| ID | Rule |
|---|---|
| BR-06-v2 | **Punctuality bands by days after due date** (equivalent to v1's day-of-month bands, since installments fall due on the 1st): 0-4 *Early — Excellent*; 5-9 *On Time*; 10-14 *Slight Delay*; 15-19 *Late*; 20-24 *Very Late*; 25+ *Overdue*. Thresholds configurable (FR-SET-01). |
| BR-07 | **Loyalty tier** over completed installments: **Platinum** (5% reduction) when every one falls in band 0-4; else **Gold** (3%) when ≥ 80% fall within 0-9; else **Silver** (1%) when fewer than 50% fall at 15+; else **Caution** (0%, stricter terms, guarantor recommended). Advisory on the next contract, not auto-applied (v1 open question 2 resolved: stays advisory; revisit later). |
| BR-13 | FIFO application: payments apply to the oldest unpaid installment first; variance per row = applied − required; magnitude < Rs. 1 is Exact; % recovered = `min(100, total_paid ÷ financed_amount × 100)`; portfolio lag/advance is the net across rows. |

### Portfolio analytics
| ID | Rule |
|---|---|
| BR-08 | Per-deal derivations carried over verbatim from v1: markupAmount, totalSale, remBalance, `investment = sale_price − down_payment`, actualMarkupPct, `outstanding = max(0, totalSale − downPayment − paid)`, `pctCompleted = min(100, paid ÷ remBalance × 100)`, mature at 100% or `paid ≥ remBalance`. |
| BR-09 | Profit maturity carried over: `excess = max(0, paid − investment)`; `matureProfit = min(excess, markupAmount)`; `unmatured = markupAmount − mature`. |
| BR-10 | `netBalance = capital + unmaturedProfit − expenses − totalOutstanding`, with capital and expenses from the persisted entries (§5.11). |
| BR-11 | Performance score carried over: `55% × pctCompleted + 30% × capitalRecovery + 15% × min(100, actualMarkupPct)`; green ≥ 75, gold ≥ 45, red below. |

### Lifecycle
| ID | Rule |
|---|---|
| BR-12 | In the same transaction as any payment write or void: if outstanding ≤ 0 set contract `completed`; if a void raises outstanding above 0 on a `completed` contract, set it back to `active`. `cancelled` is manual only. |

---

## 7. API specification (summary)

Base `/api/v1`, JSON, Bearer JWT. Errors follow one envelope: `{statusCode, error, message, fieldErrors?}`. Full contract lives in the generated Swagger doc.

| Method + path | Purpose | Role |
|---|---|---|
| POST `/auth/login` · `/auth/refresh` · `/auth/logout` | Session | public/authed |
| GET `/dashboard` | Aggregate KPI payload | any |
| GET/POST `/customers`, GET/PATCH/DELETE `/customers/{id}` | Customers + nested guarantors | any |
| GET/POST `/products`, GET/PATCH/DELETE `/products/{id}` | Products | any |
| GET/POST `/product-categories`, PATCH/DELETE `/product-categories/{id}` | Category lookup (FR-PRD-07); delete refused with 409 while any product references it | any |
| GET/POST `/contracts`, GET/PATCH/DELETE `/contracts/{id}` | Contracts (server recompute on write) | any |
| GET `/contracts/{id}/invoice` | Invoice payload (+ `?format=pdf` in Phase 2) | any |
| GET `/contracts/{id}/ledger` | Derived recovery ledger | any |
| POST `/contracts/{id}/snapshots`, GET `…/snapshots` | Ledger snapshots | any |
| GET/POST `/payments`, DELETE `/payments/{id}` (void, reason required) | Payments | any |
| GET `/reports/summary` | Portfolio analytics | any |
| GET/POST/DELETE `/reports/scenarios` | Saved simulations | any (own) |
| GET/POST/PATCH/DELETE `/capital-entries`, `/expense-entries` | Portfolio figures | admin |
| GET/POST/PATCH/DELETE `/users` | User management | admin |
| GET `/recycle-bin`, POST `/recycle-bin/{entity}/{id}/restore`, DELETE `…/purge` | Recycle Bin | admin |
| GET `/audit` | Audit log | admin |
| GET/PATCH `/settings` | System settings | admin |
| GET `/files/{uuid}` | Authenticated file serving | any |

All list endpoints support `page`, `pageSize` (default 25, max 100), `sort`, and module-specific filters.

---

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Usability:** the SmartPay identity is carried by the logo palette — navy `#13365E` chrome with sky `#63C7F1` accents (v1's gold is retired from the interface; see FR-INV-01 for print); confirmation dialog before every destructive action; toast feedback after every write; keyboard-friendly forms including the payment flow. |
| NFR-02 | **Localisation:** PKR only, `en-PK` grouping; CNIC/mobile Pakistani formats; dates shown `dd-mm-yyyy`, stored ISO/UTC. |
| NFR-03 | **Printability:** invoice, ledger, and summary print as standalone documents via print stylesheets; server-side PDF in Phase 2. |
| NFR-04 | **Security:** JWT + RBAC per §4.0; Argon2id; rate-limited auth; helmet headers; strict CORS to the web origin; DTO validation on every input; parameterised access via the ORM; uploads magic-byte-checked, UUID-named, auth-served; no secrets in the repo; `NODE_ENV=production` never leaks stack traces. |
| NFR-05 | **Data integrity:** FKs on every relationship; every multi-write business operation in one transaction; unique constraints (CNIC, email, snapshot_no) at DB level; derived balance guarantees ledger/money agreement by construction. |
| NFR-06 | **Auditability:** append-only audit log per §4.11; soft deletes with actor and timestamp. |
| NFR-07 | **Performance:** dashboard in one round trip; every list paginated; indexes on FK columns, `payments.payment_date`, `customers.full_name`, `customers.cnic_number`; summary responsive at ≥ 1,000 contracts; P95 API latency < 300 ms at that volume on a single modest host. |
| NFR-08 | **Reliability & backup:** Dockerised single-host deployment; nightly `pg_dump` retained 30 days; documented restore procedure; app is stateless apart from the file store. |
| NFR-09 | **Testability:** unit tests on the formula package (BR-01..BR-13) and payment/void/status transitions; e2e happy-path tests (login → customer → contract → payment → ledger). CI runs tests + a `migration:show` drift check on every push. |
| NFR-10 | **Browser support:** evergreen browsers; no CDN dependencies at runtime. |
| NFR-11 | **Type safety:** end-to-end TypeScript; API types shared with the frontend (generated from the OpenAPI spec or a shared package). |
| NFR-12 | **Responsive layout:** every screen is usable from 320 px upward, with no horizontal page scrolling at any width. Layout rules per §8.1. |
| NFR-13 | **List-screen consistency:** every register presents, filters, sorts and paginates the same way. Rules per §8.2. |
| NFR-14 | **Interface system:** one set of colour tokens, components and icons across the application. Rules per §8.3. |

### 8.1 Responsive layout (NFR-12)

Two breakpoints carry the whole application: **`sm` at 640 px** and **`lg` at 1024 px**. Anything between them is a tablet tier that must be explicitly accounted for, not left to fall through.

| Width | Navigation | Data-entry forms | List screens | Login |
|---|---|---|---|---|
| < 640 px | Slide-over drawer | Single column | **Cards** | Card, brand mark above |
| 640–1023 px | Slide-over drawer | Two columns | **Cards** | Card, centred |
| 1024–1279 px | Fixed sidebar | Three columns | Table (decorative columns hidden) | Split, brand panel |
| ≥ 1280 px | Fixed sidebar | Three columns | Full table | Split, brand panel |

**Rules**

| ID | Requirement |
|---|---|
| NFR-12.1 | **Lists become cards below `lg`.** A register with more than four columns is unreadable on a phone, so small and medium screens render one card per record instead of a table row: identifying image and name at the top, the key fields beneath, and the row actions in a footer. The card and the table are generated from the same data and share their empty state, so the two cannot drift apart. |
| NFR-12.2 | **No table may require horizontal scrolling at its own breakpoint.** A table's minimum width must fit the space available at the width where it first appears — that is, viewport minus sidebar (240 px) minus page padding (64 px). Where it does not fit, decorative columns (thumbnails) are deferred to `xl` rather than the table being allowed to overflow. |
| NFR-12.3 | **Form fields render at 16 px below `sm`.** Anything smaller makes iOS Safari zoom the viewport on focus. Field sizing is defined once, in a shared style constant, and every form imports it — no screen keeps a private copy. |
| NFR-12.4 | **Primary actions are full width and stacked on phones**, with the confirming action first in reading order; they return to an inline row from `sm` up. Interactive targets are at least 44 px tall on touch widths. |
| NFR-12.5 | **The sidebar collapses to a 64 px icon rail** on `lg` and above, toggled by the user and remembered per browser. The preference is stored in a cookie and read on the server so the rail renders at its stored width on first paint; a client-side read would flash the expanded state on every load. Collapsed, each item exposes its label as a tooltip. Below `lg` the drawer always shows full labels. |
| NFR-12.6 | **Mobile-native affordances** where they cost nothing: telephone numbers are `tel:` links, numeric fields set the numeric input mode, and card padding tightens below `sm` to buy back screen width. |

> **Verification.** Each screen is checked at 320, 375, 768, 1024 and 1280 px. 1024 px is the critical one: it is where the sidebar, the table and the three-column form all appear at once, and it is the width at which layout defects surface first.

### 8.2 List-screen conventions (NFR-13)

Every register — customers, products, contracts, payments, the recycle bin, the
audit log — presents the same way, so staff learn one screen and know them all.
Module 2 is the reference implementation.

| ID | Requirement |
|---|---|
| NFR-13.1 | **Serial column first.** A `Sr #` column numbers rows as displayed: it follows the active sort and filters and continues across pages (page 2 of 25/page starts at 26). It is a position, not a record id, and is never sortable. |
| NFR-13.2 | **Search plus a filter panel.** Free-text search across the register's identifying fields is always visible; the remaining filters live in a collapsible panel that opens automatically when any filter is active and carries a count badge. Dropdown options are read from the data, so they can only offer values that exist. |
| NFR-13.3 | **Sortable columns.** Any column carrying a value worth ordering by is a sort link, showing direction on the active column and exposing `aria-sort`. Clicking the active column flips direction; a new column starts ascending; sorting returns to page 1. Small screens have no headers to click, so the same sort is offered inside the filter panel. |
| NFR-13.4 | **Filters, sort and page live in the URL.** A filtered, sorted view is shareable and survives a reload, and every link on the screen carries the whole state — paging must not drop the filters, and re-sorting must not drop them either. |
| NFR-13.5 | **Sort fields are whitelisted server-side.** The API validates the sort column against a fixed list, so a query string can never name an arbitrary column. Results carry a stable secondary ordering so rows do not shuffle between pages. |
| NFR-13.6 | **Dates read `dd-mm-yyyy`** (NFR-02), formatted against a fixed locale and the business time zone — never the viewer's machine, and never by truncating the stored UTC string, which mis-files anything created after 19:00 local. The exact timestamp is available on hover. |
| NFR-13.7 | **Empty states distinguish "nothing yet" from "nothing matches"**, and the filtered case offers a way back. The card and table renderings share one empty state so they cannot drift. |

### 8.3 Interface system (NFR-14)

The interface is built from a small set of shared pieces rather than repeated
styling. This is what keeps eleven more modules looking like one application.

| ID | Requirement |
|---|---|
| NFR-14.1 | **Colour is addressed by role, never by hue.** Tokens are declared once in `globals.css`: `chrome-900…600` (sidebar, top bar, primary buttons), `background` / `surface` / `surface-muted` / `border` / `foreground` / `muted` (content), `brand` / `brand-soft` / `brand-ink` (accent) and `positive` / `negative` (status). Screens must not carry raw colour values. Re-theming the application is editing those tokens and nothing else. |
| NFR-14.2 | **An accent used as text needs its own darker step.** The identity sky blue measures 1.91:1 on a light card — far below even the 3:1 large-text floor — so `brand-ink` exists for text and the bright sky is reserved for dark surfaces. Every pair in the palette is checked against WCAG AA, and small secondary text is held well above the minimum rather than at it. The logo's slate `#4872B8` is deliberately not a token: it fails at 2.55:1 on navy. |
| NFR-14.3 | **Controls come from a shared component set** in `components/ui/`: `Button` / `ButtonLink` (variants `primary` `secondary` `danger` `ghost`; sizes `sm` `md`; `iconOnly`), `Card` with header, body, field-grid and footer parts, and `Badge`. Adding a variant is one edit; a screen-level override is a signal that a variant is missing. |
| NFR-14.4 | **Icons are inline SVG in one module**, never an icon package or a CDN (NFR-10). Every icon inherits `currentColor` and is sized by the caller. An icon-only control must carry `aria-label` — the glyph is `aria-hidden`, so without one the control has no accessible name. |
| NFR-14.5 | **Destructive actions are confirmed in an application dialog**, never `window.confirm`. The dialog names the record, states where it goes, and its confirming button is styled as destructive. Escape, the backdrop and Cancel all decline. |
| NFR-14.6 | **Every write reports its outcome** in a result dialog: success names what happened, failure carries the API's message. This supersedes the toast wording in FR-CUS-10 and NFR-01 (§2.7 item 6). |
| NFR-14.7 | **Appearance is a three-way user choice** — Light, Dark or System — persisted per browser and resolved **on the server** so the correct palette is present on first paint. A client-side read that flashes the wrong appearance is not acceptable. The sidebar collapses to an icon rail under the same rule. |
| NFR-14.8 | **Motion is guarded.** Dialog and icon animation is disabled under `prefers-reduced-motion: reduce`; the interface must remain fully usable with all animation off. |

> Implementation detail for maintainers lives in `frontendapp/STYLING.md`: the
> token map, which component owns each control, and the recipes for changing
> one. It is the working companion to this section.

---

## 9. Data migration from v1 (MySQL → PostgreSQL)

One-time ETL script, run against a frozen copy of `smartpaysolution`, idempotent and dry-run-capable, producing a written reconciliation report before cutover.

| Step | Rule |
|---|---|
| M-01 | `customers`: map 1:1; split each `g1_*`/`g2_*` block into two `guarantors` rows (`father_name` will be NULL for all legacy rows: v1 never wrote it). Copy CNIC images into the new file store, registering `files` rows. |
| M-02 | `products`: map 1:1 including category. |
| M-03 | `contracts`: `total_amount → sale_price`; `net_amount − down_payment → financed_amount`; regenerate the installment schedule from `start_date` + `plan_months` per BR-04 v2/BR-05. v1's live `remaining_amount` is imported only into the reconciliation report, not into the schema. |
| M-04 | `payments`: map 1:1 (all v1 rows were `completed`); `recorded_by` set to a designated "Migration" system user. |
| M-05 | **Ledger reconciliation:** for every contract, compare (a) v1 `remaining_amount`, (b) financed − payments sum, and (c) the recovery JSON grid totals. Contracts where the three disagree are listed with the deltas for the owner to adjudicate before go-live. Where the recovery grid contains payments absent from the `payments` table, the script can insert them as method `Cash`, note `Imported from v1 recovery ledger`, subject to owner approval per contract. |
| M-06 | `recovery_reports`: import each as a read-only `ledger_snapshots` row with `legacy = true`, preserving `report_no` and the JSON grid for reference. |
| M-07 | Contracts whose derived outstanding is ≤ 0 after import are set `completed`. |
| M-08 | Users: not migrated (v1 rows had no usable passwords). Admin accounts created fresh at deployment. |
| M-09 | Acceptance: post-migration totals (customer count, contract count, payment sum, portfolio outstanding) must match the reconciliation report exactly; sign-off recorded before v1 is decommissioned. |

---

## 10. Delivery phasing

| Phase | Contents |
|---|---|
| **1 (MVP, replaces v1)** | Auth/RBAC, Customers, Products, Contracts + schedule, Invoice (print), Payments, derived Recovery Ledger, Dashboard, Recycle Bin, Audit Log, Settings, migration ETL. |
| **2** | Internal Summary Report with scenarios and persisted capital/expenses, server-side PDF, ledger snapshots archive, Top Performer / Client Profile modals. |
| **3 (optional, previously out of scope)** | SMS/WhatsApp payment reminders driven by the installment schedule; multi-branch; customer-facing statement link. |

---

## 11. Open questions for the product owner

1. M-05 adjudication: when the two v1 ledgers disagree on a contract, which figure wins by default: the payments table (recommended) or the recovery grid?
2. Loyalty tier discounts (BR-07) stay advisory in v2. Confirm, or should Phase 2 auto-apply the reduction to a customer's next contract?
3. Capital/expense granularity: annual entries, monthly entries, or free-form dated entries? (Spec currently allows free-form `period_label`; pick one before Phase 2.)
4. `allow_overpayment` default is **off**. Confirm that matches how the business actually collects.
5. Punctuality thresholds are configurable but default to the v1 bands. Confirm the defaults before grading goes live, since tiers become visible to staff.

---

*Prepared 08-17-2026, amended 08-18-2026 (v2.2). Supersedes SRS 1.0. Traceability: every v1 FR is carried, renumbered with a `-v2` suffix where behaviour changed; every §9 defect in SRS 1.0 maps to a resolution in §2.6 of this document.*
