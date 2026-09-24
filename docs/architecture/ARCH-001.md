# ARCH-001 — Session-Based Authentication with Password + TOTP

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-001
**Verified by:** TEST-001

## Summary

FinanzFlow is protected by a two-step login: password, then TOTP (when configured for the user).
A successful login establishes a server-side session; `requireAuth` guards every protected route
on that session. This document describes the login/session mechanics implemented in
`server/auth.ts` and `server/routes/auth.ts`. The TOTP setup/management flow itself is covered by
[ARCH-013](ARCH-013.md); multi-user storage and admin operations are covered by
[ARCH-015](ARCH-015.md).

See `docs/architecture/ARC42.md` §8.1 (Security) for the system-level description and §6.1 (User
Login) for the sequence diagram this design implements; ADR-007 records the decision to replace
HTTP Basic Auth with this flow.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `authRateLimiter` | `server/auth.ts` | Brute-force protection on `/api/auth/login` (AC-001-05) |
| `requireAuth` | `server/auth.ts` | Session-gate middleware for all protected `/api` routes |
| `requireAdmin` | `server/auth.ts` | Session-gate + `isAdmin` check (used by REQ-015 routes) |
| `safeStringEqual` | `server/auth.ts` | Constant-time comparison helper (currently unused by the bcrypt-based login path; kept for other secret comparisons) |
| `authRouter` | `server/routes/auth.ts` | `/api/auth/*` endpoints: login, totp, logout, status, me, step-up |
| fail-secure startup checks | `server/auth.ts` (module top level) | Refuses to start in production without `APP_PASSWORD_HASH` / `SESSION_SECRET` / `TOTP_ENCRYPTION_KEY` (AC-001-08) |

**Login sequence**

1. `POST /api/auth/login` — `authRateLimiter` first, then Zod-equivalent presence check on
   `username`/`password` (400 if missing, AC-001-02's precondition). User is looked up via
   `storage.getUserByUsername`; password compared with `bcrypt.compareSync` against the stored
   hash (or `APP_PASSWORD_HASH` for the Docker-mode default user). Wrong credentials → `401`
   (AC-001-02).
   - If the user has no TOTP configured: `session.authenticated = true` immediately, response
     `{ step: "done" }` (AC-001-01's dev/no-2FA branch, and AC-013-01's precondition).
   - If TOTP is configured: `session.userId` set, `session.pendingTotp = true`,
     `session.authenticated = false`, response `{ step: "totp" }`.
2. `POST /api/auth/totp` — requires `session.pendingTotp`; accepts either a valid TOTP code
   (`verifyTotpToken`, see ARCH-013) or a valid recovery code
   (`storage.verifyAndConsumeUserRecoveryCode`, single-use). On success:
   `session.authenticated = true` (AC-001-01, AC-001-04). Wrong code → `401` (AC-001-03).
3. `requireAuth` — checks `session.authenticated === true` on every subsequent request to a
   protected route; `401` otherwise (AC-001-06 after session expiry, since an expired session has
   no `authenticated` flag).
4. `POST /api/auth/logout` — `session.destroy()` + `clearCookie("connect.sid")` (AC-001-07).

**Auth bypass in development/test**

`requireAuth`/`requireAdmin`/`authRouter` all read `PASSWORD_HASH` (module-level constant from
`APP_PASSWORD_HASH`) once at import time. When unset — which is the default outside
`NODE_ENV=production`, and forced empty in `NODE_ENV=test` (`tests/server/setup.ts`) — every check
short-circuits to `next()`/`{ step: "done" }` (AC-001-09). This is intentional (see
`CLAUDE.md` "Architecture Notes") and lets Vitest/Supertest hit routes without a login flow.

**Fail-secure startup**

At module load, if `NODE_ENV === "production"` (Docker or not), `server/auth.ts` validates
`APP_PASSWORD_HASH`, `SESSION_SECRET` (≥32 chars) and `TOTP_ENCRYPTION_KEY` (64 hex chars) are
present; any missing/invalid value calls `process.exit(1)` with an actionable message (AC-001-08).
`server/auth.ts` never sets a fallback value itself — defaults exist only in
`server/env-defaults.ts`, gated to `NODE_ENV === "development"`, and are generated at process
start (`crypto.randomBytes`) rather than fixed literals, so there is no longer a shared secret
value in the repository for a misconfigured production start to fall back to (fixed Session 12,
GitGuardian alert; previously tracked as a 🔴 follow-up in `docs/MIGRATION-PLAN.md`).

**Session configuration**

Session cookie flags and TTL are set in `server/session.ts` (`httpOnly`, `SameSite=Lax` — the REQ
text says `Strict`, see Notes below — `Secure` only in real production, TTL from
`SESSION_MAX_AGE_HOURS` or the 8h default). The session store is `memorystore` (in-process,
non-persistent) as documented in ARC42 §8.1.

## Key Decisions

- **Session-based, not JWT** — superseded HTTP Basic Auth (ADR-002) with server-side sessions
  (ADR-007) so that logout and step-up re-verification can actively invalidate access; a stateless
  JWT would need a revocation list to do the same.
- **Bcrypt over the previous SHA-256 comparison** — fixed as part of the Session 2 lint cleanup
  (`.claude/rules/learnings.md`, "Lint findings uncover real bugs"); `safeStringEqual` remains
  available for any future non-bcrypt secret comparison but the login path itself now relies on
  `bcrypt.compareSync`'s own timing-attack resistance.
- **Auth bypass keyed off `APP_PASSWORD_HASH` presence, not `NODE_ENV` alone** — lets Docker dev
  mode set a real (default) hash and still exercise the full login flow, while local `npm run dev`
  and `NODE_ENV=test` skip it entirely.

## Out of Scope

- TOTP setup, verification, and recovery-code lifecycle — [ARCH-013](ARCH-013.md).
- User creation/deletion, admin role management, password reset by an admin — [ARCH-015](ARCH-015.md).

## Open Questions

- REQ-001's session configuration note states `SameSite=Strict`, but `server/routes/auth.ts` sets
  `SameSite=Lax` on every login response. This is a REQ/code mismatch, not a missing test — logged
  as a documentation follow-up rather than a Test Gap (no AC asserts the `SameSite` value).
