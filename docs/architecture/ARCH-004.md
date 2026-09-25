# ARCH-004 — Transaction Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-004
**Verified by:** TEST-004

## Summary

CRUD, batch-import, and month/account filtering for transactions (`transactions` table) —
including how a `transfer`-type transaction between two of the user's own accounts is excluded
from income/expense totals but still reflected as a balance change on the target account. See
`docs/architecture/ARC42.md` §5.4 (Database) and §6.3 (PDF Import) for context; batch import is
also used by the PDF/Paperless import flows (REQ-005/REQ-016, out of scope here).

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `transactionsRouter` | `server/routes/transactions.ts` | `GET/POST/PATCH/PUT/DELETE /api/transactions`, `POST /api/transactions/batch` |
| `insertTransactionSchema` | `shared/schema.ts` | Zod validation: `type` (`transactionTypeSchema` — `income \| expense \| transfer`), `amount` (positive), `month` pattern-checked separately |
| `monthSchema` | `server/routes/transactions.ts` | `^\d{4}-\d{2}$` — validates the `month` **query** parameter on `GET` (AC-004-10 covers the request-body `month` via `insertTransactionSchema`; this covers the read-path filter) |
| `batchRateLimiter` | `server/routes/transactions.ts` | 20 requests / 15 min per IP on `/batch` (ARC42 §8.1, "Rate Limiting on Batch Endpoints") |
| transaction storage functions | `server/storage.ts` | `getTransactions(month?, accountId?)`, `createTransaction`, `createTransactions` (batch), `updateTransaction`, `deleteTransaction` |
| transfer aggregation | `server/routes/summary.ts` (`buildAccountSummaries`) | Computes `transfersIn`/`transfersOut` per account for `GET /api/summary/:month` |

**Endpoints**

| Endpoint | AC | Behavior |
|---|---|---|
| `GET /api/transactions?month=&accountId=` | AC-004-01, AC-004-02, AC-004-03 | `month` validated against `monthSchema` if present (`400` on mismatch); `accountId` parsed as int (`400` if `NaN`); both filters optional and combinable |
| `POST /api/transactions` | AC-004-04, AC-004-05, AC-004-09, AC-004-10 | `insertTransactionSchema.safeParse`; rejects negative `amount`, invalid `type`, malformed `month` — all as `400` with the flattened Zod error |
| `POST /api/transactions/batch` | (REQ-004 Notes — used by PDF import, REQ-005) | Accepts a raw JSON array (`400` if not an array, `400` if `>500` items); each item validated independently — valid ones are saved via `storage.createTransactions`, invalid ones are reported per-index in `errors`, never fail the whole batch |
| `PATCH /api/transactions/:id` | AC-004-07 | Partial update (`insertTransactionSchema.partial()`) — used by the edit-category flow |
| `PUT /api/transactions/:id` | (full replace, no dedicated AC — same validation as `POST`) | Full replace, same schema as create |
| `DELETE /api/transactions/:id` | AC-004-08 | Deletes the row |

**Transfer target-account selection (AC-004-05, AC-004-06)**

`transferToAccountId` is part of `insertTransactionSchema` (nullable/optional at the schema level)
but the *client* renders the "target account" selector only when `type === "transfer"` and
requires a selection before submit (AC-004-06's validation is enforced client-side; the server
schema does not reject a `transfer` row with `transferToAccountId` unset — see Open Questions).

**Transfer accounting (AC-004-11, AC-004-12, AC-004-13)**

`buildAccountSummaries` in `server/routes/summary.ts` (not `transactions.ts` itself) is where
transfer semantics actually happen:

1. A `type: "transfer"` row is **excluded** from `totalIncome`/`totalExpenses` on the *source*
   account (`continue` before the income/expense branch) — it never appears as an expense on the
   source account's summary (AC-004-11: "the displayed balance of Girokonto is 0 €").
2. Its `Math.abs(amount)` is added to the source account's `transfersOut[transferToAccountId]`.
3. **Netting pass (AC-004-13):** after all transactions are aggregated, every account pair is
   checked for opposing `transfersOut` entries (A→B and B→A both present). The smaller of the two
   is subtracted from both, leaving only the net amount on the side that transferred more; the
   losing side's entry is deleted entirely if it nets to zero. This runs once per unordered pair
   (each pair is only netted from one direction) before the `transfersIn` pass, so `transfersIn`
   is always computed from already-netted `transfersOut` data.
