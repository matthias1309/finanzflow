# ARCH-003 — Category Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-003
**Verified by:** TEST-003

## Summary

CRUD for income/expense categories (`categories` table), including the 14 default categories
seeded at startup and the built-in "Kontoübertrag" transfer category. See
`docs/architecture/ARC42.md` §5.4 (Database) for the schema.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `categoriesRouter` | `server/routes/categories.ts` | `GET/POST/PUT/DELETE /api/categories` |
| `insertCategorySchema` | `shared/schema.ts` | Zod validation: `color` (`hexColorSchema`), `type` (`categoryTypeSchema` — `"income" \| "expense"`) |
| category storage functions | `server/storage.ts` | `getCategories`, `createCategory`, `updateCategory`, `deleteCategory` |
| default-category seed | `server/db.ts` | Inserts the 14 default categories (incl. "Kontoübertrag") on first start, idempotently |

**Endpoints**

| Endpoint | AC | Behavior |
|---|---|---|
| `GET /api/categories` | AC-003-07 | Returns all categories (income + expense together); the client splits them by `type` for the two-column layout |
| `POST /api/categories` | AC-003-01, AC-003-02, AC-003-06 | `insertCategorySchema.safeParse`; `400` on missing name / invalid type / invalid color |
| `PUT /api/categories/:id` | AC-003-03, AC-003-04 | Full replace; unknown `id` → `404`, non-numeric `id` → `400` |
| `DELETE /api/categories/:id` | AC-003-05 | Deletes the row |

**Type reclassification (REQ-003 Notes)**

Changing a category's `type` (income ↔ expense) via `PUT` does not touch the `type` field on
transactions already referencing that `categoryId` — `transactions.type` is set independently at
creation time (ARCH-004) and is the sign-determining field, not `categories.type`. This is
intentional per REQ-003 Notes, not a bug: a transaction's income/expense classification survives a
later category relabeling.

## Key Decisions

- **`type` lives on both `categories` and `transactions`, independently** — decouples "what kind
  of category is this" from "what kind of transaction is this," so recategorizing a category's
  type is a display-only concern that never silently changes historical transaction amounts' sign
  semantics.
- **No server-side protection against deleting a category still referenced by transactions** —
  consistent with ARCH-002's no-cascade decision on accounts; `categoryId` on transactions is
  nullable, so a deleted category's transactions become uncategorized rather than orphaned/broken.

## Out of Scope

- Account management — [ARCH-002](ARCH-002.md).
- Transaction category assignment and the "Kontoübertrag" special-casing for transfers —
  [ARCH-004](ARCH-004.md).
- Category-rule learning (keyword → category suggestions) — REQ-006, not part of this migration
  session.

## Open Questions

None.
