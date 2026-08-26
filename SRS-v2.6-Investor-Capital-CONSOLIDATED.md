# SRS v2.6 amendment: Module 13, Investor Capital

**Target document:** SRS v2 (SmartPay Solutions), currently at 2.5
**Prepared:** 08-21-2026
**Replaces:** the 08-21-2026 draft amendment. Paste this one; discard the earlier file.
**Nature:** additive. Nothing built in Modules 2 or 3 changes. Module 4 (Contracts) has not been built and absorbs the funding requirements before it ships.

Each section states where it is inserted or what it replaces.

---

## A. Header table

Add to **Amendments**:

> 2.6 — Module 13 (Investor Capital) added; `cost_price` added to contracts; funding allocation added to contract activation; two-bucket investor ledger (principal and profit) with reinvestment and growth reporting; BR-14 to BR-26 added; BR-10 restated as house-share only.

---

## B. §1.2 Scope

Add to the numbered list:

> 11. Register outside investors, take deposits, deploy that capital against specific contracts, return capital and a contracted share of profit out of actual recovery, and redeploy recovered capital and earned profit into new contracts as a continuous cycle.

Add to the "New in scope versus v1" paragraph: *investor capital, deal funding, and reinvestment*.

Out of scope stays as written, plus: **no investor login, no investor-facing portal in v2.**

---

## C. §1.4 Definitions

Add:

| Term | Meaning |
|---|---|
| **Cost price** | What the business pays for the product. The basis for capital deployed. Distinct from sale price. |
| **Retail margin** | `sale_price − cost_price`. House profit. Never part of investor capital and never part of the profit split. |
| **Investor** | A party who deposits capital for deployment into contracts against a contracted share of profit. |
| **Deposit / Withdrawal** | Cash in from and cash out to an investor. The only hand-entered investor money events. |
| **Deployment** | Capital committed from an investor's available balance to a specific contract at activation. Recorded as a funding row. |
| **Funding share** | An investor's percentage of a contract's cost price, fixed at activation. |
| **Profit share** | The percentage of that contract's markup, on that investor's funded portion, that belongs to the investor. Default 50%. Fixed at activation. |
| **Principal bucket** | An investor's original money: deposits, less withdrawals taken from principal, less losses charged to principal. |
| **Profit bucket** | An investor's earnings: matured profit, less profit withdrawn, less losses charged to profit. Redeployable like principal. |
| **Available balance** | Principal bucket plus profit bucket, less whatever is currently deployed. What can be withdrawn or redeployed today. Derived, never stored. |
| **Capital recovered** | The portion of an investor's pro-rata slice of a contract's recovery that repays their funded amount. Derived. |
| **Matured profit** | Profit share actually earned, meaning it exists only after that investor's capital on that contract is fully recovered. Derived. |
| **Cycle** | One deployment and full recovery of capital. An investor's money completes many cycles over its life. |
| **Capital turnover** | Total capital ever deployed divided by net principal. How many times the same rupee has been put to work. |

---

## D. §2.3 User classes

Replace the `operator` row and add the note beneath the table:

> **operator:** Customers, products, contracts, payments, invoices, recovery ledger, summary report (read), own profile. **No access to investor records, funding allocations, cost price, or any investor figure.**

> Investor data is admin-only. Operators receive no navigation entry, and the API omits investor and cost-price fields from every response served to an operator rather than relying on the frontend to hide them (NFR-15).

---

## E. §3 Module inventory

Add a row:

| # | Module | Frontend route | API prefix | State |
|---|---|---|---|---|
| 13 | Investor Capital | `/investors` | `/api/v1/investors` | New |

---

## F. §4.4 Module 4: Contracts, amendments and additions

**FR-CON-03-v2 is amended.** Add `cost_price`:

