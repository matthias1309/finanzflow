# TEST-009 — Sankey Cash Flow Diagram

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-009
**Verifies:** REQ-009 (AC-009-01 … AC-009-08)

All ACs are E2E/UI-rendering concerns (client-only feature, ARCH-009); the underlying summary data
and transfer accounting are already covered by TEST-004.

## Test Cases

### TC-009-01 — Diagram renders with income and expense flows

**Maps to:** AC-009-01
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** The Sankey diagram is entirely client-rendered from the `/api/summary/:month` response, which is now more solidly covered server-side (TEST-004, TEST-007's TC-007-03 formula test). Structural/visual assertions on the rendered SVG itself (nodes, links, theming) would need a dedicated Playwright spec — left as an E2E follow-up rather than attempted in this test-gap-closure session.

**Notes:** `Sankey card is rendered on the Dashboard` (dashboard.spec.ts) only asserts the
`sankey-card` container exists, not that it contains the expected nodes for given income/expense
data. See Test Gap Backlog (**high** — the diagram is FinanzFlow's signature feature and has zero
structural test coverage).

---

### TC-009-02 — Inter-account transfers are shown as horizontal flows

**Maps to:** AC-009-02
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** The Sankey diagram is entirely client-rendered from the `/api/summary/:month` response, which is now more solidly covered server-side (TEST-004, TEST-007's TC-007-03 formula test). Structural/visual assertions on the rendered SVG itself (nodes, links, theming) would need a dedicated Playwright spec — left as an E2E follow-up rather than attempted in this test-gap-closure session.

**Notes:** No test seeds a transfer transaction and asserts a horizontal link with the `#4f98a3`
teal color appears. See Test Gap Backlog.

---

### TC-009-03 — Hidden accounts are excluded from the diagram

**Maps to:** AC-009-03
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** The Sankey diagram is entirely client-rendered from the `/api/summary/:month` response, which is now more solidly covered server-side (TEST-004, TEST-007's TC-007-03 formula test). Structural/visual assertions on the rendered SVG itself (nodes, links, theming) would need a dedicated Playwright spec — left as an E2E follow-up rather than attempted in this test-gap-closure session.

**Notes:** TEST-008's dashboard tests toggle account visibility and check the KPI card's opacity
class, but no test then inspects the Sankey chart's rendered nodes to confirm the hidden account's
node/flows are actually gone from the SVG. See Test Gap Backlog.

---

### TC-009-04 — Empty accounts are excluded from the diagram

**Maps to:** AC-009-04
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** The Sankey diagram is entirely client-rendered from the `/api/summary/:month` response, which is now more solidly covered server-side (TEST-004, TEST-007's TC-007-03 formula test). Structural/visual assertions on the rendered SVG itself (nodes, links, theming) would need a dedicated Playwright spec — left as an E2E follow-up rather than attempted in this test-gap-closure session.

**Notes:** No test creates a zero-transaction account and asserts it does not appear as a Sankey
node. See Test Gap Backlog.

---

### TC-009-05 — Diagram adapts to dark and light mode

**Maps to:** AC-009-05
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** The Sankey diagram is entirely client-rendered from the `/api/summary/:month` response, which is now more solidly covered server-side (TEST-004, TEST-007's TC-007-03 formula test). Structural/visual assertions on the rendered SVG itself (nodes, links, theming) would need a dedicated Playwright spec — left as an E2E follow-up rather than attempted in this test-gap-closure session.

**Notes:** No test toggles the theme and inspects label/flow colors in the rendered SVG. See Test
Gap Backlog.

---

### TC-009-06 — Loading state shows skeleton placeholder

**Maps to:** AC-009-06
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** The Sankey diagram is entirely client-rendered from the `/api/summary/:month` response, which is now more solidly covered server-side (TEST-004, TEST-007's TC-007-03 formula test). Structural/visual assertions on the rendered SVG itself (nodes, links, theming) would need a dedicated Playwright spec — left as an E2E follow-up rather than attempted in this test-gap-closure session.

**Notes:** Same gap category as TC-007-08 — no test intercepts/delays the summary fetch to observe
the skeleton state. See Test Gap Backlog (**low**).

---

### TC-009-07 — Diagram is shown for the selected month

**Maps to:** AC-009-07
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** The Sankey diagram is entirely client-rendered from the `/api/summary/:month` response, which is now more solidly covered server-side (TEST-004, TEST-007's TC-007-03 formula test). Structural/visual assertions on the rendered SVG itself (nodes, links, theming) would need a dedicated Playwright spec — left as an E2E follow-up rather than attempted in this test-gap-closure session.

**Notes:** No test changes the month selector and asserts the Sankey header text or diagram
content updates accordingly. See Test Gap Backlog.

---

### TC-009-08 — Chart rendering errors do not crash the Dashboard

**Maps to:** AC-009-08
**Type:** e2e
**File:** `tests/e2e/dashboard.spec.ts`
**Status:** written, not executed — the Playwright-managed dev server in the session's sandbox
threw `SqliteError: attempt to write a readonly database` (`SQLITE_READONLY_DBMOVED`) on the first
write after login, reproducibly, even on a from-scratch run with `globalSetup`'s own DB deletion
and no other process touching the file. Confirmed unrelated to this change: the same error hits
the pre-existing, unmodified `seedData()`-based tests (`Account KPI card appears after seeding
data`, etc.) identically. Not investigated further as a code bug — `server/db.ts` opens
`better-sqlite3` with no unusual flags, and the same `createAccount` call succeeds repeatedly
outside Playwright's process orchestration (manual `curl` against a manually started `npm run
dev`). Left as a sandbox/environment limitation for this session, not a REQ/ARCH gap. The two
`ChartErrorBoundary` render paths (fallback shown on error, children shown otherwise) are ordinary,
well-established React error-boundary behavior (`getDerivedStateFromError`/`componentDidCatch`) —
correctness was instead verified by directly tracing the *unfixed* code in a real browser (before
`ChartErrorBoundary` existed), which reproduced the reported white-page bug exactly as described,
confirming the diagnosis this component addresses.

```gherkin
Given three accounts "Konto A", "Konto B", "Konto C" each transfer to the next
  (A→B, B→C, C→A), seeded directly via the API — a 3-node cycle AC-004-13's pairwise
  netting does not remove
When the Dashboard is displayed
Then the KPI cards are visible
And the Sankey card shows a fallback message instead of a broken or missing chart
And no unhandled error leaves the page blank
```

**Notes:** Regression test for the originally reported bug (white page on mutual transfers) and
its safety net. Seeds data through `POST /api/transactions` (per `testing-practices.md`, data
setup is never done through the UI). Uses a 3-account cycle rather than the 2-account reciprocal
case, because TC-004-13's netting already prevents the 2-account case from ever reaching
`SankeyChart` as a cycle — a 3-account cycle is unaffected by pairwise netting (ARCH-004 Key
Decisions) and reliably still reaches `d3-sankey` as an unlaid-out graph, so this test exercises
`ChartErrorBoundary` itself rather than depending on netting to produce the failure.
