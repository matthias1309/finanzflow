# TEST-014 — Mobile-Responsive UI

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-014
**Verifies:** REQ-014 (AC-014-01 … AC-014-09)

REQ-014 Notes explicitly invoke the TDD exception from `.claude/rules/v-model.md` ("purely visual
changes with no measurable assertions... state the reason explicitly before continuing") — this
REQ was implemented without a test layer by design, not by oversight. This retrofit does not
override that call, but Playwright *can* measure viewport-driven layout (via `resize_window` /
`page.setViewportSize` and bounding-box/visibility assertions), so each AC below is logged as a
**testable-but-accepted-gap** rather than "untestable."

## Test Cases

### TC-014-01 — Hamburger menu replaces the sidebar on mobile

**Maps to:** AC-014-01
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-02 — Tapping the hamburger icon opens the drawer

**Maps to:** AC-014-02
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-03 — Tapping a nav link closes the drawer and navigates

**Maps to:** AC-014-03
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-04 — Tapping the backdrop closes the drawer without navigating

**Maps to:** AC-014-04
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-05 — Dashboard KPI cards adapt their column count to screen width

**Maps to:** AC-014-05
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-06 — Dashboard account cards adapt their column count to screen width

**Maps to:** AC-014-06
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-07 — Transactions page header stacks on narrow screens

**Maps to:** AC-014-07
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-08 — Transaction table scrolls horizontally instead of clipping

**Maps to:** AC-014-08
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

---

### TC-014-09 — All pages keep a minimum padding and avoid overlap on narrow screens

**Maps to:** AC-014-09
**Type:** e2e
**File:** ❌ missing (accepted gap, REQ-014 Notes)

## Notes on this REQ's Test Gap Backlog treatment

All 9 ACs are logged as a single **low-risk, accepted** backlog entry rather than 9 separate
high/medium entries — the REQ itself documents that this trade-off was made deliberately (visual
regressions here are also the easiest category of bug to catch by eye during manual QA on a real
device, unlike the silent data-integrity gaps found in Sessions 6–7). If Session 10 revisits this
REQ, `resize_window`-style viewport emulation makes all 9 ACs mechanically testable without any
new tooling.
