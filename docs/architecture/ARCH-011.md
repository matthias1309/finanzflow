# ARCH-011 — Batch Transaction Import

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-011
**Verified by:** TEST-011

## Summary

The atomic-per-item batch save (`POST /api/transactions/batch`) that PDF import confirmation uses,
plus the immediately-following category-learning call. This document is the REQ-011-facing view of
the same `transactionsRouter.post("/batch", ...)` endpoint already described in
[ARCH-004](ARCH-004.md) (transaction CRUD); it exists separately because REQ-011 has its own ACs
about the batch/learn workflow as a whole, distinct from single-transaction CRUD.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `transactionsRouter.post("/batch")` | `server/routes/transactions.ts` | Batch-save endpoint (shared with any batch caller, not PDF-import-specific) |
| `batchRateLimiter` | `server/routes/transactions.ts` | 20 requests / 15 min per IP (AC-011-04) — no test-env skip |
| `categoryRulesRouter.post("/learn")` | `server/routes/categoryRules.ts` | Learning call, see [ARCH-006](ARCH-006.md) |

**Batch save semantics (AC-011-01, AC-011-02, AC-011-03)**

Already detailed in ARCH-004: each of up to 500 array items is validated independently against
`insertTransactionSchema`; valid ones are saved via a single `storage.createTransactions(valid)`
call, invalid ones are reported per-index in `errors` without failing the batch. `>500` items is
rejected wholesale with `400` before any validation runs (AC-011-03).

**Two-request workflow (AC-011-01, AC-011-05)**

The client performs the save and the learning call as two separate, sequential HTTP requests —
`POST /api/transactions/batch` followed by `POST /api/category-rules/learn` — not a single
combined endpoint. This means the two operations are **not transactionally linked**: a batch save
can succeed while the learn call fails (network blip, validation issue) with no rollback of either
step, and vice versa. Neither this REQ nor the code compensates for that; a partial "saved but not
learned" outcome degrades gracefully (worst case, categories just aren't pre-suggested next time),
which is presumably why nothing enforces atomicity across the two calls.

**Rate limiting parity (REQ-011 Notes vs. actual code)**

REQ-011's Notes state "both endpoints share the same 20-requests/15-min rate limit per IP." This
is only true for `/api/transactions/batch` (`batchRateLimiter`, 20/15min, defined in
`transactions.ts`). `categoryRulesRouter.post("/learn")` has **no dedicated rate limiter** —
it inherits only the app-wide `authRateLimiter` (10 *failed* requests/15min, `skipSuccessfulRequests:
true`, applied via `app.use(authRateLimiter)` in `createApp.ts`), which is a materially different
limit (counts only failures, and is a much stricter threshold before it engages, but engages on
any route). See Open Questions.

**Learn batch validation (AC-011-06)**

`learnEntrySchema` (ARCH-006) already caps `description` at 200 characters and requires a positive
`categoryId`; an over-length or malformed entry is dropped from `parsed.data` by
`learnBatchSchema.safeParse` acting on the *array* — Zod's array parsing here is all-or-nothing at
the schema level (`.safeParse` on the whole array), so a single invalid entry actually fails
parsing for the *entire* batch, returning `400`, rather than skipping just that entry. This
contradicts AC-011-06 ("that entry is skipped... valid entries in the same batch are still
processed") — see Open Questions, this is the same discrepancy TEST-006 flags for AC-006-08.

## Key Decisions

- **Two sequential requests instead of one combined "import" endpoint** — keeps
  `/api/transactions/batch` reusable by any batch-creation caller (not just the PDF-import flow;
  e.g. Paperless import, REQ-016, reuses it too per ARC42 §6.5) rather than coupling it to the
  category-learning side effect.
- **No cross-request atomicity between save and learn** — accepted trade-off; the alternative
  (a single endpoint doing both under one DB transaction) would couple two independently reusable
  operations and complicate the batch endpoint's reuse by REQ-016.

## Out of Scope

- Single-transaction CRUD and the `amount`/transfer validation gaps already tracked against
  `POST /api/transactions` — [ARCH-004](ARCH-004.md).
- The learning algorithm itself — [ARCH-006](ARCH-006.md).

## Open Questions

- 🔴 **AC-006-08 / AC-011-06 ("invalid entries are skipped, valid ones still processed") does not
  match the code — confirmed by a direct test, not just inferred.** `learnBatchSchema =
  z.array(learnEntrySchema).min(1).max(500)` is validated as a whole via a single
  `.safeParse(req.body)` in `categoryRulesRouter.post("/learn")`. Posting
  `[{ description: "Valid", categoryId: 1 }, { description: "Invalid", categoryId: -5 }]` returns
  `400` for the **entire request** (`{"fieldErrors":{"1":["Number must be greater than 0"]}}`) —
  the valid first entry is not saved either. Compare with
  `transactionsRouter.post("/batch")` (ARCH-004), which explicitly maps each item to its own
  `safeParse` result and filters — the pattern REQ-006/REQ-011 both describe exists in the
  transaction batch endpoint but was not applied to the learn endpoint. **High risk** — a single
  bad entry (e.g. a description that happens to exceed 200 chars) silently prevents *all* category
  learning for that import, with no partial-success feedback to the user. Logged in the Test Gap
  Backlog as a confirmed implementation gap, not just a missing test.
- **`/api/category-rules/learn` has no dedicated rate limiter**, contradicting REQ-011 Notes'
  claim that it shares `batchRateLimiter` with `/api/transactions/batch`. Either the Notes are
  wrong (learn was never meant to share the limiter) or the limiter was never added — logged as a
  **medium**-risk documentation/implementation mismatch in the Test Gap Backlog.
