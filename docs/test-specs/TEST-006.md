# TEST-006 — Automatic Category Suggestion (Learning System)

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-006
**Verifies:** REQ-006 (AC-006-01 … AC-006-08)

No test file exists for `storage.suggestCategory`, `storage.learnCategoryRules`, or
`categoryRulesRouter` — every TC below is `❌ missing`.

## Test Cases

### TC-006-01 — Category is suggested for a known payee on next import

**Maps to:** AC-006-01
**Type:** integration
**File:** ❌ missing

**Notes:** Would call `POST /api/category-rules/learn` with a "REWE Markt" → Lebensmittel entry,
then assert `storage.suggestCategory("REWE Markt Hamburg")` (or the PDF-import preview's
`suggestedCategoryId`) returns that category. See Test Gap Backlog (**high** — core feature).

---

### TC-006-02 — Longer keyword takes precedence over shorter one

**Maps to:** AC-006-02
**Type:** unit
**File:** ❌ missing

**Notes:** Directly tests `suggestCategory`'s tie-breaking logic — two rules ("REWE" and
"REWE Markt") both matching, longer one should win. See Test Gap Backlog (**high** — this is the
core algorithmic guarantee of the whole feature).

---

### TC-006-03 — Manual override clears auto-suggestion flag

**Maps to:** AC-006-03
**Type:** e2e
**File:** ❌ missing

**Notes:** UI-state assertion (sparkles icon) plus the resulting "not learned" effect — the latter
half is testable at the API layer (send a `/learn` batch that excludes the overridden row, assert
no rule was created for it), the former is E2E-only. See Test Gap Backlog (**medium**).

---

### TC-006-04 — Auto-suggested categories are learned on import confirmation

**Maps to:** AC-006-04
**Type:** integration
**File:** ❌ missing

**Notes:** Calls `/learn` twice with the same `(description, categoryId)` and asserts `hits`
increments via `GET /api/category-rules`. See Test Gap Backlog (**high**).

---

### TC-006-05 — No suggestion when payee is unknown

**Maps to:** AC-006-05
**Type:** unit
**File:** ❌ missing

**Notes:** `suggestCategory` returns `null` when no stored keyword matches — the simplest possible
regression guard for this feature and currently untested. See Test Gap Backlog (**medium**).

---

### TC-006-06 — Keyword must be at least 3 characters to be learned

**Maps to:** AC-006-06
**Type:** unit
**File:** ❌ missing

**Notes:** `learnCategoryRules` discards a description whose extracted keyword is `< 3` chars (e.g.
`"TV"`). No test constructs this case. See Test Gap Backlog (**medium**).

---

### TC-006-07 — Learning accepts up to 500 entries per batch

**Maps to:** AC-006-07
**Type:** integration
**File:** ❌ missing

**Notes:** `learnBatchSchema.max(500)`. No test posts a full 500-entry batch. See Test Gap Backlog
(**low** — straightforward schema bound, same pattern already tested for `/api/transactions/batch`
in TEST-004).

---

### TC-006-08 — Invalid entries in learn batch are skipped

**Maps to:** AC-006-08
**Type:** integration
**File:** ❌ missing

**Notes:** 🔴 **This AC does not currently hold — confirmed by a direct test (run during this
review, not committed).** Posting a batch with one entry with a negative `categoryId` alongside a
valid entry returns `400` for the *entire* request; the valid entry is not saved either. This
contradicts "that entry is skipped, valid entries in the same batch are still processed." See
`docs/architecture/ARCH-011.md` Open Questions and the Test Gap Backlog — logged as a confirmed
implementation gap (fix: mirror `transactionsRouter.post("/batch")`'s per-item `safeParse` +
filter pattern), not just a missing test. **High risk.**
