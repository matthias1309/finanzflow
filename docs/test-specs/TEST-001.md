# TEST-001 — Session-Based Authentication with Password + TOTP

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-001
**Verifies:** REQ-001 (AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-05, AC-001-06, AC-001-07, AC-001-08, AC-001-09)

## Test Cases

### TC-001-01 — Successful login with correct password and TOTP

**Maps to:** AC-001-01
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the app runs in production mode
And a user "admin" with password "secret" exists in the database
And 2FA is already set up for "admin"
And the user is on the login page
When the user enters "admin" and "secret" and submits
Then the TOTP input mask appears
When the user enters a valid 6-digit TOTP code
Then a session cookie is set
And the user is redirected to the Dashboard
```

**Notes:** Covered by `POST /api/auth/login (after 2FA is configured)` → `returns 200 and
step=totp…` combined with `Full login flow` → `grants access to protected routes after completing
both steps`. No UI redirect assertion (API-level test), which is correct per `testing-practices.md`
— the redirect itself is a client concern, covered at the E2E layer in `tests/e2e/login.spec.ts`.

---

### TC-001-02 — Wrong password is rejected

**Maps to:** AC-001-02
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the app runs in production mode
And a user "admin" with password "secret" exists in the database
And the user is on the login page
When the user enters "admin" and a wrong password
Then the user stays on the login page
And an error message "Benutzername oder Passwort falsch" is shown
And no session cookie is set
```

**Notes:** Covered by `POST /api/auth/login` → `returns 401 when password is wrong`. The test
asserts status only, not the exact error message body — see Test Gap Backlog.

---

### TC-001-03 — Wrong TOTP code is rejected

**Maps to:** AC-001-03
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the app runs in production mode
And a user "admin" with password "secret" exists in the database
And 2FA is already set up for "admin"
And the user has entered the password correctly
And the TOTP input mask is visible
When the user enters a wrong 6-digit code
Then the user stays on the TOTP input mask
And an error message "Ungültiger Code" is shown
And no session cookie is set
```

**Notes:** Covered by `POST /api/auth/totp` → `returns 401 when TOTP code is wrong`. Status only,
not the message body — see Test Gap Backlog.

---

### TC-001-04 — Login with a recovery code

**Maps to:** AC-001-04
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the app runs in production mode
And a user "admin" with password "secret" exists in the database
And 2FA is already set up for "admin"
And the user has entered the password correctly
And the TOTP input mask is visible
When the user enters a valid recovery code
Then a session cookie is set
And the user is redirected to the Dashboard
And the used recovery code is permanently invalid
```

**Notes:** Covered by `Recovery codes` → `accepts a valid recovery code in place of TOTP` +
`rejects the same recovery code a second time (single-use)`.

---

### TC-001-05 — Brute-force protection on login attempts

**Maps to:** AC-001-05
**Type:** integration
**File:** ❌ missing

**Notes:** `authRateLimiter` is explicitly disabled in `NODE_ENV=test`
(`server/auth.ts`: `skip: () => process.env.NODE_ENV === "test"`), so it cannot be exercised
through `createApp()` as tests currently configure it. No test in `tests/server/api/auth.test.ts`
or elsewhere asserts the 429 behavior.

**Status: accepted (Session 10).** Not testable without changing the test-env skip condition
(which itself risks masking other tests that rely on the bypass) — would need a dedicated
`createApp()` call that overrides the skip, similar to `pdf-rate-limit.test.ts`'s isolated-file
pattern. Left as a follow-up.

---

### TC-001-06 — Session expires

**Maps to:** AC-001-06
**Type:** integration
**File:** ❌ missing

**Notes:** No test advances or fakes session expiry and then asserts a redirect/401. The closest
existing coverage is `Session enforcement` → `rejects unauthenticated requests to protected routes
with 401`, which tests "never logged in," not "session expired."

**Status: accepted (Session 10).** Would need either a fake timer against the session store's TTL
or a short-lived test-only session config — non-trivial without touching `server/session.ts`'s
production configuration. Left as a follow-up.

---

### TC-001-07 — Explicit logout

**Maps to:** AC-001-07
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the app runs in production mode
And the user is logged in
When the user clicks "Abmelden"
Then the session is destroyed server-side
And the cookie is deleted
And the user is redirected to the login page
```

**Notes:** Covered by `POST /api/auth/logout` → `returns 200` plus `Full login flow` → `after
logout, the same session cookie no longer grants access` (proves server-side destruction, not just
a 200 response).

---

### TC-001-08 — Production start without APP_USER or APP_PASSWORD_HASH fails

**Maps to:** AC-001-08
**Type:** unit
**File:** `tests/server/unit/auth-failsecure.test.ts`

**Notes:** 🔴 **Investigated and confirmed by a Session 10 test: this AC does not hold at all —
the fail-secure check is dead code in practice.** `server/auth.ts` sets a hardcoded fallback for
`APP_PASSWORD_HASH`/`SESSION_SECRET`/`TOTP_ENCRYPTION_KEY` whenever they're missing, for *any*
`NODE_ENV !== "test"` — before the production-only fatal check even runs. So a production start
with no `APP_PASSWORD_HASH` set does not call `process.exit(1)`; it silently starts with a
publicly-known hardcoded hash. `vi.resetModules()` plus a fresh import of `server/auth.ts` (with
`process.exit` mocked) makes this testable in-process after all — the `known issue: ...` test
pins the current behavior. Same root cause as the "Hardcoded fallback secrets" item already
tracked in `docs/MIGRATION-PLAN.md` ("Out of Scope / Follow-ups"), now confirmed by a direct test
rather than code inspection alone. **High risk, implementation gap still open** — not closed by
this test, only pinned; the fix is to gate the fallback-setting block to genuine Docker dev mode
(check `DOCKER_DEPLOY === "true"`, not just `NODE_ENV !== "test"`).

---

### TC-001-09 — Development mode allows access without credentials

**Maps to:** AC-001-09
**Type:** integration
**File:** `tests/server/api/*.test.ts` (implicit, all files)

```gherkin
Given APP_PASSWORD_HASH is not set
And NODE_ENV is "development"
When the user requests a page
Then access is possible without login
```

**Notes:** Not tested by a single dedicated test, but relied upon by every non-auth API test file
(`accounts.test.ts`, `categories.test.ts`, `transactions.test.ts`, `summary.test.ts`,
`paperless.test.ts`), which all call protected endpoints via a bare `request(app)` with no login —
this only passes because `tests/server/setup.ts` leaves `APP_PASSWORD_HASH` unset. Treated as
adequately covered (D6 does not require a new dedicated test for behavior exercised end-to-end by
the existing suite), not added to the Test Gap Backlog.
