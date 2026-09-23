# TEST-009 — Sankey Cash Flow Diagram

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-009
**Verifies:** REQ-009 (AC-009-01 … AC-009-07)

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
