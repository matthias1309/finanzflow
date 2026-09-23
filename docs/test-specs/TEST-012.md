# TEST-012 — Dark / Light Theme

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-012
**Verifies:** REQ-012 (AC-012-01 … AC-012-05)

No test file exists for the theme system at all — every TC below is `❌ missing`.

## Test Cases

### TC-012-01 — App starts in dark mode on a system set to dark

**Maps to:** AC-012-01
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** Directly testable via Playwright's `colorScheme` emulation once an E2E spec exists for it — no server-side component to this feature at all. Left as an E2E follow-up.

**Notes:** Playwright supports `colorScheme: "dark"` emulation (`page.emulateMedia` /
project config) — directly testable, just not written. See Test Gap Backlog.

---

### TC-012-02 — App starts in light mode on a system set to light

**Maps to:** AC-012-02
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** Directly testable via Playwright's `colorScheme` emulation once an E2E spec exists for it — no server-side component to this feature at all. Left as an E2E follow-up.

**Notes:** Same mechanism as TC-012-01, `colorScheme: "light"`. See Test Gap Backlog.

---

### TC-012-03 — User toggles from dark to light mode

**Maps to:** AC-012-03
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** Directly testable via Playwright's `colorScheme` emulation once an E2E spec exists for it — no server-side component to this feature at all. Left as an E2E follow-up.

**Notes:** No test clicks the theme toggle and asserts the `dark` class is removed from
`document.documentElement` plus the label/icon swap. See Test Gap Backlog.

---

### TC-012-04 — User toggles from light to dark mode

**Maps to:** AC-012-04
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** Directly testable via Playwright's `colorScheme` emulation once an E2E spec exists for it — no server-side component to this feature at all. Left as an E2E follow-up.

**Notes:** Same gap, opposite direction. See Test Gap Backlog.

---

### TC-012-05 — Sankey chart adapts to theme

**Maps to:** AC-012-05
**Type:** e2e
**File:** ❌ missing

**Status: accepted (Session 10).** Directly testable via Playwright's `colorScheme` emulation once an E2E spec exists for it — no server-side component to this feature at all. Left as an E2E follow-up.

**Notes:** Overlaps TEST-009's TC-009-05 (Sankey dark/light color assertions) — same underlying
gap, counted once in the backlog (attributed to REQ-009 there since it's about the chart's own
rendering, cross-referenced from here).
