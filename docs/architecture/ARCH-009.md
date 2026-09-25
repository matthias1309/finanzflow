# ARCH-009 — Sankey Cash Flow Diagram

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-009
**Verified by:** TEST-009

## Summary

A client-rendered D3/d3-sankey diagram (income categories → accounts → expense categories, plus
horizontal inter-account transfer flows) built from the same `GET /api/summary/:month` response
the Dashboard KPIs use ([ARCH-007](ARCH-007.md)), filtered by the same account-visibility state
([ARCH-008](ARCH-008.md)). No server component of its own. See `docs/architecture/ARC42.md` §6.2
and §8.1 ("CSS Injection Prevention" — `safeCssColor()`).

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `SankeyChart` | `client/src/components/SankeyChart.tsx` | Builds the three-layer node/link graph, runs the d3-sankey layout, renders SVG |
| `safeCssColor` | `client/src/lib/config.ts` (ARC42 §8.1) | Sanitizes category/account colors from the DB before they reach SVG `fill`/`stroke` |
| `ChartErrorBoundary` | `client/src/components/ChartErrorBoundary.tsx` | React error boundary wrapping `SankeyChart` in `Dashboard.tsx`; catches rendering/layout errors and shows a fallback message instead of crashing the Dashboard (AC-009-08) |

**Graph construction (AC-009-01, AC-009-02, AC-009-03, AC-009-04)**

From the (visibility-filtered) `accountSummaries`:
- Left-layer nodes: income categories with `incomeByCategory` totals > 0 on any visible account.
- Center-layer nodes: visible accounts that have at least one non-zero flow (income, expense, or
  transfer) — an account with zero transactions for the month is excluded (AC-009-04), and a
  hidden account (ARCH-008) never enters the summary this component receives in the first place
  (AC-009-03).
- Right-layer nodes: expense categories with `expenseByCategory` totals > 0.
- Links: income-category → account (by `incomeByCategory` amount), account → expense-category (by
  `expenseByCategory` amount), and account → account for transfers (`transfersOut`/`transfersIn`
  from ARCH-004), rendered as horizontal center-layer links in a distinct teal (`#4f98a3`,
  AC-009-02) rather than the vertical income/expense flow colors.

**Layout (REQ-009 Notes)**

d3-sankey with `nodeWidth: 16`, `nodePadding: 12`, `nodeAlign: "left"`. Chart height is computed
as `max(520, rowCount * 56 + 60)` where `rowCount` is the largest of the three layers' node
counts, so the SVG grows to fit dense months rather than cramming nodes together.

**Theming (AC-009-05)**

Node label color and income/expense flow colors are theme-dependent (dark vs. light mode) constant
pairs baked into `SankeyChart`, not derived from the DB — only *category/account* colors come from
the DB (and are routed through `safeCssColor()` per ARC42 §8.1's CSS-injection rule); the
structural chart colors (labels, default income/expense tint) are fixed per theme.

**Loading state (AC-009-06)**

Three skeleton rows render while the underlying summary fetch (shared with the Dashboard KPIs,
ARCH-007) is in flight — same data source, same loading boundary, not a separate fetch.

**Month binding (AC-009-07)**

The chart re-renders whenever the Dashboard's selected month changes, since it consumes the same
`GET /api/summary/:month` response as the KPI cards — no independent month state in `SankeyChart`
itself.

**Crash resilience (AC-009-08)**

`d3-sankey`'s layout algorithm requires the account-transfer subgraph to be acyclic; it throws
`Error("circular link")` when it isn't. Before ARCH-004's AC-004-13 netting pass existed, a
household that recorded reciprocal transfers between two accounts in the same month (e.g. a
sweep back and forth between checking and savings) produced exactly this cycle, and the thrown
error — uncaught inside `SankeyChart`'s `useEffect` — unmounted the whole React tree, leaving a
blank page with no way to recover short of a reload. `Dashboard.tsx` now wraps `SankeyChart` in
`ChartErrorBoundary`, a standard React class-component error boundary
(`static getDerivedStateFromError` / `componentDidCatch`), so any *remaining* rendering error
(chart bugs, unexpected data shapes, cycles ARCH-004's netting doesn't cover — see ARCH-004 Key
Decisions) degrades to a fallback message inside the chart's card instead of taking down the KPI
cards and the rest of the Dashboard with it. This is layered defense, not a substitute for the
data-level fix: netting removes the common cycle at its source; the boundary only catches whatever
netting doesn't.

## Key Decisions

- **No server-side graph-shaping endpoint** — `summary.ts`'s `accountSummaries` structure
  (per-account income/expense-by-category, transfersIn/transfersOut) already contains everything
  needed to build the three-layer graph; a dedicated `/api/sankey/:month` endpoint would just
  reshape the same data server-side for no real benefit, since the reshaping (grouping by
  category, filtering zero-amount nodes) is cheap and naturally colocated with rendering.
- **Static SVG, not interactive** (REQ-009 Notes) — no click/hover/drill-down; keeps the component
  simple and matches the "quick visual overview" use case rather than an exploratory analytics
  tool.
- **Chart-scoped error boundary instead of a global one** — `ChartErrorBoundary` wraps only
  `SankeyChart`, not the whole `Dashboard` or `App`. The KPI cards derive from the same
  `accountSummaries` data and don't share the chart's layout computation, so they have no reason
  to fail alongside it; scoping the boundary tightly keeps the rest of the Dashboard usable when
  only the chart breaks (AC-009-08's "rest of the Dashboard remains functional").

## Out of Scope

- The underlying summary aggregation and transfer accounting — [ARCH-004](ARCH-004.md).
- Account visibility filtering that determines which accounts even reach this component —
  [ARCH-008](ARCH-008.md).
- KPI cards consuming the same data — [ARCH-007](ARCH-007.md).

## Open Questions

- **No test asserts the Sankey diagram's actual graph structure, colors, or dimensions.**
  `tests/e2e/dashboard.spec.ts` only checks that a `sankey-card` test-id is present, not that it
  contains the expected nodes/links/colors for given data, that hidden/empty accounts are excluded
  from it (AC-009-03/04), that dark/light theming applies (AC-009-05), or that changing the month
  updates its header/content (AC-009-07). See Test Gap Backlog.
- **`ChartErrorBoundary` only catches errors thrown during React's render/commit lifecycle**, per
  the React error-boundary contract — this includes errors thrown synchronously inside a child's
  `useEffect` (which is how `SankeyChart`'s d3-sankey call is caught today), but not errors thrown
  from event handlers or from genuinely asynchronous code (`setTimeout`, a rejected promise outside
  React's commit). Worth remembering if the chart's rendering ever moves behind an `async` call.
