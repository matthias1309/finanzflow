# V-Model Process & Traceability

Every feature follows the V-Model sequence. Claude must never skip or reorder steps.

> **Migration in progress** (see `docs/MIGRATION-PLAN.md`): until Session 4 the legacy
> requirements still live in `docs/REQ/REQ-NNN-slug.md` with one `Feature:` block each; ARCH and
> TEST-SPEC documents are retrofitted in Sessions 5–9. During the migration no new features are
> started.

## Sequence (strictly enforced)

```
REQ  →  ARCH  →  TEST-SPEC  →  Tests (TDD)  →  Implementation  →  Code Review
```

1. **REQ** — A user story exists in `docs/requirements/REQ-XXX.md`
2. **ARCH** — An architecture document exists in `docs/architecture/ARCH-XXX.md` that traces back to the REQ
3. **TEST-SPEC** — A test specification exists in `docs/test-specs/TEST-XXX.md` that maps every Gherkin AC to a concrete test case
4. **Tests** — Failing tests are written from the TEST-SPEC before any implementation code
5. **Implementation** — Code is written to make the tests pass
6. **Code Review** — A review document `docs/code-reviews/CR-XXX.md` is created from the template, filled in, and signed off before merging

Afterwards: update ARC42 (table below) and `CHANGELOG.md` (see `git-workflow.md`).

Internal refactorings, performance work, and bug fixes that do not change specified behavior need
no new REQ — but if a bug fix changes behavior an AC describes, update that REQ.

## TDD Rule

- **Always write tests first** — before any implementation code
- Tests are derived directly from the Gherkin ACs in the REQ
- The test file must exist and fail before implementation begins
- Only skip TDD if the task is provably untestable (e.g. a purely visual change without measurable
  assertions) — in that case, state the reason explicitly **before** continuing

## Traceability IDs

| Artifact | ID Format | Location |
|---|---|---|
| User Story | `REQ-XXX` | `docs/requirements/REQ-XXX.md` |
| Architecture (feature level) | `ARCH-XXX` | `docs/architecture/ARCH-XXX.md` |
| Test Spec | `TEST-XXX` | `docs/test-specs/TEST-XXX.md` |
| Acceptance Criterion | `AC-XXX-YY` | Inside the REQ file |
| Test Case | `TC-XXX-YY` | Inside the TEST-SPEC file |
| Code Review | `CR-XXX` | `docs/code-reviews/CR-XXX.md` |

IDs are zero-padded three-digit numbers (001, 002, ...). **ARCH and TEST numbers mirror the REQ
number** (REQ-017 → ARCH-017 → TEST-017 → TC-017-YY), so the whole chain shares one number.

## Linking Rules

- Every ARCH references at least one REQ: `Traces: REQ-XXX`
- Every TEST-SPEC references one ARCH and lists which ACs it verifies: `Traces: ARCH-XXX`, `Verifies: REQ-XXX (AC-XXX-01, AC-XXX-02)`
- Every test function or `it()` block that verifies an AC references its TC ID in a comment: `// TC-001-01`
- Commit messages reference the REQ: `feat(auth): implement login — REQ-001`
- Every CR references the REQ, ARCH, and TEST-SPEC it covers: `Traces: REQ-XXX`, `Covers: ARCH-XXX, TEST-XXX`

## Requirements (REQ) Conventions

- One `### AC-XXX-YY: <name>` heading per acceptance criterion, each with exactly one Gherkin scenario
- `## Notes` holds implementation details, edge cases, constraints; update it when the feature changes
- Index of all REQs: `docs/requirements/REQ-INDEX.md` (from Session 4 on; until then `docs/REQ/README.md`)

### Gherkin Rules

- **Given** — a stable initial state (database content, UI state)
- **When** — exactly one user action or system event
- **Then** — measurable, verifiable outcomes (HTTP status, visible UI element, DB content)
- No implementation details in Gherkin — what, not how
- Technical IDs and endpoints are allowed (e.g. `POST /api/transactions/batch`)
- **Language:** everything in English, except real German UI labels and error messages, which are
  quoted verbatim (e.g. `When I click "Importieren"`, `Then I see "Nicht angemeldet"`)

## Architecture: ARC42 vs. ARCH-XXX

- `docs/architecture/ARC42.md` is the **system-level** architecture document (arc42, 12 chapters).
- `ARCH-XXX.md` documents are **feature-level** designs. They link to the relevant ARC42 sections
  instead of duplicating them.
- ADRs live in ARC42 chapter 9.

### When to update ARC42

| Change | Chapters to update |
|---|---|
| New route / endpoint | Ch. 5 (Building Block View → Server) |
| New page / component | Ch. 5 (Building Block View → Client) |
| New table / field | Ch. 5 (Building Block View → Database) |
| New runtime flow | Ch. 6 (Runtime View) |
| New external dependency | Ch. 3 (System Scope), Ch. 4 (Solution Strategy) |
| New architecture decision | Ch. 9 (Architecture Decisions) — new ADR-NNN |
| New security or other crosscutting concept (auth, logging) | Ch. 8 (Crosscutting Concepts) |
| New risk / tech debt | Ch. 11 (Risks and Technical Debt) |
| Deployment change | Ch. 7 (Deployment View) |
| New domain or technical term | Ch. 12 (Glossary) |

### ADR Format (ARC42 chapter 9)

```markdown
### ADR-NNN — Short title

**Context:** Why was a decision necessary?

**Decision:** What was decided?

**Consequences:**
- ✅ Benefit
- ⚠️ Drawback / limitation
```

ADRs are immutable — an existing ADR is never edited; a new ADR supersedes it and references the old one.

### Diagrams

Prefer ASCII diagrams (no external tools, diffable). Mermaid is fine for more complex structures
(GitHub renders it).

## Code-Level Traceability

Implementation code is **not** annotated with REQ IDs in comments — that creates maintenance debt
and violates the "comments explain why, not what" principle.

Traceability from requirements to code is derived from **git history**: every commit that
implements or changes behavior for a requirement references the REQ ID.

```bash
# All commits for a requirement
git log --oneline --grep="REQ-001"

# Which implementation files were changed for a requirement
git log --oneline --name-only --grep="REQ-001" -- server/ client/ shared/

# Full diff of all implementation changes for a requirement
git log -p --grep="REQ-001" -- server/ client/ shared/
```

Commits before the migration reference REQs only sporadically; for those REQs the ARCH document
lists the implementing files explicitly.

**Automated:** Run `/traceability` — it executes these queries for every REQ and includes the
results in the coverage matrix.

## Claude Behaviour

- Before writing any implementation code, check that REQ + ARCH + TEST-SPEC exist for the feature
- If any artifact is missing, stop and tell the user which step is next
- Before writing a new REQ, check `docs/SYSTEM-MAP.md` (regenerate with `/system-map` if stale)
  for REQs that touch the same modules or tables
- When creating test stubs, copy the Gherkin scenario as a comment above the test
- A feature is not complete until a CR-XXX.md with status `approved` exists in `docs/code-reviews/`
  (required for all work after the migration, decision D7)
- The template for new reviews is `docs/code-reviews/CR-TEMPLATE.md` — copy and rename it to `CR-XXX.md`
- Run `/traceability` at any time to get an overview of coverage gaps
