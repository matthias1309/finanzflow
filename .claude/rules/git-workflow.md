# Git Workflow

## Branch Naming

```
feature/<short-description>
fix/<issue-or-description>
chore/<what-is-being-done>
docs/<what-is-documented>
test/<what-is-tested>
```

Examples: `feature/csv-export`, `fix/login-redirect`, `chore/update-deps`

Never commit directly to `main` — every change goes through a branch and a PR.

## Commit Messages (Conventional Commits)

Format: `<type>(<scope>): <short description> — REQ-XXX`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`

```
feat(import): add Sparkasse parser — REQ-005
fix(auth): compare passwords with bcrypt — REQ-001
chore(deps): bump typescript to 5.6
```

Rules:
- English, subject line max 72 chars, imperative mood, no period at the end
- Reference the REQ ID for every commit that implements or changes behavior of a requirement
  (this is the code-level traceability link, see `v-model.md`); pure chores need none
- Body: explain WHY, not what (the diff already shows what)
- Reference issue numbers: `Closes #42` or `Refs #42`

## Definition of Done before Committing

Order for every feature or change (see `v-model.md` for the full process):

1. REQ / ARCH / TEST-SPEC exist and are up to date
2. Tests written first, now green: `npm test`
3. `npm run typecheck` and `npm run lint` clean
4. ARC42 updated where affected (`docs/architecture/ARC42.md`, update table in `v-model.md`)
5. **`CHANGELOG.md`** entry under `[Unreleased]` (Added / Changed / Fixed / Removed)
6. **Pre-commit Clean Code Review** (below) done — all items green
7. Commit and push

## Pre-Commit Clean Code Review (mandatory)

Before every `git commit`, Claude reviews the staged diff and prints this checklist.
**No commit with open items** — fix them first. For feature PRs the full review is additionally
recorded as `docs/code-reviews/CR-XXX.md` (template: `CR-TEMPLATE.md`).

```
=== CLEAN CODE REVIEW ===

[ ] TypeScript
    - No `any`
    - Explicit return types on non-trivial functions
    - Strict mode not weakened, no @ts-ignore

[ ] Naming
    - Conventions (camelCase / PascalCase / UPPER_SNAKE_CASE)
    - No abbreviations
    - Self-explanatory names

[ ] Functions
    - Single responsibility
    - No function > ~30 lines
    - Max 3 parameters (or an options object)
    - No flag parameters

[ ] Structure
    - DRY: no repetition from the third time on
    - YAGNI: no speculative code
    - One level of abstraction per function

[ ] Comments
    - No commented-out code
    - Comments explain why, not what

[ ] Error handling
    - No `catch (e: any)`
    - No silent failures

[ ] Tests
    - Happy path covered
    - At least one error case
    - TC IDs on tests that verify an AC

[ ] Security
    - No secrets in the diff
    - Inputs validated, auth middleware intact

[ ] Boy Scout Rule
    - Code slightly better than before

=== RESULT ===
✅ Ready to commit
– OR –
❌ Open: [list of violations with file + line]
========================
```

## CHANGELOG

- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- Every user-visible or developer-relevant change gets an entry under `[Unreleased]` in the same PR
- New entries are written in English (older entries are German — historical, not translated)

## Pull Requests

- One logical change per PR; PR description: summary, REQ reference, test plan
- **CI must be green** (typecheck → lint → test, `.github/workflows/ci.yml`) before merge
- Self-review the diff before requesting review
- No force-push to `main`

## What Not to Commit

- Secrets, API keys, credentials — use environment variables (see `security.md`)
- `node_modules/`, `dist/`, `*.db`, `.env*` files, `CLAUDE.local.md`, `.claude/settings.local.json`
- Large binary files (real bank statement PDFs never — use synthetic fixture text in tests)
