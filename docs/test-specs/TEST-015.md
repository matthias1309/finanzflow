# TEST-015 — Multi-User Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-015
**Verifies:** REQ-015 (AC-015-01, AC-015-02, AC-015-03, AC-015-04, AC-015-05, AC-015-06, AC-015-07, AC-015-08, AC-015-09, AC-015-10, AC-015-11, AC-015-12, AC-015-13, AC-015-14, AC-015-15, AC-015-16)

## Test Cases

### TC-015-01 — Admin sees the user list

**Maps to:** AC-015-01
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And at least one other user "lisa" exists
When the admin opens the page "/users"
Then a list of all users is shown
And username, admin status, and TOTP status are visible for each user
```

**Notes:** Covered by `GET /api/users` → `returns 200 with an array containing the seeded admin`,
`seeded admin has isAdmin=1`, and `does not include passwordHash or totpSecret in response` (the
last one also verifies the API never leaks secrets, beyond what the AC itself asks for).

---

### TC-015-02 — Admin creates a new user

**Maps to:** AC-015-02
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
When the admin clicks "Benutzer anlegen"
And enters username "lisa" and an initial password
And submits the form
Then "lisa" appears in the user list
And "lisa" has no admin rights
And TOTP is not yet set up for "lisa"
```

**Notes:** Covered by `POST /api/users` → `creates a new user and returns 201` (asserts
`isAdmin: 0`, `totpEnabled: 0`).

---

### TC-015-03 — Username is already taken

**Maps to:** AC-015-03
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And a user "lisa" already exists
When the admin tries to create another user named "lisa"
Then the form stays open
And an error message "Benutzername bereits vergeben" is shown
```

**Notes:** Covered by `POST /api/users` → `returns 409 when username is already taken`. Status
only, not the exact message body — see Test Gap Backlog.

---

### TC-015-04 — Admin grants admin rights

**Maps to:** AC-015-04
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And a user "lisa" without admin rights exists
When the admin enables the admin status for "lisa"
Then "lisa" has admin rights
And can open the page "/users"
```

**Notes:** Covered by `PATCH /api/users/:id` → `grants admin rights to a user and returns 200`.
"Can open /users" is a client-routing consequence of `isAdmin`, not re-tested here.

---

### TC-015-05 — Admin revokes admin rights

**Maps to:** AC-015-05
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And a user "lisa" with admin rights exists
And at least one other admin exists
When the admin disables the admin status for "lisa"
Then "lisa" no longer has admin rights
```

**Notes:** Covered by `PATCH /api/users/:id` → `revokes admin rights when another admin exists`.

---

### TC-015-06 — Last admin cannot be downgraded

**Maps to:** AC-015-06
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And "admin" is the only admin
When the admin tries to revoke their own admin status
Then the admin status remains unchanged
And an error message "Letzter Admin kann nicht degradiert werden" is shown
```

**Notes:** Covered by `PATCH /api/users/:id` → `returns 409 when trying to demote the last admin`.
Does not separately re-fetch and assert `isAdmin` is still `1` afterward, and status only for the
message — see Test Gap Backlog.

---

### TC-015-07 — Admin deletes a user

**Maps to:** AC-015-07
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And a user "lisa" exists
When the admin clicks "Löschen" for "lisa"
And confirms the action in the confirmation dialog
Then "lisa" is no longer in the user list
And all active sessions of "lisa" are invalidated
```

**Notes:** `DELETE /api/users/:id` → `deletes a non-admin user and returns 204` covers "no longer
in the user list." Session invalidation is **not implemented in code** (see ARCH-015 Open
Questions) and consequently not tested — flagged as a high-risk gap in the Test Gap Backlog, not
just a missing test.

---

### TC-015-08 — Last admin cannot be deleted

**Maps to:** AC-015-08
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And "admin" is the only admin
When the admin tries to delete themselves
Then an error message "Letzter Admin kann nicht gelöscht werden" is shown
And the user is preserved
```

**Notes:** Covered by `DELETE /api/users/:id` → `returns 409 when trying to delete the last
admin`. Does not separately re-fetch and assert the admin is still present — implied by the `409`
(delete did not proceed) but not directly re-verified. Status only for the message.

---

### TC-015-09 — Admin sets another user's password

**Maps to:** AC-015-09
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And a user "lisa" exists
When the admin sets a new password for "lisa"
Then "lisa" can log in with the new password
And all active sessions of "lisa" are invalidated
```

**Notes:** `PATCH /api/users/:id/password` → `sets a new password without oldPassword (admin
flow) and returns 200` covers the write itself but does not verify the new password actually logs
in. Session invalidation is **not implemented in code** (ARCH-015 Open Questions) — high-risk gap
in the Test Gap Backlog.

---

### TC-015-10 — User changes their own password successfully

**Maps to:** AC-015-10
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given "lisa" is logged in
When "lisa" enters the old and new password in the profile dropdown and confirms
Then the new password is active
And the current session is preserved
```

