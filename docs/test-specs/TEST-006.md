# TEST-006 — Automatic Category Suggestion (Learning System)

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-006
**Verifies:** REQ-006 (AC-006-01 … AC-006-08)

Session 10 added `tests/server/api/categoryRules.test.ts`, exercising `storage.suggestCategory` /
`storage.learnCategoryRules` end-to-end through `POST /api/category-rules/learn`,
`GET /api/category-rules`, and `POST /api/import/pdf` (with `parsePDF` mocked, to observe
`suggestedCategoryId` the way the real import flow uses it).

## Test Cases

### TC-006-01 — Category is suggested for a known payee on next import

**Maps to:** AC-006-01
**Type:** integration
**File:** `tests/server/api/categoryRules.test.ts`

**Notes:** Closed in Session 10 — `learns a keyword rule and applies it as a suggestion on the
next import` learns "Rewe" → a category via `/learn`, then confirms a subsequent mocked PDF import
suggests that category for "Rewe Filiale 123".

---

### TC-006-02 — Longer keyword takes precedence over shorter one

**Maps to:** AC-006-02
**Type:** unit
**File:** `tests/server/api/categoryRules.test.ts`

**Notes:** Closed in Session 10 — `prefers the longer matching keyword when suggesting a category`
learns "Amazon" and "Amazon Prime Video" against two different categories and confirms the longer
keyword wins for a payee matching both. Written as an integration test (through the API) rather
than a pure unit test against `suggestCategory` directly, since the route wiring was already in
place — same behavioral guarantee.

---

### TC-006-03 — Manual override clears auto-suggestion flag

**Maps to:** AC-006-03
**Type:** e2e
**File:** ❌ missing

**Notes:** UI-state assertion (sparkles icon) plus the resulting "not learned" effect. The latter
half is now implicitly covered — `/learn` only ever receives what the client sends, and
`categoryRules.test.ts` confirms `/learn` behaves correctly for the entries it *does* receive — but
no test constructs "client omits the overridden row from its `/learn` payload" as its own scenario,
and the sparkles-icon UI state itself is E2E-only.

**Status: accepted (Session 10).** Client-only state-tracking, no server-side risk. Left as an E2E
follow-up.

---

### TC-006-04 — Auto-suggested categories are learned on import confirmation

**Maps to:** AC-006-04
**Type:** integration
**File:** `tests/server/api/categoryRules.test.ts`

**Notes:** Closed in Session 10 — `increments hits when the same keyword is learned again` calls
`/learn` twice for the same keyword and asserts `hits` goes from 1 to 2 via `GET /api/category-rules`.

---

### TC-006-05 — No suggestion when payee is unknown

**Maps to:** AC-006-05
**Type:** unit
**File:** `tests/server/api/categoryRules.test.ts`

**Notes:** Closed in Session 10 — `suggests null for a payee with no matching rule`.

---

### TC-006-06 — Keyword must be at least 3 characters to be learned

**Maps to:** AC-006-06
**Type:** unit
**File:** `tests/server/api/categoryRules.test.ts`

**Notes:** Closed in Session 10 — `does not learn a keyword shorter than 3 characters` (learns
`"ab"`, confirms no rule with that keyword is persisted).

---

### TC-006-07 — Learning accepts up to 500 entries per batch

**Maps to:** AC-006-07
**Type:** integration
**File:** `tests/server/api/categoryRules.test.ts`

**Notes:** Closed in Session 10 — `accepts a full batch of 500 entries`, mirroring the equivalent
`/api/transactions/batch` test in TEST-004/TEST-011.

---

### TC-006-08 — Invalid entries in learn batch are skipped

**Maps to:** AC-006-08
**Type:** integration
**File:** `tests/server/api/categoryRules.test.ts`

**Notes:** 🔴 **This AC does not currently hold — confirmed by a direct test.** Session 10 added a
**regression test** (`known issue: one invalid entry currently fails the entire learn-batch
instead of being skipped`) that pins the current behavior: a batch with one entry with a negative
`categoryId` alongside a valid entry returns `400` for the *entire* request, and the valid entry is
not saved either. This contradicts "that entry is skipped, valid entries in the same batch are
still processed" (same AC as TC-011-06). See `docs/architecture/ARCH-011.md` Open Questions — the
fix is to mirror `transactionsRouter.post("/batch")`'s per-item `safeParse` + filter pattern, at
which point this test should be updated to assert `learned: 1` and `400` is no longer returned.
**High risk, implementation gap still open** — not closed by this test, only pinned.
