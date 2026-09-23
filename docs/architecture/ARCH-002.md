# ARCH-002 — Account Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-002
**Verified by:** TEST-002

## Summary

CRUD for bank accounts (`accounts` table). Straightforward REST resource, fully Zod-validated,
behind the global `requireAuth` gate (see [ARCH-001](ARCH-001.md)). See
`docs/architecture/ARC42.md` §5.4 (Database) for the `accounts` schema and §8.1 for
`safeCssColor()` (CSS injection prevention for the `color` field, consumed by the client).

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `accountsRouter` | `server/routes/accounts.ts` | `GET/POST/PUT/DELETE /api/accounts` |
| `insertAccountSchema` | `shared/schema.ts` | Zod validation: `color` (`hexColorSchema`), `iban` (`ibanSchema`, optional), `type` (`accountTypeSchema` enum) |
| account storage functions | `server/storage.ts` | `getAccounts`, `createAccount`, `updateAccount`, `deleteAccount` |

**Endpoints**

| Endpoint | AC | Behavior |
|---|---|---|
| `GET /api/accounts` | AC-002-07 | Returns all accounts (no pagination — dataset is small, single household) |
| `POST /api/accounts` | AC-002-01, AC-002-02, AC-002-06 | `insertAccountSchema.safeParse`; `400` with the flattened Zod error on any invalid field (name, bank, type, IBAN pattern, color pattern) |
| `PUT /api/accounts/:id` | AC-002-03, AC-002-04 | Full replace; non-numeric `id` → `400`; unknown `id` → `404` |
| `DELETE /api/accounts/:id` | AC-002-05 | Deletes the row; **does not** cascade to `transactions` (REQ-002 Notes) — `storage.deleteAccount` is a plain `DELETE FROM accounts WHERE id = ?` |

**Validation (AC-002-02, AC-002-06)**

`ibanSchema` and `hexColorSchema` (`shared/schema.ts`) are shared with every other place an IBAN
or color is accepted, so the same pattern (`^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$` for IBAN,
`#rrggbb`/`#rgb` for color) is enforced consistently, not re-implemented per route.

## Key Decisions

- **No cascade delete on transactions** — orphaned transactions are kept rather than silently
  destroying financial history; REQ-002 Notes documents this as accepted behavior, not a bug.
- **Full-replace `PUT`, not `PATCH`** — accounts have few fields and are edited as a whole via a
  single form in the UI, so a partial-update endpoint would add complexity without a real use case
  (unlike transactions, ARCH-004, which do have a dedicated `PATCH`).

## Out of Scope

- Category and transaction management — [ARCH-003](ARCH-003.md), [ARCH-004](ARCH-004.md).
- Client-side account visibility toggling on the Dashboard — [ARCH-008](ARCH-008.md).

## Open Questions

None.
