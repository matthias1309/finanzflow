# TEST-007 — Dashboard & Financial Overview

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-007
**Verifies:** REQ-007 (AC-007-01 … AC-007-08)

All ACs are E2E/UI-rendering concerns (client-only feature, ARCH-007); the underlying data
(`GET /api/summary/:month`) is already covered by TEST-004.

## Test Cases

### TC-007-01 — Dashboard shows KPIs for the current month by default

**Maps to:** AC-007-01
**Type:** e2e
**File:** ❌ missing

**Notes:** `tests/e2e/dashboard.spec.ts` → `Dashboard loads and shows the month selector` only
asserts the selector is visible, not that it defaults to the *current* month. See Test Gap
Backlog.

---

### TC-007-02 — KPIs update when a different month is selected

**Maps to:** AC-007-02
**Type:** e2e
**File:** ❌ missing

**Notes:** No test changes the month selector and asserts KPI values change accordingly. See Test
Gap Backlog.

---

### TC-007-03 — Savings rate is calculated correctly

**Maps to:** AC-007-03
**Type:** e2e
**File:** ❌ missing

**Notes:** No test seeds a known income/expense pair and asserts the exact "Bilanz"/"Sparquote"
card text. This is the core formula of the whole REQ and has zero coverage — the closest existing
coverage is `dashboard.spec.ts`'s `seedData()` helper, which creates one income transaction but
never reads back a KPI value. See Test Gap Backlog (**high** — a formula regression here would be
silently wrong on every user's dashboard).

---

### TC-007-04 — Negative balance is shown in red

**Maps to:** AC-007-04
**Type:** e2e
**File:** ❌ missing

**Notes:** No test creates expense > income for a month and asserts the Bilanz card's color class.
See Test Gap Backlog.

---

### TC-007-05 — Dashboard shows per-account breakdown

**Maps to:** AC-007-05
**Type:** e2e
**File:** ❌ missing

**Notes:** `Account KPI card appears after seeding data` (dashboard.spec.ts) asserts one account's
card is visible with its name — does not assert income/expenses/balance are shown per card, and
only tests a single-account scenario, not "three accounts → three cards." See Test Gap Backlog.

---

### TC-007-06 — Empty month shows zero KPIs

**Maps to:** AC-007-06
**Type:** e2e
**File:** ❌ missing

**Notes:** No test selects a month with no transactions and asserts `0,00 €`/`0.0%` on every KPI
card plus an empty Sankey chart. See Test Gap Backlog.

---

### TC-007-07 — No accounts shows a guidance message

**Maps to:** AC-007-07
**Type:** e2e
**File:** ❌ missing

**Notes:** No test exercises the zero-accounts state (all existing dashboard tests seed at least
one account via `seedData()`). See Test Gap Backlog.

---

### TC-007-08 — Loading state shows skeleton placeholders

**Maps to:** AC-007-08
**Type:** e2e
**File:** ❌ missing

**Notes:** No test asserts skeleton elements are present before data resolves (would need to
intercept/delay the `/api/summary/:month` response). See Test Gap Backlog (**low** — cosmetic,
hardest of this REQ's gaps to test reliably).
