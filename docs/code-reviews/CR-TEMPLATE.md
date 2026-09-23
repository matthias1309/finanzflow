# CR-XXX — <Title>

**Status:** draft | in-review | approved | needs-changes
**Created:** YYYY-MM-DD
**Reviewer:** <Name>
**Traces:** REQ-XXX
**Covers:** ARCH-XXX, TEST-XXX

---

## Summary

_Brief description of what was reviewed (feature, scope, relevant files)._

---

## Checklist

### Traceability

- [ ] REQ exists and is complete
- [ ] ARCH exists and traces back to REQ
- [ ] TEST-SPEC exists and covers all ACs
- [ ] All test functions reference their TC-ID
- [ ] Commit messages reference the REQ
- [ ] ARC42 updated where affected (update table in `.claude/rules/v-model.md`)

### Code Quality

- [ ] Follows coding style (`coding-style.md`) and architecture rules (`architecture.md`)
- [ ] No `any`; explicit return types on non-trivial functions; strict mode not weakened
- [ ] Naming conventions kept, no abbreviations, self-explanatory names
- [ ] No magic numbers or unexplained constants
- [ ] No commented-out code; comments explain why, not what
- [ ] Functions are single-responsibility and ≤ ~30 lines
- [ ] Max 3 parameters (or an options object); no flag parameters
- [ ] DRY (Rule of Three), YAGNI, one level of abstraction per function
- [ ] Early returns used instead of deep nesting
- [ ] Errors typed, no `catch (e: any)`, no silent failures
- [ ] DB access only via `server/storage.ts`; types/validation only from `shared/schema.ts`
- [ ] Boy Scout Rule: code slightly better than before

### Tests

- [ ] Tests written before implementation (TDD)
- [ ] All ACs have corresponding test cases
- [ ] Tests follow AAA structure, no logic in tests
- [ ] Happy path and at least one error case per new function
- [ ] No real network I/O in unit tests (mocks at boundaries)
- [ ] Edge cases covered explicitly
- [ ] CI green (typecheck → lint → test)

### Security

- [ ] No secrets or credentials in code or comments
- [ ] Input validated at system boundaries
- [ ] No obvious injection vectors (SQL, XSS, command, ReDoS)
- [ ] Security middleware intact; new endpoints behind `requireAuth` / `requireAdmin`
- [ ] DB colors routed through `safeCssColor()`
- [ ] Dependencies not unnecessarily added (and confirmed with the developer)

### Documentation

- [ ] Public interfaces have a short doc comment where non-obvious
- [ ] `CLAUDE.md` / rules updated if conventions changed
- [ ] `CHANGELOG.md` entry under `[Unreleased]`
- [ ] Migration or breaking changes noted

---

## Findings

_List issues found during review. Use severity: **blocker** / **major** / **minor** / **nit**._

| # | Severity | File / Line | Description |
|---|----------|-------------|-------------|
| 1 | blocker  | `src/foo.ts:42` | _Example: missing input validation_ |

---

## Decision

- [ ] **Approved** — ready to merge
- [ ] **Approved with minor fixes** — fix before merge, no re-review needed
- [ ] **Needs changes** — address findings and re-submit

### Notes

_Optional: reasoning, open questions, follow-up tasks._