| ID | Requirement |
|---|---|
| FR-CON-03-v2 (amended) | Create a contract capturing: customer, product, **cost price** (what the business paid, required, > 0, `≤ sale_price`), **sale price**, markup % (dropdown) or direct markup amount override, down payment, plan months (1-20, default 8, range configurable), product condition (`New`/`Used`), start date. Where `cost_price < sale_price` the difference is **retail margin**, recognised as house profit, excluded from investor capital and from the profit split (BR-17). Status starts `active`. |

New requirements:

| ID | Requirement |
|---|---|
| FR-CON-11 | The contract form carries a **funding panel**. Capital required equals `cost_price`. The panel proposes an allocation across all `active` investors pro-rata to available balance (setting `auto_allocate_funding`, default on), each line manually overridable, and any unallocated remainder explicitly labelled **house-funded**. Each line shows the investor's available balance broken into principal and profit, and which buckets the deployment will draw from per BR-22. |
| FR-CON-12 | Each funding line carries a **profit share %**, defaulted from the investor record and **overridable per deal** by an admin with a reason. The value is stored on the funding row, not read live from the investor, so changing an investor's standing rate never restates a deal that has already been funded. |
| FR-CON-13 | Activation is rejected (409) when any funding line exceeds that investor's available balance, when the sum of funding lines exceeds `cost_price`, when a funding line names an `inactive` investor, or when a per-deal profit share falls outside 0 to 100. A contract may be activated fully house-funded; it may not be activated with a funding line the ledger cannot support. |
| FR-CON-14 | Funding rows, including the bucket split and the profit share snapshot, are written in the **same transaction** as contract activation. A failed funding write aborts the contract. |
| FR-CON-15 | **Funding shares and profit shares lock at activation.** No transfers between investors, no re-allocation, no partial exits, no rate changes. Where FR-CON-07-v2 still permits a financial-term edit (zero non-voided payments) and `cost_price` changes, the funding rows are reversed and rewritten in one transaction, and the change is audit-logged with before/after allocations. |
| FR-CON-16 | Soft-deleting or cancelling a funded contract is admin-only and requires loss settlement per BR-20 in the same transaction. The delete confirmation names the investors affected and the unrecovered amount per investor. |
| FR-CON-17 | The contract detail screen shows the funding table to admins only: investor, amount, share %, profit share %, capital recovered, capital outstanding, profit matured, profit unmatured. |

---

## G. §4.6 Module 6: Payment Collection, additions

| ID | Requirement |
|---|---|
| FR-PAY-11 | A payment write or void creates **no investor rows**. Every investor figure derives from `contract_fundings` and the payments table per BR-18 and BR-21, so an investor statement cannot disagree with the money for the same structural reason the contract balance cannot. Voiding a payment reduces capital recovered and may un-mature profit, automatically. |
| FR-PAY-12 | Where a void would drop an investor's available balance below zero because recovered capital had already been redeployed, the API returns 409 naming the contracts that consumed it, unless `allow_investor_overdraw` is on. |
| FR-PAY-13 | The payment confirmation dialog reports, for admins, how much capital and profit the payment released to each funding investor, so the person collecting can see the reinvestment pool grow. |

---

## H. §4.7 Module 7: Recovery Ledger, addition

| ID | Requirement |
|---|---|
| FR-REC-10 | An admin-only **Funding** panel on the contract ledger, running off the same FIFO rows: per investor, funded amount, bucket split, profit share %, capital recovered, capital outstanding, profit entitlement, profit matured, profit unmatured. Excluded from the operator API response and from the customer-facing snapshot (FR-REC-08). |

---

## I. §4.8 Module 8: Internal Summary Report, additions

