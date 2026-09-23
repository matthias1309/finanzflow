# TEST-008 — Account Visibility Toggle on Dashboard

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-008
**Verifies:** REQ-008 (AC-008-01, AC-008-02, AC-008-03, AC-008-04, AC-008-05, AC-008-06, AC-008-07)

All ACs are E2E-type (client-only feature, ARCH-008) — none have a meaningful API-level
representation.

## Test Cases

### TC-008-01 — Hiding an account removes it from KPI totals

**Maps to:** AC-008-01
**Type:** e2e
**File:** `tests/e2e/dashboard.spec.ts`

```gherkin
Given the Dashboard shows two accounts: "Girokonto" (income 1000€, expenses 400€) and "Sparkonto" (income 200€, expenses 50€)
And the total Einnahmen KPI shows "1.200,00 €"
When the user clicks the "Sparkonto" account card to hide it
Then the "Sparkonto" card becomes visually dimmed (40% opacity)
And the EyeOff icon is shown on the "Sparkonto" card
And the Einnahmen KPI updates to "1.000,00 €"
And the Ausgaben KPI updates to "400,00 €"
```

**Notes:** Covered **partially** by `Clicking an account KPI card toggles visibility` — asserts
the `opacity-40` class toggles on click. Does not assert the EyeOff icon appears, and does not set
up two accounts with distinct KPI values to verify the totals actually recompute (single-account
fixture via `seedData`). See Test Gap Backlog.

---

### TC-008-02 — Sankey chart excludes hidden accounts

**Maps to:** AC-008-02
**Type:** e2e
**File:** ❌ missing

**Notes:** `Sankey card is rendered on the Dashboard` only checks the card exists, not that hiding
an account changes its content. See Test Gap Backlog.

---

### TC-008-03 — Re-enabling a hidden account restores it

**Maps to:** AC-008-03
**Type:** e2e
**File:** `tests/e2e/dashboard.spec.ts`

```gherkin
Given "Sparkonto" is hidden (dimmed, EyeOff icon)
When the user clicks the "Sparkonto" card again
Then "Sparkonto" returns to full opacity
And the Eye icon is shown
And the KPIs include "Sparkonto" again
```

**Notes:** Covered **partially** by the second half of `Clicking an account KPI card toggles
visibility` (`await kpi.click(); await expect(kpi).not.toHaveClass(/opacity-40/)`). Icon and KPI
re-inclusion not separately asserted.

---

### TC-008-04 — Multiple accounts can be hidden simultaneously

**Maps to:** AC-008-04
**Type:** e2e
**File:** ❌ missing

**Notes:** `seedData()` in `dashboard.spec.ts` only creates one account — no test scenario has
three accounts to hide two of. See Test Gap Backlog.

---

### TC-008-05 — Hidden account count is shown in the Sankey header

**Maps to:** AC-008-05
**Type:** e2e
**File:** ❌ missing

**Notes:** No test asserts the "N Konten ausgeblendet" header text. See Test Gap Backlog.

---

### TC-008-06 — All accounts visible by default

**Maps to:** AC-008-06
**Type:** e2e
**File:** `tests/e2e/dashboard.spec.ts`

```gherkin
When the user first opens the Dashboard
Then all account cards are at full opacity
And all accounts contribute to the KPIs
```

**Notes:** Covered implicitly by `Account KPI card appears after seeding data` (the KPI is visible
without any hide interaction), though it does not explicitly assert the *absence* of the
`opacity-40` class on first load.

---

### TC-008-07 — Visibility state resets on page reload

**Maps to:** AC-008-07
**Type:** e2e
**File:** ❌ missing

**Notes:** No test hides an account, reloads the page, and asserts it is visible again. This is
the AC most specific to REQ-008's "intentionally not persisted" design decision (ARCH-008) and
currently has no regression coverage — if a future change accidentally added persistence
(localStorage, a server field), nothing would catch it. See Test Gap Backlog.
