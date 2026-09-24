# SRS v2.7 amendment: Module 15, Expenses

Amends SRS v2 (`SRS-v2-SmartPay-NextJS-NestJS-PostgreSQL.md`) as consolidated
by the v2.6 investor-capital amendment. Everything not restated here stands.

Read this alongside v2.6: the two interlock at BR-25 (the net balance) and at
BR-21/BR-24 (an investor's payable), and a change to one that ignores the other
will produce a figure that does not tie.

---

## A. Header table

| Field | Value |
| --- | --- |
| Version | 2.7 |
| Supersedes | 2.6 |
| Change | Module 15 (Expenses) added; `expense_entries` removed and its rows carried forward; BR-27 to BR-31 added; BR-25's `expenses` term restated as the whole spend of Module 15; an investor's `payable` restated net of what they carry. |

---

## B. §1.4 Definitions, added

| Term | Meaning |
| --- | --- |
| **Common expense** | Something bought for the business rather than for one deal — a pen, a copy, a laptop, a mouse. Divided equally between the investors in the period it falls in. |
| **Individual expense** | A cost incurred writing one deal: transport, food and charges on a trip out of the city to sign a customer. Belongs whole to the investor whose deal it was. |
| **Expense period** | A named window, with a roster. A common expense belongs to exactly one, and is divided between that period's members — not between whoever happens to be on the investor register today. |
| **Waived share** | A member counted in the division but not billed for their share. The business carries it. |
| **Absorbed** | The part of a pot that no investor is billed for: every waived share, added up. |

---

## C. §2.3 User classes

Module 15 is **admin only**. A common split names every investor and what each
of them owes, which is investor data by any reading of NFR-15. Operators do not
see the register, the report, or the expense figure on the Summary Report.

---

## D. §3 Module inventory, added

| # | Module | Status |
| --- | --- | --- |
| 15 | Expenses | New in 2.7 |

---

## E. §4.8 Module 8: Internal Summary Report, amended

| ID | Requirement |
| --- | --- |
| FR-SUM-02-v2 | **Amended.** Records capital only. The expense list it used to hold is removed; see §9 for why and for what happened to the rows. |
| FR-SUM-12 | The report shows one **Expenses** figure — the whole of Module 15's spend, both kinds — and links to the register and to the matrix. It does not itemise: an expense is charged to somebody, and a total that cannot say to whom is the thing this amendment exists to replace. |

`POST /reports/expenses` and `DELETE /reports/expenses/:id` are **removed**.

---

## F. §4.15 Module 15: Expenses (admin only)

| ID | Requirement |
| --- | --- |
| FR-EXP-01 | Record an expense: kind, date, description, amount, remarks. A **common** expense names a period and no investor; an **individual** one names an investor and no period. The database enforces that pairing with a CHECK constraint, not only the API. |
| FR-EXP-02 | Amount must be greater than zero (CHECK constraint). |
| FR-EXP-03 | An expense is **editable and deletable** (BR-27), unlike an investor ledger line. Delete is soft. |
| FR-EXP-04 | The register lists every expense, filterable by kind, period, investor, date range, and a search across description, remarks, investor name and period label. |
| FR-EXP-05 | Open a period: label, start date, optional end date, note, open/closed. A closed period takes no further expenses. |
| FR-EXP-06 | Set a period's members in one call, each with a waiver flag and, when waived, a reason (BR-29). Partial application is not offered: a split is only meaningful as a set. |
| FR-EXP-07 | A period may be removed only while no expense is filed under it. |
| FR-EXP-08 | The **matrix** (BR-31): investors down the side, common periods across, each investor's own costs and their total. Downloadable as a PDF built from the same data the screen shows. |
| FR-EXP-09 | The matrix reports what investors carry between them (`billed`), what the business absorbed (`absorbed`), and the whole spend (`spent`). |
| FR-EXP-10 | Every write is audited: entity `expense`, `expense_period` or `expense_period_member`. |

---

## G. §5 Data model, added

**`expense_periods`** — `id`, `label VARCHAR(60)`, `starts_on DATE`,
`ends_on DATE NULL`, `closed BOOLEAN`, `note TEXT NULL`, `created_by → users`,
timestamps, `deleted_at`. CHECK `ends_on IS NULL OR ends_on >= starts_on`.

**`expense_period_members`** — `id`, `period_id → expense_periods ON DELETE
CASCADE`, `investor_id → investors ON DELETE RESTRICT`, `waived BOOLEAN`,
`waive_reason TEXT NULL`, `created_at`. UNIQUE `(period_id, investor_id)`.
CHECK `waived = FALSE OR waive_reason IS NOT NULL`.

**`expenses`** — `id`, `kind VARCHAR(12)`, `period_id → expense_periods NULL`,
`investor_id → investors NULL`, `spent_on DATE`, `description VARCHAR(200)`,
`amount NUMERIC(12,2)`, `remarks TEXT NULL`, `entered_by → users`, timestamps,
`deleted_at`. CHECK `amount > 0`. CHECK the kind/column pairing above.
Indexes on `period_id`, `investor_id`, `spent_on`.

**`expense_entries`** — **dropped.** See §9.

The membership table cascades on its period because a member has no meaning
without one. Everything else is `ON DELETE RESTRICT`, per the v2 convention
that a cascade across records people care about is written deliberately or not
at all.

---

## H. §6 Business rules, added

| ID | Rule |
| --- | --- |
| BR-27 | **An expense is a correctable record.** It says what the business spent, not that somebody's money moved, so a typo is fixed by editing it — there is no reversing entry, which is what an investor ledger line requires. Nothing derived from an expense is stored: every share, total and balance is recomputed from the pot and its members on each read, so a correction moves every figure that depends on it at once. |
| BR-28 | **A common expense is divided equally between its period's members.** The division goes through `allocate` (BR-26): each share is rounded to two decimals and the residual assigned to the largest, so the parts sum to the pot exactly. A period exists precisely so that the roster is pinned — a pot raised while six people were in stays divided by those six, whoever is on the register when the report is next opened. |
| BR-29 | **A waived share is absorbed by the business, never redistributed.** The pot is still divided by the **whole** roster, waived members included; the waived shares are simply not billed. Redistributing them would silently reprice everybody else — five people splitting 24,550 would pay 4,910 each instead of the 4,092 they agreed — which is a bill nobody consented to. A waiver requires a recorded reason, enforced by CHECK constraint: an unexplained waiver is an unexplained cost somebody else is carrying. |
| BR-30 | **An individual expense is charged whole to one investor.** No split, no period: the trip was made to write their deal. |
| BR-31 | **An investor's expense charge** is the sum of their shares of every common period plus their own individual costs, and it is **subtracted from their `payable`** (BR-21, BR-24). It does **not** reduce `available`: an expense is a charge to settle at wind-up, not capital consumed, and netting it out of the idle balance would quietly shrink the funding capacity of a deal in progress. An investor cannot be removed (FR-IVT-04) while an expense charge leaves their payable non-zero. |

### BR-25, amended

The `expenses` term in `netBalance = ownCapital + houseUnmaturedProfit −
expenses − houseOutstanding` now reads the whole of Module 15's spend, **both
kinds, waived shares included**. Somebody paid for those too, and the house is
who.

---

## I. Worked scenario (non-normative; the unit tests are built off it)

Six investors — AS, NK, MH, HA, SHR, AB. Two common periods, and HA waived out
of the first because they were closing their position.

| | Common-1 (24,550) | Common-2 (700) | Own | Total |
| --- | --- | --- | --- | --- |
| AS | 4,092 | 117 | 1,350 | **5,558** |
| NK | 4,092 | 117 | 10,780 | **14,988** |
| MH | 4,092 | 117 | 990 | **5,198** |
| HA | waived | 117 | 950 | **1,067** |
| SHR | 4,092 | 117 | 2,750 | **6,958** |
| AB | 4,092 | 117 | 50 | **4,258** |
| **Billed** | 20,458 | 700 | 16,870 | **38,028** |
| **Absorbed** | 4,092 | — | — | **4,092** |

Points the tests pin:

- Common-1 divides by **six**, not by the five who carry it. Each carrying
  member owes 4,091.67 — the figure they would have owed anyway — and HA's
  4,091.67 is absorbed. Dividing by five would produce 4,910 each.
- 24,550 ÷ 6 is 4,091.666…, which no two-decimal figure holds six times over.
  `allocate` gives one share 4,091.65 and five 4,091.67, summing to 24,550
  exactly.
- The billed total is 38,028.33 to the paisa. The hand-kept sheet's own rounded
  rows come to 38,027 against a footer of 38,028; splitting in paisa is what
  removes that disagreement.
- `billed + absorbed` equals the whole spend, always. Nothing is created or
  lost between the pots and the people.

---

## J. §7 API additions

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/expenses` | The register. Query: `kind`, `period_id`, `investor_id`, `from`, `to`, `search`. |
| POST | `/expenses` | Record one. |
| PATCH | `/expenses/:id` | Correct one (BR-27). |
| DELETE | `/expenses/:id` | Soft delete. |
| GET | `/expenses/report` | The matrix (BR-31). |
| GET | `/expenses/periods` | Periods with members and derived shares. |
| POST | `/expenses/periods` | Open one. |
| PATCH | `/expenses/periods/:id` | Rename, re-date, open or close. |
| DELETE | `/expenses/periods/:id` | Only while empty. |
| PUT | `/expenses/periods/:id/members` | Replace the roster wholesale. |

Removed: `POST /reports/expenses`, `DELETE /reports/expenses/:id`.

`GET /reports/summary` no longer returns an `expenses` object; it returns
`expenses_total`, a string.

`GET /investors`, `GET /investors/:id` and the Summary Report's investor block
each gain `expenses_charged`.

---

## K. §9 Migration

`1756400000000-Expenses` creates the three tables, then **carries the old
`expense_entries` rows forward** into a closed period labelled *Carried
forward* with no members — so they are recorded and visible, but charged to
nobody until somebody says who carried them. It then drops `expense_entries`.

`down()` recreates `expense_entries` and copies the common expenses back.
Individual expenses had no home in the old table and are lost on a revert,
which is stated rather than hidden.

The database owner runs this: `npm run migration:run` in `backend/`.

---

## L. Deviations from the request, and why

1. **The waived share is absorbed, not redistributed.** The user's sheet shows
   five columns of 4,092 against a 24,550 pot — a 4,092 gap. Redistributing
   would close that gap and change what five people owe. BR-29 follows the
   sheet.

2. **Expenses reduce `payable`, not `available`.** See BR-31. A charge to
   settle is not capital consumed, and the alternative would silently reduce
   how much an investor can put into a deal that is already being funded.

3. **The Summary Report's figure is the whole spend, not one investor's
   share.** It is the business's own position; per-investor figures live in
   the matrix.

4. **Investors with no expense at all do not appear as rows in the matrix.**
   They have nothing to show, and a page of zeroes reads as a fault. They
   still appear on the register with `expenses_charged` of zero.

---

## M. Build order

1. `backend/src/formulas/expenses.ts` and its unit tests against §I before
   anything else in Module 15 is called done. Every figure in that table is a
   test case, including HA's waiver and the 38,028 the sheet gets a rupee
   wrong.
2. The migration, the entities, the service and the controller.
3. The Summary Report rewiring and the investor `payable` netting — these are
   where a mistake shows up as a balance that does not tie, not as an error.
4. The register, the period roster editor and the matrix.