| ID | Requirement |
|---|---|
| FR-SUM-10 | **Investor capital is never a `capital_entries` row.** Capital entries carry a `source` of `own` only. Investor money lives exclusively in the investor ledger. This is what stops BR-10 counting borrowed money as owner equity. |
| FR-SUM-11 | The portfolio block reports house figures per BR-25 (`houseOutstanding`, `houseUnmaturedProfit`, `netBalance`) alongside an **Investor position** block: total deposited, principal in play, profit in play, currently deployed, idle, capital recovered lifetime, profit matured lifetime, withdrawn, total payable. |
| FR-SUM-12 | Simulation mode (FR-SUM-04-v2) may not alter funding shares, profit shares, or investor figures. A scenario stores house-side simulated rows only; the investor block renders actual figures with a "not simulated" marker. |

---

## J. §4.1 Module 1: Dashboard, addition

| ID | Requirement |
|---|---|
| FR-DSH-13 | Admin-only tiles: capital deployed, investor capital idle (available and undeployed), profit matured this month, total payable to investors. Hidden and omitted from the API payload for operators. *(Phase 2.)* |

---

## K. §4.13 Module 13: Investor Capital (admin only)

Prefix `FR-IVT` (`FR-INV` belongs to Module 5).

### K.1 Register and records

| ID | Requirement |
|---|---|
| FR-IVT-01 | Paginated investor register per NFR-13, search on name, CNIC and mobile. Columns: investor, status, profit share %, net principal, profit earned, deployed, idle, payable. |
| FR-IVT-02 | Create/edit an investor: full name, father/husband name, CNIC (unique among live rows, formatted and validated as FR-CUS-02), mobile, address, email (optional), **profit share %** (`NUMERIC(5,2)`, 0 to 100, **default 50.00**, set from `default_profit_share_pct`), **loss participation** (boolean, default true), agreement date, status `active`/`inactive`, notes. |
| FR-IVT-03 | Changing an investor's profit share % affects **future deployments only**. Contracts already funded keep the rate stored on their funding row (FR-CON-12). The edit screen states this plainly and the change is audit-logged. |
| FR-IVT-04 | An `inactive` investor accepts no new deployments; existing fundings continue to recover normally. Soft delete is blocked (409) while any funded contract has capital outstanding or the available balance is non-zero. |

### K.2 Money movement

| ID | Requirement |
|---|---|
| FR-IVT-05 | Record a **Deposit**: amount > 0, date not in the future, method (`Cash`/`Bank Transfer`/`Cheque`), reference, note. Credits the **principal bucket**. |
| FR-IVT-06 | Record a **Withdrawal**: same fields, plus the bucket it draws from, defaulted per setting `withdrawal_source` (default `profit_first`, so principal stays intact unless the investor asks for it). Rejected with the exact overage stated when it exceeds available balance, unless `allow_investor_overdraw` is on and an admin confirms. |
| FR-IVT-07 | Only **Deposit**, **Withdrawal** and **Adjustment** are hand-entered. Deployment, capital recovery, profit and loss lines are derived or system-generated and cannot be typed, edited or deleted. |
| FR-IVT-08 | A mis-entered Deposit or Withdrawal is corrected by a **reversing Adjustment with a reason**, never by editing or deleting the original. Adjustments are admin-only, name their bucket, and are audit-logged. |

### K.3 Position and reinvestment

| ID | Requirement |
|---|---|
| FR-IVT-09 | Investor detail screen KPI strip, in three rows. **Principal:** deposited, withdrawn, losses, net principal, deployed, idle. **Profit:** matured lifetime, unmatured, withdrawn, deployed, idle, **reinvested capital**. **Position:** available, deployed, payable, capital turnover, **cumulative growth %** (BR-24a), cycles completed. Cumulative growth is the headline figure on this screen, stated as a percentage against net principal with the first deposit date beneath it. |
| FR-IVT-10 | A **Redeploy** action on the investor screen opens contract creation with that investor pre-selected on the funding panel and the available amount pre-filled. Available balance is redeployable **the moment it exists**, including the capital freed by a single monthly installment; there is no waiting for a contract to finish. |
| FR-IVT-11 | A **Cycles** table per investor: one row per funded contract with deploy date, amount, bucket split, **reinvested badge** where `funded_from_profit > 0`, profit share %, capital recovered, profit matured, **cycle growth %** (BR-24a), status (`running`, `recovered`, `closed`, `written off`), and days to full capital recovery. Sortable, and the source of the turnover and growth figures. |
| FR-IVT-12 | **Statement** for a date range: opening balance by bucket, every line per §K.4, closing balance by bucket, deals funded, profit position. Print stylesheet and image export per FR-REC-07, and an immutable timestamped snapshot per the FR-REC-08 pattern stored as `ledger_snapshots` with `kind = investor`. *(Phase 2.)* |

