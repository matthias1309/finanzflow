# ARCH-006 — Automatic Category Suggestion (Learning System)

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-006
**Verified by:** TEST-006

## Summary

A keyword → category learning system: confirmed PDF-import categorizations are stored as
`category_rules` (`keyword`, `categoryId`, `hits`), and future imports get a category
pre-suggested by longest-substring match. Consumed by [ARCH-005](ARCH-005.md) (suggestion at
upload time) and triggered by [ARCH-011](ARCH-011.md) (`POST /api/category-rules/learn` on
confirm). See `docs/architecture/ARC42.md` §6.4.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `categoryRulesRouter` | `server/routes/categoryRules.ts` | `GET /api/category-rules`, `POST /api/category-rules/learn` |
| `learnEntrySchema` / `learnBatchSchema` | `server/routes/categoryRules.ts` | Zod: `description` (1–200 chars, trimmed), `categoryId` (positive int), batch 1–500 entries |
| `storage.suggestCategory` | `server/storage.ts` | Longest-substring match over all stored keywords, ties broken by `hits` |
| `storage.learnCategoryRules` | `server/storage.ts` | Upsert per entry: increment `hits` + update `categoryId` if keyword exists, else insert with `hits = 1` |
| `extractKeyword` (private) | `server/storage.ts` | Keyword extraction from a description |

**Keyword extraction (`extractKeyword`, AC-006-06)**

1. Lowercase and trim the description.
2. Split on `" – "` or `" - "`, take the left side (the payee name, when the description has a
   payee/purpose separator).
3. Take the first whitespace-delimited token; if it's ≥ 4 characters, use it as the keyword.
4. Otherwise, fall back to the first 30 characters of the payee portion.
5. `learnCategoryRules` discards the result if it's still `< 3` characters (AC-006-06) — no rule
   is created for a too-short keyword.

**Suggestion algorithm (`suggestCategory`, AC-006-01, AC-006-02, AC-006-05)**

Linear scan over every stored `category_rules` row: for each rule whose `keyword` is a substring
of the lowercased description, track the best match by `(keyword.length, hits)` — longer keyword
wins outright, equal-length ties go to the rule with more `hits`. No match → `null`, and the
client leaves the category field empty (AC-006-05).

**Learning trigger and override (AC-006-03, AC-006-04)**

`learnCategoryRules` learns from *whatever entries the client sends* — it has no concept of "was
this auto-suggested" or "was it overridden." That distinction is entirely client-side: the import
preview UI tracks per-row whether the category came from `suggestedCategoryId` untouched or was
manually changed, and — per AC-005-09/AC-006-03 — only sends entries for rows the user did **not**
override to `POST /api/category-rules/learn`. The server-side contract is simply "learn these
`(description, categoryId)` pairs"; the "don't learn overridden categories" business rule lives in
the client, not in `learnCategoryRules` or the route.

## Key Decisions

- **Substring matching, not tokenized/fuzzy matching** — keeps `suggestCategory` O(n) over stored
  rules with no external NLP dependency, appropriate for a single-household dataset size; longest-
  match-wins gives predictable, explainable suggestions (a more specific keyword like "REWE Markt"
  correctly beats the more general "REWE").
- **Upsert on keyword, not append-only history** — a keyword maps to exactly one current category;
  if the user recategorizes payments from the same payee differently later, the rule's category is
  simply overwritten (with `hits` still incrementing) rather than accumulating conflicting rules.
- **Learning is opt-in per confirmed PDF import only** (REQ-006 Notes) — manual transaction entry
  never calls `/learn`, keeping the learned rule set representative of actual payee categorization
  patterns rather than one-off manual corrections.

## Out of Scope

- PDF parsing and where `suggestedCategoryId` is attached to a preview row — [ARCH-005](ARCH-005.md).
- The batch save and the client's decision of *which* entries to send to `/learn` —
  [ARCH-011](ARCH-011.md); the "override clears the sparkles icon" UI behavior is a frontend
  concern this document does not re-specify.

## Open Questions

- **`docs/architecture/ARC42.md` §6.4 describes `extractKeyword` incorrectly.** It states the
  function "strips common German stopwords (bei, von, für, an, …)" — no such stopword list exists
  in `server/storage.ts`; the actual logic is the payee-split / first-token rule described above.
  This is a stale ARC42 description, not a code bug — flagged for a documentation fix (out of
  scope for this retrofit, which derives ARCH from the *code*, not from ARC42, precisely to avoid
  propagating this kind of drift).
- **No test exists for `storage.suggestCategory` or `storage.learnCategoryRules` at all** — neither
  a direct unit test (extraction logic, longest-match tie-breaking) nor an API test through
  `categoryRulesRouter`. See Test Gap Backlog.
