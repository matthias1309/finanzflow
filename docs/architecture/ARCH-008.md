# ARCH-008 — Account Visibility Toggle on Dashboard

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-008
**Verified by:** TEST-008

## Summary

A purely client-side filter: clicking an account's KPI card on the Dashboard toggles that account
out of the displayed totals and Sankey chart, without any server round-trip or persistence. Builds
on the summary data produced by [ARCH-004](ARCH-004.md)'s `GET /api/summary/:month`.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| Dashboard page component | `client/src/pages/Dashboard.tsx` | Owns the `hiddenAccountIds: Set<number>` state; renders account KPI cards, the Sankey card, and the "N Konten ausgeblendet" header count |
| `filteredSummary` (`useMemo`) | `client/src/pages/Dashboard.tsx` | Recomputes KPI totals and Sankey input from the `GET /api/summary/:month` response, excluding any account in `hiddenAccountIds` |

**Behavior**

- `hiddenAccountIds` starts as an empty `Set` on every mount — no localStorage/DB persistence
  (AC-008-06, AC-008-07: "resets on page reload" is not a bug to fix, it's the specified behavior).
- Clicking an account KPI card toggles its `id` in/out of the set; the card's opacity (dimmed 40%
  when hidden) and Eye/EyeOff icon are driven directly by set membership (AC-008-01, AC-008-03).
- `filteredSummary` recomputes on every `hiddenAccountIds` change — KPI totals, category
  breakdowns, and the Sankey chart's node/flow data are all derived from the *same* filtered view,
  so hiding an account is consistent across every widget on the page in one recomputation
  (AC-008-01, AC-008-02, AC-008-04).
- The Sankey card header shows `hiddenAccountIds.size` accounts hidden (AC-008-05).
- No API call is made when toggling — the full unfiltered summary is always in memory from the
  initial `GET /api/summary/:month` (`ARC42.md` §6.2, Dashboard Load); filtering is a pure
  client-side `useMemo` (REQ-008 Notes).

## Key Decisions

- **Client-only state, not a server-side "hidden" flag on `accounts`** — this is a per-viewing-session
  focus tool ("hide the shared account for a minute"), not a persistent account property; adding a
  server-side field would conflate two different concerns (REQ-002's account CRUD vs. this
  transient display preference) and force multi-device/multi-user sync decisions the feature
  doesn't need.
- **Single `useMemo` recomputing every dependent value together** rather than separate derived
  states per widget — guarantees the KPI row and the Sankey chart can never disagree about which
  accounts are currently visible.

## Out of Scope

- The underlying summary data and transfer accounting the filter operates on — [ARCH-004](ARCH-004.md).
- Persisting visibility preferences across reloads — explicitly not wanted (REQ-008 Notes).

## Open Questions

None — this is a fully client-side, non-persistent feature; all 7 ACs describe UI behavior
verifiable at the E2E layer.