### K.4 Statement composition

The statement is a **derived union**, ordered by date, of:

1. Stored `investor_transactions` rows: Deposit, Withdrawal, Adjustment, Loss.
2. Derived **Deployment** lines, one per `contract_fundings` row, dated the contract start date, showing the principal and profit portions.
3. Derived **Capital recovery** and **Profit** lines, one per underlying payment, plus one for the down payment dated the contract start date, split per BR-18.

Nothing in group 2 or 3 is stored. That is the guarantee that the statement and the payments table agree by construction (NFR-05).

### K.5 Portfolio reporting

| ID | Requirement |
|---|---|
| FR-IVT-13 | `GET /reports/investor-summary`, admin-only, returning the whole flow in one payload: per investor and in total, deposited, withdrawn, net principal, profit matured lifetime, profit withdrawn, deployed now, idle now, payable, capital turnover, return on net principal, active cycles, completed cycles, losses. |
| FR-IVT-14 | The same report carries a **house column**: house-funded capital, house profit from markup, retail margin, and total business profit, so the split between what the business earned on its own money and what it earned on investor money is visible on one screen. |
| FR-IVT-15 | A **flow strip** at the top of the report: money in (deposits) → deployed → recovered → profit earned → redeployed → withdrawn, each with a running total for the selected period. |
| FR-IVT-16 | Every investor route enforces `admin` at the API guard. An operator token receives 403, not a filtered payload. |
| FR-IVT-17 | Every investor write is audit-logged per FR-AUD-01 with actor, before/after, and the affected contract where applicable. |

---

## L. §4.12 System Settings, additions to FR-SET-01

Add these editable settings:

| Setting | Default | Effect |
|---|---|---|
| `default_profit_share_pct` | `50.00` | Seeds the profit share on a new investor record. |
| `auto_allocate_funding` | on | Funding panel proposes a pro-rata split across active investors. |
| `deployment_source` | `profit_first` | Which bucket a partial deployment draws from (BR-22). |
| `withdrawal_source` | `profit_first` | Which bucket a withdrawal draws from. |
| `allow_investor_overdraw` | off | Permits deployment or withdrawal beyond available balance behind an admin confirmation. |

---

## M. §5 Data model

### 5.7 `contracts` (amended)
Add `cost_price NUMERIC(12,2) NOT NULL`. Constraint: `cost_price > 0 AND cost_price <= sale_price`.

### 5.11 `capital_entries` (amended)
Add `source` (`own`), constrained to `own` in v2. Present so a future source cannot appear without a migration and a decision.

### 5.16 `investors` *(new)*
`full_name` (indexed), `father_husband_name`, `cnic_number` (unique partial index where `deleted_at IS NULL`), `mobile_number`, `address`, `email NULL`, `profit_share_pct NUMERIC(5,2) NOT NULL DEFAULT 50.00`, `loss_participation boolean NOT NULL DEFAULT true`, `agreement_date date`, `status` (`active`|`inactive`), `notes`.

