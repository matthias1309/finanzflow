# Project Learnings

This document grows with the project. New insights are captured with `/capture-learning`.
Claude reads this file every session and factors the entries into suggestions and decisions.

**Format:**
```
## YYYY-MM-DD — Short title
**Context:** When/where was this noticed?
**Learning:** What did we learn?
**Action:** What do we change or watch out for going forward?
```

---

## Known Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| Grey page in the browser (dev) | CSP blocks Vite Fast Refresh | Dev-only `unsafe-inline` + `unsafe-eval` in CSP — already configured |
| Empty dashboard after deploy | `VITE_API_BASE` missing at build time | Rebuild with both env vars set |
| `EADDRINUSE` on port 5000 | macOS AirPlay Receiver (ControlCenter) | `PORT=3000 npm run dev` |
| `import.meta` warning in build | esbuild CJS bundle + `import.meta.url` in `pdfParser.ts` | Harmless — dead code in the CJS path |
| `._` files in tar.gz | macOS `tar` writes metadata | `COPYFILE_DISABLE=1 tar …` |
| `ERR_REQUIRE_ESM` on start | `@noble/hashes` or `@scure/base` v2 in the lockfile | Check `overrides` in `package.json`; do not upgrade `otplib` to v13 |
| `better-sqlite3` native binding missing | No prebuilt binary for very new Node majors | Use the Node version from `.nvmrc` (22) and a fresh `npm install` |
| Random 401/404 in API tests on macOS, only in the full suite | supertest `request(app)` ephemeral-port collision between parallel Vitest processes (`::` vs `127.0.0.1`) | Fixed: API tests use `listenOnLoopback()` (`tests/server/loopbackServer.ts`) — never `request(app)` |
| `npm run build` fails locally on macOS | esbuild tries to bundle the optional `fsevents` `.node` binary | Pre-existing; Docker (Linux) build unaffected — see migration plan follow-ups |

---

<!-- Entries are appended here chronologically -->

## 2026-09-23 — Secrets were committed to the public repo
**Context:** Migration planning found `sankey-finance/secrets.env` (containing `SESSION_SECRET`,
`TOTP_ENCRYPTION_KEY`, `APP_PASSWORD_HASH`) tracked in the public GitHub repo. It was removed from
tracking in Session 0 (PR #5); git history was not purged. The same values also appeared as
"example" values in `DEPLOYMENT.md` and as hardcoded fallbacks in `server/auth.ts`,
`server/env-init.ts`, and `server/env-defaults.ts`.
**Learning:** A secret committed once lives on in history, docs, and copy-pasted defaults. Example
values in docs get copied into real `.env` files.
**Action:** Rotate the credentials on the Pi (manual, open). Docs use placeholders only. Never add
secret values to code, docs, or `.claude/settings*.json` permission entries. Removing the hardcoded
fallback secrets from server code is tracked as a follow-up in `docs/MIGRATION-PLAN.md`.

## 2026-09-23 — Lint findings uncover real bugs
**Context:** Session 2 (quality baseline) fixed 43 ESLint errors.
**Learning:** An unused-variable warning in `Users.tsx` revealed a redundant second `DELETE` request
in an error handler. Earlier, a "tests always fail" symptom hid a login bug (SHA-256 vs. bcrypt).
**Action:** Treat lint and test failures as signals, not noise — investigate before silencing.

## 2026-09-24 — Reading code against Gherkin ACs finds real bugs
**Context:** ARCH/TEST-SPEC retrofit (migration Sessions 5–10) for 16 already-shipped REQs.
**Learning:** Writing an ARCH by walking the code against every AC — and running a throwaway test
when an AC looked doubtful — confirmed about ten implementation bugs the existing tests never
touched (negative amounts accepted, learn-batch all-or-nothing, no ownership check on password
change, production fail-fast never firing, …). The tests only covered what the code did, not
what the REQ promised.
**Action:** When touching an existing feature, verify its ACs against the code, not just the
tests. A doubtful AC gets a quick direct test before it is documented as "covered".

## 2026-09-24 — Pin confirmed bugs with `known issue:` regression tests
**Context:** Session 10 wrote tests for confirmed bugs without fixing them (explicit decision).
**Learning:** A test named `it("known issue: …")` that asserts the current, wrong behavior, with a
comment naming the TC ID, the violated AC, and the ARCH Open Question, keeps the bug visible and
fails loudly when behavior changes. But a plain TC-comment grep then counts the bug as ✅ covered.
**Action:** Use this pattern only when a fix is deliberately deferred. When fixing, flip the
assertion to the AC's expected behavior and drop the `known issue:` prefix in the same PR.
`/test-coverage` reports these as 🔴, not ✅.

## 2026-09-24 — Fallback defaults must not run before fail-fast checks
**Context:** TC-001-08 regression test (Session 10), `server/auth.ts`.
**Learning:** The production "missing `APP_PASSWORD_HASH` → exit" check was dead code: a fallback
block gated on `NODE_ENV !== "test"` filled in hardcoded secrets first, so production started
fail-open with publicly known values. Code inspection had flagged the fallbacks; only a direct test
showed the check never fires.
**Action:** Validate required production config before any defaulting runs, and gate dev
fallbacks on an explicit dev signal, never on "not test". Every fail-fast path gets a test.

## 2026-09-24 — Removing a leaked secret's file is not removing the secret
**Context:** GitGuardian flagged a high-entropy secret in the repo on 2026-09-24, a full day after
the Session 0 fix (PR #5) that "removed" the leaked secrets. Investigation found the fix only
untracked `secrets.env` — the same `SESSION_SECRET`/`TOTP_ENCRYPTION_KEY` hex values were still
hardcoded as source-code fallbacks in `server/auth.ts`, `server/env-init.ts`, and
`server/env-defaults.ts` (already logged as a 🔴 follow-up but not yet fixed, CR-006).
**Learning:** A leaked secret can hide in more than one place — the tracked file, docs, *and* any
code that hardcodes the same value as a "convenience default". Grep for the actual value across
the whole tree, not just the file it was first found in. A 🔴 follow-up left open for a day is long
enough for an external scanner to find it first.
**Action:** When a secret leak is found, grep the leaked value itself (not just the filename)
across the repo before considering the incident closed. Dev-convenience fallbacks for real secret
material (signing/encryption keys) should be generated at runtime, never a fixed literal — only a
non-secret convenience value (like a known dev login password) is safe to hardcode.

## 2026-09-24 — Code-level traceability starts after the migration
**Context:** `/traceability` in Session 11 found zero implementation commits referencing a REQ.
**Learning:** Pre-migration commits never referenced REQs, and the migration itself only touched
docs and tests, so for all 16 REQs the code files come from the ARCH documents (⚠️), not git.
**Action:** Every fix/feature commit from now on carries `— REQ-XXX`; the ARCH file lists are the
fallback until a REQ has its first such commit.
