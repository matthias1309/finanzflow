# ARCH-010 — Month Filtering & Navigation

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-010
**Verified by:** TEST-010

## Summary

The shared month-selection pattern used by both the Dashboard ([ARCH-007](ARCH-007.md)) and the
Transactions page: `GET /api/months` (distinct months with data) merged client-side with the
current calendar month, formatted in German locale, descending. No dedicated component — each page
implements the same pattern independently against the same endpoint.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `GET /api/months` | `server/routes.ts` | `storage.getAvailableMonths()` — distinct `month` values from `transactions`, sorted descending (server/storage.ts:`getAvailableMonths`, confirmed in ARCH-004 review) |
| Dashboard month selector | `client/src/pages/Dashboard.tsx` (`select-month` test id) | Merges `/api/months` with the current month, drives `GET /api/summary/:month` |
| Transactions month selector | `client/src/pages/Transactions.tsx` | Same merge pattern, drives `GET /api/transactions?month=` |
| `monthSchema` | `server/routes/transactions.ts` (ARCH-004) | `^\d{4}-\d{2}$` — validates the `month` query param (AC-010-06, transaction-list path) |

**Available-months list (AC-010-02, AC-010-03)**

`storage.getAvailableMonths()` runs `SELECT DISTINCT month FROM transactions`, sorted descending.
Each page merges this list with the current calendar month (`new Date()`, computed client-side) so
the selector always includes "now" even on a fresh install with zero transactions for the current
month (same mechanism ARCH-007 describes for the Dashboard specifically; Transactions does the
equivalent merge independently).

**Locale formatting (AC-010-07)**

`toLocaleDateString("de-DE", { month: "long", year: "numeric" })` — confirmed identical in both
`Dashboard.tsx` and `Transactions.tsx` (`new Date(...).toLocaleDateString("de-DE", ...)`), giving
`"April 2026"` rather than an English month name.

**Format validation (AC-010-06)**

The AC's example (`GET /api/summary/2026-4` → `400`) is technically about the **summary**
endpoint's month path parameter, not the `/api/months` list endpoint. `server/routes/summary.ts`
(ARCH-004) takes `month` as an Express route param (`/:month`) with **no validation at all** — see
Open Questions. The `/api/transactions?month=` query-param path *does* validate via `monthSchema`
(already covered by TEST-004's `rejects invalid month format on GET`).

## Key Decisions

- **No shared `MonthSelector` component** — Dashboard and Transactions each implement the same
  merge-with-current-month pattern independently rather than extracting a shared component; this
  keeps the two pages decoupled at the cost of duplicating a small amount of logic (REQ-004's
  Rule-of-Three from `coding-style.md` hasn't triggered extraction — only two call sites exist).
- **Month list computed from actual transaction data, not a fixed calendar range** — a user who
  imported five years of statements sees exactly those five years' months, no more, no less
  (except the always-included current month).

## Out of Scope

- Dashboard KPI computation once a month is selected — [ARCH-007](ARCH-007.md).
- Transaction filtering by month once selected — [ARCH-004](ARCH-004.md).

## Open Questions

- **`GET /api/summary/:month` (`server/routes/summary.ts`) does not validate the `month` path
  parameter at all** — unlike `GET /api/transactions?month=`, which validates via `monthSchema`
  (`server/routes/transactions.ts`, ARCH-004). AC-010-06's Gherkin example uses the summary
  endpoint (`GET /api/summary/2026-4`), but that endpoint currently accepts any string as `:month`
  and would simply return an empty/all-zero summary for a malformed value rather than a `400`.
  This AC is satisfied for the transaction-list path (tested, TEST-004) but **not for the summary
  path it explicitly names — confirmed by direct test, not inferred**: `GET /api/summary/2026-4`
  returns `200` with an empty/zeroed summary (`{"totalIncome":0,"totalExpenses":0,"accountSummaries":{},...}`),
  not the `400` the AC requires. **Medium risk** — a malformed month silently returns "no data"
  instead of surfacing the input error, which could mask a client-side bug that constructs a bad
  month string.