### 5.17 `investor_transactions` *(new)*
`investor_id FK`, `type` (`Deposit`|`Withdrawal`|`Adjustment`|`Loss`), `bucket` (`principal`|`profit`), `amount NUMERIC(12,2)`, `txn_date date` (indexed), `method` (`Cash`|`Bank Transfer`|`Cheque`, NULL for Adjustment and Loss), `reference NULL`, `contract_id FK NULL` (set on Loss), `reason NULL` (required on Adjustment and Loss), `entered_by FK users`. **Append-only:** no `deleted_at`, no update path through the application. A Withdrawal or Loss spanning both buckets is written as two rows.

### 5.18 `contract_fundings` *(new)*
`contract_id FK`, `investor_id FK`, `amount NUMERIC(12,2)`, `share_pct NUMERIC(5,2)`, `profit_share_pct NUMERIC(5,2)` (snapshot at activation), `funded_from_principal NUMERIC(12,2)`, `funded_from_profit NUMERIC(12,2)`, `share_override_reason NULL`, `funded_at timestamptz`, `created_by FK users`. Unique on `(contract_id, investor_id)`. Constraints: `funded_from_principal + funded_from_profit = amount`; `SUM(amount) per contract <= contracts.cost_price`, enforced in the service inside the activation transaction.

### 5.10 `ledger_snapshots` (amended)
Add `kind` (`recovery`|`investor`, default `recovery`) and `investor_id FK NULL`. Exactly one of `contract_id` and `investor_id` is set.

### 5.15 Relationships (amended)
```
investors 1 ──< investor_transactions   (deposits, withdrawals, adjustments, losses)
investors 1 ──< contract_fundings >── 1 contracts
contracts 1 ──< payments                (still the single source of truth for recovery)
investors 1 ──< ledger_snapshots        (kind = investor)
```

---

## N. §6 Business rules

