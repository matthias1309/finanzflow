# TEST-013 — Two-Factor Authentication Setup (TOTP)

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-013
**Verifies:** REQ-013 (AC-013-01, AC-013-02, AC-013-03, AC-013-04, AC-013-05, AC-013-06, AC-013-07)

## Test Cases

### TC-013-01 — User is redirected to setup after password login if 2FA is not set up

**Maps to:** AC-013-01
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the user has entered username and password correctly
And 2FA is not yet configured for this user
Then the user is redirected directly to the TOTP setup flow
And can only reach the Dashboard after completing setup
```

**Notes:** Covered indirectly by `POST /api/auth/login` → `returns 200 and step=done when
credentials are correct and 2FA is not configured` — the `step: "done"` response is exactly the
signal the client uses to route into setup rather than the Dashboard (client-side routing itself
is out of scope for an API test).

---

### TC-013-02 — Setup flow — QR code is shown

**Maps to:** AC-013-02
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the user clicks "2FA jetzt einrichten"
Then a setup dialog opens
And a QR code is shown that can be scanned with an authenticator app
And the manual entry key (Base32) is also visible
```

**Notes:** Covered by `POST /api/auth/2fa/setup` → `returns a secret and an otpAuthUrl` (asserts
`secret` string + `otpAuthUrl` matching `^otpauth://totp/`). QR-code *rendering* from that URL is a
client-side concern, not re-tested at the API layer.

---

### TC-013-03 — Setup verification succeeds

**Maps to:** AC-013-03
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the user has scanned the QR code with their authenticator app
When the user enters a valid 6-digit TOTP code and confirms
Then 2FA is activated
And 8 recovery codes are shown
And a notice explains that these codes are shown only once
```

**Notes:** Covered by `POST /api/auth/2fa/setup` → `activates 2FA and returns 8 recovery codes
when a valid code is submitted`. The "shown only once" notice is a UI-copy concern, not
API-testable.

---

### TC-013-04 — Setup verification fails

**Maps to:** AC-013-04
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the user has scanned the QR code
When the user enters a wrong 6-digit code
Then the setup dialog stays open
And an error message "Ungültiger Code — bitte erneut versuchen" is shown
And 2FA is not activated
```

**Notes:** Covered by `POST /api/auth/2fa/setup` → `returns 400 when an invalid code is submitted
to verify-setup`. Status only, not the exact message body, and does not separately assert that
`totpEnabled` stays `0` afterward — see Test Gap Backlog.

---

### TC-013-05 — Recovery codes are shown only once

**Maps to:** AC-013-05
**Type:** integration
**File:** ❌ missing

**Notes:** No test calls `GET /api/auth/2fa/status` immediately after setup and asserts the
response body has no `recoveryCodes` field (only `recoveryCodesRemaining`). By design the server
never returns plaintext codes outside the single setup/regenerate response (ARCH-013), but this
absence-of-field guarantee is not explicitly asserted. See Test Gap Backlog.

---

### TC-013-06 — Regenerate recovery codes

**Maps to:** AC-013-06
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given the user is logged in and 2FA is active
When the user clicks "Recovery-Codes neu generieren" in the Dashboard
And confirms the action in a confirmation dialog
Then 8 new recovery codes are shown
And all old recovery codes are permanently invalid
```

**Notes:** Covered by `POST /api/auth/2fa/regenerate-recovery` → `returns 8 new recovery codes`
and `invalidates old recovery codes after regeneration`.

---

### TC-013-07 — Reset 2FA via CLI

**Maps to:** AC-013-07
**Type:** unit
**File:** ❌ missing

**Notes:** `script/reset2fa.ts` is a standalone CLI script (not imported by `createApp()`), so it
is not exercised by the API test suite. The equivalent server-side effect (`storage.resetUserTotp`)
*is* covered indirectly via `POST /api/users/:id/2fa-reset` in `tests/server/api/users.test.ts`,
but the CLI entry point itself — argument parsing, the `--user`-missing usage message — has no
test. See Test Gap Backlog.