**Notes:** Covered by `PATCH /api/users/:id/password` → `changes password when oldPassword is
correct`. Run through `adminSession` rather than a genuine non-admin "lisa" session (the route has
no `requireAdmin`, so this is behaviorally equivalent), but "current session is preserved" after
the change is not explicitly re-asserted (no follow-up request on the same agent). See Test Gap
Backlog.

---

### TC-015-11 — User changes their own password — wrong old password

**Maps to:** AC-015-11
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given "lisa" is logged in
When "lisa" enters a wrong old password
Then the form stays open
And an error message "Aktuelles Passwort falsch" is shown
```

**Notes:** Covered by `PATCH /api/users/:id/password` → `returns 401 when oldPassword is provided
but wrong`. Status only, not the exact message body.

---

### TC-015-12 — Regular user has no access to /users

**Maps to:** AC-015-12
**Type:** integration
**File:** `tests/server/api/users.test.ts`

**Notes:** Closed in Session 10 — `Access control for non-admin users` logs in as a genuine
non-admin user and asserts `403` on `GET /api/users`, `POST /api/users`, and
`DELETE /api/users/:id`.

🔴 The same describe block also adds a **regression test** for the related gap on
`PATCH /api/users/:id/password`: `known issue: a non-admin user can currently change another
user's password (no ownership check)` confirms a non-admin session can `PATCH` another user's
password and get `200` — that route is intentionally *not* `requireAdmin` (so users can change
their own password), but nothing checks the caller owns `:id`. See `docs/architecture/ARCH-015.md`
Open Questions. **High risk, implementation gap still open** — the test pins current behavior, it
does not close the gap; update it to assert `403` once the ownership check is added.

---

### TC-015-13 — Admin resets a user's TOTP

**Maps to:** AC-015-13
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given the app runs in production mode
And an admin user "admin" is logged in
And a user "lisa" has TOTP set up
When the admin clicks "2FA zurücksetzen" for "lisa"
And confirms the action in the confirmation dialog
Then TOTP is disabled for "lisa"
And all of "lisa"'s recovery codes are invalid
And "lisa" is guided through the TOTP setup flow on the next login
And all active sessions of "lisa" are invalidated
```

**Notes:** `POST /api/users/:id/2fa-reset` → `returns 200 and resets TOTP state for a user` covers
`totpEnabled: 0` afterward, but the target user in that test never had TOTP configured in the
first place ("Given a user 'lisa' has TOTP set up" is not actually arranged) — see Test Gap
Backlog. Recovery-code invalidation and session invalidation are not asserted; session
invalidation is not implemented (ARCH-015 Open Questions) — high-risk gap.

---

### TC-015-14 — Env sync at startup — user does not exist yet

**Maps to:** AC-015-14
**Type:** integration
**File:** `tests/server/api/users.test.ts`

```gherkin
Given APP_USER is set to "admin"
And APP_PASSWORD_HASH is set to a valid bcrypt hash of "secret"
And no user named "admin" exists in the DB
When the server starts
Then a user "admin" with isAdmin=true is created in the DB
And the password hash matches APP_PASSWORD_HASH
```

**Notes:** Covered by `Seeding: ENV-Sync beim Serverstart` → `seed-Admin existiert in der
users-Tabelle` (existence + `isAdmin`) and `seed-Admin hat den korrekten Passwort-Hash aus
APP_PASSWORD_HASH` (login proves the hash matches). The "does not exist yet" precondition is
implicit in the `:memory:` per-file DB (`tests/server/setup.ts`), not separately arranged.

---

### TC-015-15 — Env sync at startup — existing user's password is preserved

**Maps to:** AC-015-15
**Type:** integration
**File:** `tests/server/unit/db-seeding.test.ts`

**Notes:** Reworked 2026-09-25 (bug fix — the env-sync used to overwrite an existing user's
password hash from `APP_PASSWORD_HASH` on every restart, silently reverting UI-set passwords for
that user). The seeding logic in `server/db.ts` runs at module top-level, not inside `createApp()`,
so testing "restart with a different hash" needs a real temp-file DB (not `:memory:`) plus
`vi.resetModules()` to force two separate imports of `db.ts` against the same file —
`preserves an existing seed user's password hash on the next start` does exactly that and asserts
the row's `passwordHash` still matches the *first* hash (not `APP_PASSWORD_HASH`'s new value)
while `isAdmin` stays `1`.

---

### TC-015-16 — New user is guided through TOTP setup on first login

**Maps to:** AC-015-16
**Type:** integration
**File:** `tests/server/api/auth.test.ts`

```gherkin
Given "lisa" was newly created and TOTP is not yet set up
When "lisa" logs in successfully with username and password
Then "lisa" is redirected directly to the TOTP setup flow (see REQ-013)
And can only reach the Dashboard after completing TOTP setup
```

**Notes:** Same underlying behavior as TC-013-01 (`step: "done"` on password success when TOTP is
unset is the general case, not admin-specific) — no test creates a user via `POST /api/users` and
then separately drives its first login. Covered in spirit, not literally, by the existing admin
login tests. Not added as a separate Test Gap Backlog entry (low risk — same code path as
TC-013-01, which is covered).