| ID | Rule |
|---|---|
| BR-14 | **Capital required** on a contract is `cost_price`. `retailMargin = sale_price − cost_price`, house profit, never shared. `houseFunded = cost_price − Σ contract_fundings.amount`. |
| BR-15 | **Funding share:** `share_pct_i = funding_amount_i ÷ cost_price × 100`, computed and fixed at activation. `Σ share_pct ≤ 100`. |
| BR-16 | **Profit share** is the value on the funding row, seeded from `investors.profit_share_pct` (default 50) and overridable per deal by an admin with a reason. It is immutable once written. Two investors on one contract may hold different profit shares. |
| BR-17 | **Profit entitlement.** `entitlement_i = markup_amount × share_pct_i × profit_share_pct_i`. The house keeps `markup_amount − Σ entitlement_i`, plus the whole of `retailMargin`. |
| BR-18 | **Recovery split.** A contract's recovery stream is `recovered = down_payment + Σ non-voided payments`, with the down payment dated `start_date`. It is **not** a payment row and does not enter the contract balance (which stays `financed_amount − Σ payments`); it enters the investor stream only. Per investor: `slice_i = recovered × share_pct_i`; `capitalRecovered_i = min(slice_i, funding_amount_i)`; `surplus_i = max(0, slice_i − funding_amount_i)`; `maturedProfit_i = min(surplus_i, entitlement_i)`; `unmaturedProfit_i = entitlement_i − maturedProfit_i`. **Capital is always repaid before any profit exists.** Any surplus above entitlement belongs to the house. |
| BR-19 | **Recovery returns to the bucket it came from.** `capitalRecovered_i` credits principal and profit in the same ratio as `funded_from_principal : funded_from_profit` on that funding row. `maturedProfit_i` always credits the profit bucket. |
| BR-20 | **Loss allocation.** On `cancelled` with `write_off = true`, or on purge of a funded contract, `unrecovered_i = funding_amount_i − capitalRecovered_i`. Where `loss_participation` is true, `Loss` rows are written in the same transaction, charged to the buckets in the same ratio as the funding source. Where it is false, the house absorbs it and an `Adjustment` crediting `unrecovered_i` is written instead. Both require an admin, a reason, and an audit row. Unmatured profit on that contract is extinguished, not paid. |
| BR-21 | **Bucket balances, derived, never stored.**<br>`principalAvailable = Σ Deposits − Σ Withdrawals(principal) ± Σ Adjustments(principal) − Σ Losses(principal) − Σ funded_from_principal + Σ capitalRecoveredToPrincipal`<br>`profitAvailable = Σ maturedProfit − Σ Withdrawals(profit) ± Σ Adjustments(profit) − Σ Losses(profit) − Σ funded_from_profit + Σ capitalRecoveredToProfit`<br>`available = principalAvailable + profitAvailable`<br>`deployed = Σ (funding_amount_i − capitalRecovered_i)` over running contracts<br>`payable = available + deployed` |
| BR-22 | **Deployment source.** A deployment smaller than the available balance draws per `deployment_source`: `profit_first` (default, keeps original principal liquid), `principal_first`, or `pro_rata`. A deployment equal to the full balance draws from both regardless. The split is stored on the funding row and is what BR-19 reverses on recovery. |
| BR-23 | **Reinvestment is not a special operation.** It is a deployment funded from an available balance that happens to contain recovered capital and matured profit. No separate entity, no separate screen, no transfer step. This is what makes the cycle continuous: capital freed by one installment can fund a new contract the same day. |
| BR-24 | **Lifetime metrics.** `netPrincipal = Σ Deposits − Σ Withdrawals(principal) ± Σ Adjustments(principal) − Σ Losses(principal)`. `lifetimeProfit = Σ maturedProfit`. `returnOnPrincipal = lifetimeProfit ÷ netPrincipal × 100`. `capitalTurnover = Σ funding_amount ÷ netPrincipal`. `cyclesCompleted` counts funded contracts whose capital is fully recovered. Turnover and return are reported unannualised, with the first deposit date shown alongside so the period is never implied. |
| BR-24a | **Growth.** `cycleGrowth_f = maturedProfit_f ÷ funding_amount_f × 100`, the percentage that one deployment returned. `cumulativeGrowth = (payable − netPrincipal) ÷ netPrincipal × 100`, the percentage the investor's original money has grown to date, whether that growth is idle, deployed, or still maturing. A deployment is flagged **reinvested** where `funded_from_profit > 0`, and `reinvestedCapital = Σ funded_from_profit`. Where `netPrincipal` is zero the growth figures render as "n/a", never as a division error. |
| BR-25 | **Replaces BR-10.** House figures net out investor participation: `houseShare_c = 1 − Σ share_pct(c)`; `houseOutstanding = Σ (contractOutstanding_c × houseShare_c)`; `houseUnmaturedProfit = Σ (markup_amount_c − Σ entitlement_i,c) × unmaturedFraction_c + Σ unmaturedRetailMargin_c`; `netBalance = ownCapital + houseUnmaturedProfit − expenses − houseOutstanding`. `ownCapital` is `capital_entries` where `source = 'own'`. Investor deposits never appear in this formula. |
| BR-26 | **Rounding of a split.** Every pro-rata split (recovery slices per BR-18, entitlements per BR-17, loss allocation per BR-20, bucket credits per BR-19) rounds each investor's share to two decimals and assigns the residual to the **largest share** on that contract, so the parts always sum to the whole exactly. Where the house holds a share, the residual goes to the house instead. This is the same principle as BR-04-v2: computed once in the shared formula package, unit-tested, and never allowed to drift a paisa a month into an unexplainable balance. |

---

## O. Worked scenario (non-normative, but build the unit tests off it)

**Setup.** Investor A deposits **Rs. 500,000** on 01-01-2027. Profit share 50%, loss participation on.
Principal bucket 500,000. Profit bucket 0. Available 500,000.

