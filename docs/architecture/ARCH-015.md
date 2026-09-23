# ARCH-015 — Multi-User Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-015
**Verified by:** TEST-015

## Summary

Describes user CRUD, role management, password administration, and env-var seeding for
FinanzFlow's shared-dataset multi-user model. Builds on [ARCH-001](ARCH-001.md) (session +
`requireAdmin`) and [ARCH-013](ARCH-013.md) (TOTP lifecycle, reused here for admin-triggered
resets). See `docs/architecture/ARC42.md` §8.1 and ADR-008 ("Multi-user management with shared
dataset") for the system-level rationale.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `usersRouter` | `server/routes/users.ts` | `/api/users/*` endpoints |
| `requireAdmin` | `server/auth.ts` | Guards all `/api/users/*` routes except the password-change one (ARCH-001) |
| `toPublic` | `server/routes/users.ts` | Strips `passwordHash`/`totpSecret`/`totpPendingSecret`/`totpLastUsedToken` from API responses |
| `createUserSchema`, `updateUserSchema`, `changePasswordSchema` | `shared/schema.ts` | Zod validation (min. 8-char password) |
| user storage functions | `server/storage.ts` | `getUsers`, `createUser`, `updateUser`, `updateUserPassword`, `deleteUser`, `countAdmins`, `resetUserTotp` |
| env sync at startup | `server/db.ts` (seeding on module load) | Upserts the `APP_USER`/`APP_PASSWORD_HASH` admin |

**Endpoints (all under `requireAdmin` except the password one)**

| Endpoint | AC | Behavior |
|---|---|---|
| `GET /api/users` | AC-015-01 | Lists all users via `toPublic` (no secrets) |
| `POST /api/users` | AC-015-02, AC-015-03 | Zod-validates, checks `storage.getUserByUsername` for a duplicate (`409`), else `bcrypt.hashSync` + `storage.createUser` (`isAdmin` defaults to `0`, TOTP unset → `201`) |
| `PATCH /api/users/:id` | AC-015-04, AC-015-05, AC-015-06 | Toggles `isAdmin`; refuses (`409`) when demoting would leave `storage.countAdmins() < 1` |
| `DELETE /api/users/:id` | AC-015-07, AC-015-08 | Refuses (`409`) when deleting the last admin; otherwise `storage.resetUserTotp` + `storage.deleteUser` → `204` |
| `PATCH /api/users/:id/password` | AC-015-09, AC-015-10, AC-015-11 | No `requireAdmin` — any authenticated user may call it for **any** `id`, but an `oldPassword` is only checked when supplied (admin flow omits it; self-service flow with `oldPassword` set returns `401` on mismatch, AC-015-11) |
| `POST /api/users/:id/2fa-reset` | AC-015-13 | `requireAdmin`; delegates to `storage.resetUserTotp(id)` — the same function the CLI reset (ARCH-013, AC-013-07) uses |

**Last-admin protection (AC-015-06, AC-015-08)**

Both the demote path (`PATCH .../:id`) and the delete path (`DELETE .../:id`) call
`storage.countAdmins()` and refuse the operation with `409` if it would leave zero admins. This is
enforced server-side on every request, not just in the UI (`security.md` "Broken Access Control").

**Regular-user restriction (AC-015-12)**

`/users` is a client-side route; the server-side guarantee is that every `/api/users/*` GET/POST/
PATCH(role)/DELETE call is behind `requireAdmin` (`403` for non-admins). The client redirects a
`403` response away from the page; the exact redirect/toast behavior is a frontend concern not
re-specified here.

**Env sync at startup (AC-015-14, AC-015-15)**

On every server start, `server/db.ts` upserts a user row for `APP_USER` with
`passwordHash = APP_PASSWORD_HASH` and `isAdmin = 1` — creating it if absent (AC-015-14) or
updating the password hash if the username already exists (AC-015-15), leaving `isAdmin` at `1`
either way. `server/env-init.ts` supplies Docker-dev-mode defaults for `APP_PASSWORD_HASH` /
`SESSION_SECRET` / `TOTP_ENCRYPTION_KEY` / `APP_USER` / `APP_ORIGIN` before this runs, so the sync
always has a value to work with outside strict production (ARCH-001 covers the production
fail-fast path).

**New-user TOTP onboarding (AC-015-16)**

A newly created user has no `totpSecret`; the first successful password login for that user
follows the "no TOTP configured" branch in ARCH-001's login sequence and is routed into the setup
flow described in ARCH-013 (AC-013-01) before reaching the Dashboard.

## Key Decisions

- **Integer user IDs in the API, not usernames** (REQ-015 Notes) — avoids path-encoding issues for
  usernames with special characters and decouples the API contract from a mutable field.
- **`resetUserTotp` shared between the admin-UI reset and the CLI emergency reset** — one code
  path for "wipe this user's 2FA state," reducing the risk of the two diverging.
- **Password-change endpoint has no `requireAdmin`** — by design, so a non-admin user can change
  their own password (AC-015-10); authorization instead relies on the caller only being able to
  reach their own session-authenticated flows in the client. See Open Questions below.

## Out of Scope

- TOTP setup/verification mechanics themselves — [ARCH-013](ARCH-013.md).
- Session establishment and `requireAuth`/`requireAdmin` middleware internals — [ARCH-001](ARCH-001.md).

## Open Questions

- **Session invalidation (AC-015-07, AC-015-09, AC-015-13) is not implemented.** All three ACs
  state "all active sessions of the affected user are invalidated" after an admin deletes a user,
  resets their password, or resets their TOTP. `server/routes/users.ts` calls only
  `storage.resetUserTotp` / `storage.updateUserPassword` / `storage.deleteUser` — none of these,
  nor the route handlers, touch the session store (`server/session.ts`'s `MemoryStore` instance is
  never referenced outside `sessionMiddleware` setup). A user whose password or TOTP was reset by
  an admin therefore keeps any already-authenticated session until it naturally expires
  (`SESSION_MAX_AGE_HOURS`, default 8h). Logged in the Test Gap Backlog below as a **high-risk**
  implementation gap, not just a missing test — per D6, this retrofit session documents it rather
  than fixing it.
- **`PATCH /api/users/:id/password` accepts any `id` while only authenticated (not per-caller
  scoped).** REQ-015's Notes say "a user may only use their own ID," but the route handler itself
  does not check `req.session.userId === id` — it relies entirely on the client only ever calling
  it with the caller's own ID. Any authenticated user (not just an admin) can currently change
  *any* user's password without `oldPassword` by calling this endpoint with another user's `id`.
  Logged in the Test Gap Backlog as a **high-risk** access-control gap.
