# ARCH-013 — TOTP Setup, Verification and Recovery Codes

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-013
**Verified by:** TEST-013

## Summary

Describes how a user's TOTP secret is generated, confirmed, encrypted at rest, and later verified
during login, and how one-time recovery codes are issued, consumed, and regenerated. Builds on the
login/session mechanics in [ARCH-001](ARCH-001.md); admin-triggered TOTP resets are covered by
[ARCH-015](ARCH-015.md). See `docs/architecture/ARC42.md` §8.1 (Security, "TOTP step") for the
system-level description.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `generateTotpSecret`, `getTotpAuthUrl`, `verifyTotpToken`, `generateTotpCode` | `server/totp.ts` | otplib wrapper (RFC 6238) |
| `encryptSecret`, `decryptSecret` | `server/totp.ts` | AES-256-CBC encryption of the stored secret, keyed by `TOTP_ENCRYPTION_KEY` |
| `generateRecoveryCodePlaintext` | `server/totp.ts` | Random recovery-code generation |
| `requireStepUp` | `server/routes/auth.ts` | Requires a TOTP verification within the last 5 minutes before any 2FA-management operation |
| `authRouter` (`/2fa/*`, `/step-up`) | `server/routes/auth.ts` | Setup, verify-setup, regenerate-recovery, status endpoints |
| recovery-code / TOTP persistence | `server/storage.ts` (façade over `users` / `recovery_codes` tables) | Encrypted secret storage, bcrypt-hashed recovery codes, replay-protection token |

**Setup flow (AC-013-01 … AC-013-04)**

1. After password login, if `storage.getUserTotpConfigured(userId)` is false, the client routes
   the user directly into the setup flow (session already `pendingTotp`-free at this point per
   ARCH-001's "no TOTP configured" branch — `authenticated` is already `true`, so the client, not
   the server, gates access to the Dashboard until setup completes; AC-013-01).
2. `POST /api/auth/2fa/setup` (behind `requireStepUp`, which is a no-op here since TOTP isn't
   configured yet) — generates a secret via `generateTotpSecret()`, stores it as
   `totpPendingSecret` (not yet active), and returns `{ secret, otpAuthUrl }`. The client renders
   `otpAuthUrl` as a QR code and shows the Base32 secret for manual entry (AC-013-02).
3. `POST /api/auth/2fa/verify-setup` — verifies the submitted code against the *pending* secret
   with `verifyTotpToken`. On success: `storage.setUserTotpSecret` (promotes pending → active,
   encrypting via `encryptSecret`), `storage.clearUserPendingTotpSecret`, and
   `storage.generateAndStoreUserRecoveryCodes(userId)` returns 8 fresh codes in the response body
   only — never persisted in plaintext (bcrypt-hashed in `recovery_codes`) — (AC-013-03). A wrong
   code returns `400` with `"Ungültiger Code — bitte erneut versuchen"` and leaves
   `totpPendingSecret` untouched so the user can retry (AC-013-04).

**Recovery codes shown once (AC-013-05)**

The 8 plaintext codes exist only in the single `verify-setup` (or `regenerate-recovery`) HTTP
response body. `GET /api/auth/2fa/status` afterwards returns only
`recoveryCodesRemaining` (a count from `storage.getUserRecoveryCodesRemaining`), never the codes
themselves — there is no server-side plaintext copy to reveal on a second view.

**Regeneration (AC-013-06)**

`POST /api/auth/2fa/regenerate-recovery` (behind `requireStepUp`) calls the same
`storage.generateAndStoreUserRecoveryCodes(userId)`, which deletes/replaces all existing
`recovery_codes` rows for the user — old codes stop matching on the next login attempt.

**Step-up verification**

`requireStepUp` (ARCH-001 lists it under ARCH-001's shared middleware, defined in
`server/routes/auth.ts`) gates `/2fa/setup`, `/2fa/verify-setup`, and `/2fa/regenerate-recovery`:
once a user already has TOTP configured, these destructive operations need a TOTP code verified
within the last 5 minutes (`session.stepUpAt`), obtained via `POST /api/auth/step-up`. This
prevents a hijacked session cookie alone from silently taking over 2FA.

**CLI reset (AC-013-07)**

`npm run 2fa:reset -- --user <username>` runs `script/reset2fa.ts` directly against the DB
(bypassing the HTTP API entirely — no session or admin role needed, since this is an emergency
recovery path run by whoever has shell access to the server). It calls the same
`storage.resetUserTotp(id)` used by the admin-UI reset (see ARCH-015), clearing
`totpSecret`/`totpEnabled`/`totpPendingSecret` and invalidating all recovery codes for that user.
Missing `--user` prints a usage message and exits non-zero rather than guessing a target user.

**Replay protection**

Both the TOTP-verify path (`POST /api/auth/totp`, ARCH-001) and `POST /api/auth/step-up` check
`storage.getUserTotpLastUsedToken(userId) === code` before accepting a code, and record the
accepted code via `storage.setUserTotpLastUsedToken`. A code already used once (by either
endpoint) is rejected even if it is still inside its 30-second validity window.

## Key Decisions

- **AES-256-CBC at rest, not a KMS/HSM** — matches the project's self-hosted, single-tenant scale;
  the key (`TOTP_ENCRYPTION_KEY`) is an operator-managed environment variable, consistent with
  `SESSION_SECRET`/`APP_PASSWORD_HASH` handling.
- **Recovery codes hashed with bcrypt, single response only** — treats them like passwords, not
  like the TOTP secret (which must be decryptable to verify future codes); codes are opaque
  one-time tokens, so a one-way hash is sufficient and safer than reversible encryption.
- **`requireStepUp` instead of re-requiring the full password** — a fresh TOTP verification is
  already proof of possession of the second factor and is less disruptive than a full re-login,
  while still bounding the window (5 min) in which a stolen session cookie could change 2FA
  settings unchallenged.

## Out of Scope

- Password verification and session establishment — [ARCH-001](ARCH-001.md).
- Admin-triggered TOTP reset via `/api/users/:id/2fa-reset` — [ARCH-015](ARCH-015.md).

## Open Questions

None — all 7 ACs map to existing, tested behavior (see TEST-013).
