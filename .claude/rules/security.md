# Security

FinanzFlow holds personal banking data. Security rules are not optional.

## Core Principles

- **Validate at boundaries:** Trust nothing from outside — user input, query params, request
  bodies, uploaded PDFs, the Paperless API, environment variables read at runtime.
- **Least privilege:** Every component, role, and API key gets only the permissions it actually needs.
- **Fail securely:** On error, deny by default — never fall back to an open or permissive state.
- **Defense in depth:** No single control is enough; layer validation, authorization, and logging.
- **Security is not optional:** Every PR is reviewed with security in mind.

---

## Security Middleware — never disable or bypass

Wired in `server/createApp.ts` in this order: security headers → rate limiter → CSRF → public
auth routes → `requireAuth` for everything else under `/api`.

| Middleware | File | Purpose |
|---|---|---|
| `securityHeadersMiddleware` | `server/securityHeaders.ts` | Helmet: CSP, HSTS, frame/referrer policies |
| `authRateLimiter` | `server/auth.ts` | Brute-force protection (limits in REQ-001) |
| `csrfProtectionMiddleware` | `server/securityHeaders.ts` | Origin/Referer check on state-changing requests |
| `requireAuth` | `server/auth.ts` | Session check for all non-public `/api` routes |
| `requireAdmin` | `server/auth.ts` | Admin-only routes (user management, REQ-015) |
| `requireStepUp` | `server/routes/auth.ts` | Fresh re-authentication for 2FA setup / recovery-code changes |

When `APP_PASSWORD_HASH` is unset (dev) or `NODE_ENV=test`, auth and CSRF are bypassed
automatically — this is intentional, not a bug. Production must always set it.

The dev-only CSP relaxation (`unsafe-inline` + `unsafe-eval` for Vite Fast Refresh) must never
leak into the production branch of `securityHeaders.ts`.

---

## Project-Specific Rules

- **CSS injection:** colors from the DB always pass through `safeCssColor()`
  (`client/src/lib/config.ts`) before they reach `style` or SVG `fill`/`stroke`:

  ```typescript
  style={{ backgroundColor: safeCssColor(acc.color) }}  // ✅
  style={{ backgroundColor: acc.color }}                 // ❌
  ```

- **ReDoS:** user-controlled strings that end up in a `RegExp` (e.g. account-holder patterns in
  `server/pdfParser.ts`) are length-limited and compiled inside `try/catch` — see REQ-005.
- **Passwords:** bcrypt only (`bcrypt.compareSync`); never SHA-256 or plain comparisons.
  Constant-time comparison (`safeStringEqual`) for any other secret.
- **TOTP secrets** are stored encrypted with `TOTP_ENCRYPTION_KEY`; rotating the key invalidates
  every enrolled 2FA secret.
- **Session cookies:** `httpOnly`, `sameSite: "lax"`; `secure` only for real HTTPS production
  deployments (see `server/session.ts` for the Docker exception).

---

## Secrets Management

- **Never hardcode** secrets, API keys, tokens, or passwords — not in code, not in docs, not in
  tests, not in `.claude/settings*.json` permission entries.
- Store secrets in environment variables; document expected names in `.env.example` with
  placeholder values (never real values, not even "example" ones copied from a real `.env`).
- `.env`, `*.env`, `secrets.env` and `.claude/settings.local.json` are gitignored; verify before every commit.
- Rotate exposed credentials immediately — treat any accidental commit as a breach (the repo is **public**).

---

## Input Validation & Sanitization

- Validate type, format, length, and range for every external input — Zod `.safeParse()` with
  schemas from `shared/schema.ts`.
- Use an explicit allowlist, not a blocklist.
- Never build SQL, shell commands, or HTML by concatenating user input — use Drizzle /
  prepared statements and React's escaping.
- Reject invalid input early with a clear `400`; do not silently strip or coerce.
- Uploaded PDFs: enforce the size limit and MIME check before parsing.

---

## Common Vulnerability Classes (OWASP Top 10)

| Class | Rule |
|---|---|
| Injection (SQL, shell) | Always use parameterized queries / safe APIs |
| XSS | Escape all output; keep the Content Security Policy strict in production |
| CSRF | `sameSite` cookies + `csrfProtectionMiddleware` on state-mutating endpoints |
| Broken Access Control | Re-check authorization server-side on every request |
| Security Misconfiguration | No debug endpoints, default credentials, or verbose error pages in production |
| Sensitive Data Exposure | Never log transactions, IBANs, passwords, TOTP codes, or session IDs |
| Insecure Dependencies | Run `npm audit` before merging; block PRs with critical vulnerabilities |
| SSRF | The Paperless base URL comes from env config only, never from a request |

---

## Error Handling & Logging

- Return generic error messages to clients — never expose stack traces, internal paths, or query details.
- Log errors server-side with enough context to debug, but strip PII, IBANs, tokens, and passwords.

---

## Dependency Security

- Confirm with the developer before adding a dependency; check maintenance status and open CVEs.
- Pin versions via `package-lock.json`; use `npm ci` in CI.
- Remove unused dependencies — every dependency is an attack surface.

---

## Code Review Security Checklist

Before approving any PR, verify:

- [ ] No secrets or credentials in the diff
- [ ] All external inputs validated with Zod `.safeParse()`
- [ ] Authorization checks present on new/changed endpoints (`requireAuth` / `requireAdmin`)
- [ ] No new `eval`, `new Function`, or dynamic code execution
- [ ] DB colors routed through `safeCssColor()`
- [ ] Error responses do not leak internal details
- [ ] No sensitive data written to logs
- [ ] New dependencies audited and justified

---

## Claude Behaviour

- Before writing any code that handles user input, authentication, or data persistence, apply the rules above.
- If a task requires a pattern that would violate these rules, stop and flag it before proceeding.
- When reviewing code, always include a security pass using the checklist above.
- Never suggest storing secrets in code, even "temporarily" or "for testing".
