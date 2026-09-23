Create a new User Story requirement document.

Steps:
1. Scan `docs/requirements/` (and the legacy `docs/REQ/` folder while it still exists) for existing REQ-XXX files and determine the next ID (e.g. if REQ-016 is the highest, next is REQ-017).
   Read `docs/SYSTEM-MAP.md` (if present) and list the existing REQs that touch the same modules or tables as the new story — mention them to the user before continuing.
2. Ask the user: "What is the title of this story?" (one short phrase, e.g. "User Login")
3. Ask: "Who is the user role?" — then "What do they want to do?" — then "What is the benefit?"
4. Ask: "How many acceptance criteria does this story have?" Then collect each AC as a Gherkin scenario (Given / When / Then). Prompt for each one individually.
5. Create the file `docs/requirements/<ID>.md` using this exact template:

```markdown
# <ID> — <Title>

**Status:** draft
**Created:** <today YYYY-MM-DD>
**Traced by:** _(pending ARCH and TEST)_

## User Story

As a <role>,
I want to <action>,
in order to <benefit>.

## Acceptance Criteria

### <AC-ID-01>: <Short name>

```gherkin
Given <context>
When <action>
Then <outcome>
```

### <AC-ID-02>: <Short name>

```gherkin
Given <context>
When <action>
Then <outcome>
```

## Notes

_(Add constraints, edge cases, or open questions here.)_
```

   Gherkin rules (see `.claude/rules/v-model.md`): one scenario per AC, English prose, real German UI
   labels and error messages quoted verbatim (e.g. `"Importieren"`).

6. Add the new REQ to `docs/requirements/REQ-INDEX.md`.
7. After creating the file, tell the user:
   - The file path created
   - The next step: "Run `/new-arch` and reference <ID> to continue."