**Cycle 1.** Contract C-001, activated 01-05-2027.
Cost price 500,000, sale price 500,000, markup 20% = **Rs. 100,000**, net 600,000, down payment 100,000, financed 500,000, **10 months**, installment Rs. 50,000.
Funded 100% by A: `amount 500,000`, `share_pct 100`, `profit_share_pct 50`, `funded_from_principal 500,000`, `funded_from_profit 0`.
`entitlement = 100,000 × 1.00 × 0.50 = Rs. 50,000`.
Available drops to 0. Payable stays 500,000.

| Event | Recovered to date | Capital recovered | Matured profit | Principal idle | Profit idle | Available |
|---|---|---|---|---|---|---|
| Down payment 100,000 | 100,000 | 100,000 | 0 | 100,000 | 0 | 100,000 |
| Installment 1 | 150,000 | 150,000 | 0 | 150,000 | 0 | 150,000 |
| Installment 4 | 300,000 | 300,000 | 0 | 300,000 | 0 | 300,000 |
| Installment 8 | 500,000 | 500,000 | 0 | 500,000 | 0 | 500,000 |
| Installment 9 | 550,000 | 500,000 | 50,000 | 500,000 | 50,000 | 550,000 |
| Installment 10 | 600,000 | 500,000 | 50,000 (capped) | 500,000 | 50,000 | **550,000** |

Note two things the table makes obvious. Capital comes back **before** any profit, so A's exposure falls every month. And the final Rs. 50,000 of the markup goes to the house, because A's entitlement capped at 50,000.

**Cycle 2, the reinvestment.** On 01-03-2028 A redeploys the whole **Rs. 550,000** into contract C-002 at the same terms.
Funding row: `amount 550,000`, `funded_from_principal 500,000`, `funded_from_profit 50,000`, `profit_share_pct 50`.
Markup 20% = 110,000, entitlement = **Rs. 55,000**.
At full recovery: capital 550,000 returns, split back 500,000 to principal and 50,000 to profit per BR-19, plus 55,000 new matured profit to the profit bucket.

**Position after two cycles:** principal 500,000, profit 105,000, available **Rs. 605,000**, payable 605,000.
`netPrincipal 500,000`, `lifetimeProfit 105,000`, `returnOnPrincipal 21%`, `capitalTurnover 2.1x`, `cyclesCompleted 2`.

**Partial redeployment.** A does not have to wait for C-001 to close. At installment 4 there is Rs. 300,000 idle, and it can fund a second contract that day. Both contracts then recover in parallel and both feed the same buckets. That is the normal operating pattern, and the funding panel is built to make it a two-minute action.

**A different rate.** Investor B at 40% funding the same C-001 alongside A would carry `share_pct` and `profit_share_pct 40` on their own funding row. A's entitlement never moves because the rate lives on the row, not on the investor.

---

## P. §7 API additions

| Method + path | Purpose | Role |
|---|---|---|
| GET/POST `/investors`, GET/PATCH/DELETE `/investors/{id}` | Investor register | admin |
| GET/POST `/investors/{id}/transactions` | Deposits, withdrawals, adjustments (POST only; no PATCH, no DELETE) | admin |
| GET `/investors/{id}/position` | Bucket balances, deployed, payable, lifetime metrics (BR-21, BR-24) | admin |
| GET `/investors/{id}/cycles` | Per-contract cycle table (FR-IVT-11) | admin |
| GET `/investors/{id}/statement?from=&to=` | Derived statement per §K.4 | admin |
| POST `/investors/{id}/statement/snapshots`, GET `…/snapshots` | Statement archive (Phase 2) | admin |
| GET `/contracts/{id}/funding` | Funding table for a contract | admin |
| POST `/contracts/{id}/funding` | Allocate at activation only; 409 once locked | admin |
| GET `/reports/investor-summary` | Whole-portfolio investor flow (FR-IVT-13 to 15) | admin |

`GET /contracts/{id}/ledger` gains a `funding` block, present only for admin tokens.

---

## Q. §8 NFR addition

