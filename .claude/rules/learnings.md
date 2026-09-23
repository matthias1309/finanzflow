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