4. A final pass copies every account's (now netted) `transfersOut` entries into the *target*
   account's `transfersIn` total — so multiple transfers from the same or different source
   accounts to one target are summed (AC-004-12).

Netting exists because the Sankey diagram (REQ-009, ARCH-009) lays out account nodes with
`d3-sankey`, which requires a directed acyclic graph. Two accounts that both hold a `transfer` to
each other in the same month (a routine sweep between a checking and a savings account, e.g. two
opposing `transfersOut` entries between the same account pair) form a 2-node cycle that the layout
algorithm cannot lay out and throws on (see ARCH-009 Open Questions, previously reported as the
Dashboard going blank). Netting at the aggregation layer removes the cycle at its source instead
of teaching the chart to special-case it, and also better reflects reality: two transfers of 1000€
and 700€ in opposite directions between the same accounts are, net, a single 300€ movement.

## Key Decisions

- **`amount` always positive, `type` carries the sign** (project-wide invariant, `architecture.md`)
  — a transfer's `Math.abs(amount)` guards against a negative amount slipping through into the
  transfer aggregation even though `insertTransactionSchema` already rejects negative amounts at
  the API boundary (defense in depth, not redundant: `storage.createTransactions` in the batch path
  writes pre-validated Zod output, but the aggregation code in `summary.ts` doesn't re-trust that
  invariant blindly).
- **Batch endpoint never fails the whole request on a partial validation failure** — matches the
  PDF-import use case (REQ-005), where one malformed line in a multi-hundred-line statement
  shouldn't block importing the rest; skipped rows are reported with their index and Zod error so
  the user can see what was skipped and why.
- **`PATCH` and `PUT` share the same underlying `storage.updateTransaction`** — `PATCH` uses a
  `.partial()` schema (only supplied fields overwrite), `PUT` uses the full schema; both exist
  because the UI's category-edit flow only wants to touch `categoryId` (`PATCH`), while a full
  edit form submits the whole record (`PUT`).
- **Netting only handles the 2-account reciprocal case, not general N-account cycles** (YAGNI) —
  a longer cycle (A→B→C→A across three accounts) is not netted and could in principle still throw
  in the Sankey layout. Given FinanzFlow's target audience (one household, few accounts, REQ-009's
  Notes), the reciprocal two-account case covers the reported and realistic scenario; a general
  cycle-detection/breaking algorithm was judged unnecessary complexity for a case that hasn't
  occurred. AC-009-08's chart-level error boundary is the safety net for the remaining, unhandled
  cycle shapes.

## Out of Scope

- Account and category CRUD — [ARCH-002](ARCH-002.md), [ARCH-003](ARCH-003.md).
- Client-side account visibility filtering of the summary response — [ARCH-008](ARCH-008.md).
- PDF/Paperless import producing the batch payload — REQ-005/REQ-016, not part of this session.

## Open Questions

- 🔴 **AC-004-09 ("amount must be positive") is not enforced by the server — confirmed by direct
  test.** `insertTransactionSchema` adds no `.positive()`/`.min()` refinement to `amount` beyond
  the base Drizzle column (`real("amount").notNull()`); `POST /api/transactions` with
  `amount: -50` returns `201`, not the `400` the AC requires. This contradicts the project-wide
  invariant in `architecture.md` ("amount in the DB is always positive; type carries the sign
  semantics") — a negative `amount` on an `"income"` row, for example, would silently subtract
  from `totalIncome` in `summary.ts` instead of being rejected. `shared/schema.ts:66`'s column
  comment ("positive = income, negative = expense") documents the *pre-invariant* convention and
  is itself stale. **High risk** — logged in the Test Gap Backlog as a real implementation bug,
  not a missing test.
- **AC-004-06 ("transfer requires a target account") is enforced client-side only.**
  `insertTransactionSchema` does not add a refinement requiring `transferToAccountId` when
  `type === "transfer"` — `POST /api/transactions` with `{ type: "transfer", transferToAccountId:
  null }` is accepted by the server (`201`) and would then be silently excluded from both
  `transfersOut`/`transfersIn` in `summary.ts` (the `tx.transferToAccountId` truthiness check in
  `buildAccountSummaries` just skips it — the amount is dropped from both source and target
  accounting, not flagged). Logged in the Test Gap Backlog as a **medium**-risk gap: a
  non-browser API client (or a bug in a future PDF-import path) could silently create
  "phantom" transfers that vanish from every account balance.