| ID | Requirement |
|---|---|
| NFR-15 | **Investor confidentiality.** Investor identities, funding allocations, profit shares, cost price and all investor figures are served only to `admin` tokens, filtered at the API before serialisation rather than hidden in the frontend. Customer-facing artefacts (invoice per Module 5, recovery snapshot per FR-REC-08) never contain cost price, funding, or investor data. |

---

## R. §9 Migration addition

| Step | Rule |
|---|---|
| M-10 | v1 holds no investor data. Every migrated contract gets `cost_price = sale_price` and is recorded **100% house-funded**, with a reconciliation line noting the assumption. Any existing investor arrangement is entered by hand after cutover as a dated opening `Deposit` to the principal bucket, plus an `Adjustment` carrying the historical profit position, with the source document referenced in the note. No funding row is backdated onto a migrated contract without the owner signing the allocation. |

---

## S. §10 Phasing

| Phase | Investor content |
|---|---|
| **1** | `investors`, `investor_transactions`, `contract_fundings`, `contracts.cost_price`, the settings block. Investor CRUD, deposits and withdrawals, the funding panel at contract activation with the per-deal profit share, derived bucket balances, the cycles table, the Redeploy action, loss handling. BR-14 to BR-25. Ships with Module 4 because funding attaches at activation and cannot be retrofitted without hand-allocating every live contract. |
| **2** | Investor statement and snapshots, `/reports/investor-summary` with the flow strip and house column, the summary report's investor block (FR-SUM-11), dashboard tiles (FR-DSH-13). |
| **3** | Investor read-only login. Out of scope in v2. |

---

## T. §11 Open questions, added

6. **BR-08 basis.** The summary's `investment` column still reads `sale_price − down_payment` (carried from v1), while investor capital reads `cost_price`. Unify on cost basis in Phase 2, accepting that reported mature profit shifts, or keep both with a second `capitalDeployed` column? Recommendation: add the column now, unify in Phase 2 with a documented restatement.
7. **Idle capital.** An investor earns nothing on deposited but undeployed money under this spec. Confirm, because it decides whether you are obliged to deploy fast or merely want to.
8. **Withdrawal notice.** Can an investor withdraw available balance on demand, or is there a notice period? The spec allows on demand. If there is a lock-in, it is a field on the investor record and a guard on FR-IVT-06.
9. **Profit share basis.** The 50% is taken on **markup only**, with retail margin kept whole by the house. Moot where `cost_price = sale_price` on every contract, which is the assumed operating pattern. Confirm.

**Deferred by scope decision (08-21-2026).** Not specified in v2.6. Each is a real operating situation the system currently has no place to record, listed so the gap is a decision rather than a surprise.

10. **Stock bought ahead of a contract.** Funding attaches at contract activation. Investor money spent on inventory that has no signed customer yet reads as idle in the ledger. Requires a purchase record between deposit and contract to fix.
11. **Early settlement discount.** Entitlement freezes off `markup_amount` at activation. A customer paying off at month 4 for less than the full markup has nowhere to record the reduction and no rule for who absorbs it.
12. **Repossession and resale.** BR-20 writes the full unrecovered amount off as a loss. Proceeds from reselling the recovered product are not a payment row and cannot currently credit the investor back.

---

## U. Build order

1. Migration: `contracts.cost_price`, `investors`, `investor_transactions`, `contract_fundings`, `capital_entries.source`, the new settings keys.
2. Investor CRUD, deposits and withdrawals, derived bucket balances. Balances must exist before anything can draw on them.
3. Module 4 Contracts, with the funding panel inside the activation transaction from day one.
4. Module 6 Payments, behaviour unchanged, with derived investor figures reading off it.
5. Unit tests on §O before anything else in Module 13 is called done. Every number in that scenario is a test case, including the capped entitlement at installment 10 and the bucket split on the cycle 2 recovery.

Building Module 4 without step 1 means every contract created in the gap needs a hand-entered funding row later, and the audit trail will show allocations dated after the money moved.
