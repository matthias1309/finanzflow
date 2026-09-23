# ARCH-014 — Mobile-Responsive UI

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-014
**Verified by:** TEST-014

## Summary

Responsive layout: a Tailwind-breakpoint-driven sidebar/drawer swap (`Layout.tsx`) plus
responsive grid/flex utilities on the Dashboard and Transactions pages. Entirely CSS/markup — no
new components beyond the drawer state already in `Layout.tsx`, no server involvement.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `Layout` (drawer + top bar) | `client/src/components/Layout.tsx` | `drawerOpen` state; renders the fixed mobile top bar + hamburger, the backdrop, and the sidebar with responsive positioning classes |
| Dashboard grid classes | `client/src/pages/Dashboard.tsx` | KPI card grid and account card grid column counts per breakpoint |
| Transactions layout classes | `client/src/pages/Transactions.tsx` | Header stacking, horizontally-scrollable table wrapper |

**Sidebar/drawer (AC-014-01 … AC-014-04)**

`Layout.tsx` holds `drawerOpen` (`useState`). The sidebar's class string combines:
`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out md:static
md:translate-x-0 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}` — below the `md` (768px)
breakpoint this is a slide-in drawer driven by `drawerOpen`; at `md` and above, `md:static
md:translate-x-0` overrides both the fixed positioning and the transform, making it a normal
static sidebar regardless of `drawerOpen` (AC-014-01). A backdrop `<div>` renders conditionally
on `drawerOpen` and closes the drawer on tap without navigating (AC-014-04); nav links close the
drawer *and* navigate (AC-014-03) — the same click closes it, a route change is the side effect of
the link itself, not a separate step.

**Responsive grids (AC-014-05, AC-014-06)**

Dashboard KPI and account-card grids use Tailwind responsive grid-column utilities
(`grid-cols-2 ... lg:grid-cols-4` for KPIs per AC-014-05; `grid-cols-1 sm:grid-cols-2 ...` for
account cards per AC-014-06) — pure CSS breakpoint switching, no JS viewport detection.

**Transactions page (AC-014-07, AC-014-08)**

Header uses `flex-col` below `md`, `md:flex-row` at/above; the transaction table sits inside a
horizontally-scrollable wrapper (`overflow-x-auto`) so wide rows scroll rather than clip or wrap
awkwardly.

**Baseline spacing (AC-014-09)**

Page containers use `p-4` (16px) as the minimum horizontal padding at all breakpoints, per REQ-014
Notes; the mobile top bar is `fixed`, so content containers need enough top padding/margin to
clear it (not independently re-verified here — a rendering detail, not a distinct architectural
decision).

## Key Decisions

- **Pure CSS breakpoints, no JS `matchMedia`/resize listeners** — Tailwind's `sm:`/`md:`/`lg:`
  variants handle every AC in this REQ without any runtime viewport detection code; simpler and
  avoids a class of resize-listener bugs (stale state, layout thrash) entirely.
- **No external drawer/menu package** (REQ-014 Notes, explicit) — a single `useState` boolean plus
  `transition-transform` covers the whole interaction; pulling in a headless-UI drawer library
  would be unjustified for this scope.
- **TDD exception for this REQ** (REQ-014 Notes, explicit, citing `.claude/rules/v-model.md`
  "TDD Rule") — purely visual breakpoint behavior was judged to have no measurable assertion
  worth writing at the time REQ-014 was implemented; this retrofit does not second-guess that
  call, but does note it explicitly in TEST-014 rather than silently listing every AC as a gap
  indistinguishable from an oversight.

## Out of Scope

- Dashboard/Sankey content itself — [ARCH-007](ARCH-007.md)/[ARCH-009](ARCH-009.md); this document
  covers only the responsive layout mechanics around them.

## Open Questions

None beyond the explicitly-accepted TDD exception (REQ-014 Notes) — see TEST-014 for how that
translates into this retrofit's Test Gap Backlog treatment.
