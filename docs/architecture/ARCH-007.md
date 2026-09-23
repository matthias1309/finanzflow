# ARCH-007 — Dashboard & Financial Overview

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-007
**Verified by:** TEST-007

## Summary

The Dashboard is a client-rendered view over `GET /api/summary/:month` (ARCH-004): month
selection, four KPI cards (Einnahmen, Ausgaben, Bilanz, Sparquote), and per-account breakdown
cards. Builds on [ARCH-008](ARCH-008.md) (account visibility filtering) and feeds
[ARCH-009](ARCH-009.md) (Sankey chart) with the same filtered data. See `docs/architecture/ARC42.md`
§6.2 (Dashboard Load).

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `Dashboard` page | `client/src/pages/Dashboard.tsx` | Month selection, KPI computation, account cards, orchestrates the Sankey card |
| `GET /api/summary/:month` | `server/routes/summary.ts` (ARCH-004) | Data source — per-account income/expense/transfer totals for the month |
| `GET /api/months` | `server/routes.ts` | Populates the month selector's available options |

**KPI computation (AC-007-01 … AC-007-04)**

All four KPIs are derived client-side from the (visibility-filtered, per ARCH-008)
`accountSummaries` in the summary response — no separate KPI endpoint:

| KPI | Formula |
|---|---|
| Einnahmen | `Σ totalIncome` across visible accounts |
| Ausgaben | `Σ totalExpenses` across visible accounts |
| Bilanz | `Einnahmen − Ausgaben` |
| Sparquote | `(Bilanz / Einnahmen) × 100`, or `0.0%` when `Einnahmen === 0` (REQ-007 Notes) |

Bilanz and Sparquote card color (green/red) is a pure sign check on the computed value
(AC-007-04) — no server involvement.

**Month selector (REQ-007 Notes)**

The current calendar month is always included in the selector's options even if
`GET /api/months` doesn't return it (no transactions yet that month) — computed client-side
(`new Date()`) and merged with the server's list, ensuring AC-007-01's "month selector shows the
current month" holds on a fresh install with zero transactions.

**Empty states (AC-007-06, AC-007-07)**

- No transactions for the selected month → all KPI cards show `0,00 €`/`0.0%` (the summary
  endpoint returns valid zeroed `accountSummaries` for every existing account, not an error) and
  the Sankey chart renders empty (ARCH-009 handles this by producing no nodes/links).
- No accounts exist at all → the client shows a placeholder/guidance card instead of iterating an
  empty `accounts` array into account cards.

**Loading state (AC-007-08)**

Skeleton placeholders render while the React Query fetch for `/api/summary/:month` is in flight
(`isLoading`), replaced by real KPI values once resolved.

## Key Decisions

- **No dedicated dashboard/KPI API endpoint** — `GET /api/summary/:month` already returns
  everything needed (per-account income/expense/transfer breakdowns); computing four numbers from
  that client-side avoids a redundant endpoint that would need to duplicate `summary.ts`'s
  aggregation logic.
- **Current month always selectable, even with zero data** — a first-time user with no
  transactions yet should never land on an empty selector; the month list is a union of "months
  with data" and "the current month," not just the former.

## Out of Scope

- The underlying summary aggregation and transfer accounting — [ARCH-004](ARCH-004.md).
- Account visibility filtering — [ARCH-008](ARCH-008.md).
- Sankey chart rendering — [ARCH-009](ARCH-009.md).

## Open Questions

- **No test file covers the Dashboard's KPI computation, empty states, or loading skeleton at
  all.** `tests/e2e/dashboard.spec.ts` (shared with ARCH-008/TEST-008) covers the account-visibility
  toggle and that the KPI card and Sankey card render, but does not assert KPI *values* (Einnahmen/
  Ausgaben/Bilanz/Sparquote formulas), the empty-month state, the no-accounts placeholder, or the
  loading skeleton. See Test Gap Backlog.
