# TEST-003 — Category Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-003
**Verifies:** REQ-003 (AC-003-01, AC-003-02, AC-003-03, AC-003-04, AC-003-05, AC-003-06, AC-003-07)

## Test Cases

### TC-003-01 — Create a new expense category

**Maps to:** AC-003-01
**Type:** integration
**File:** `tests/server/api/categories.test.ts`

```gherkin
Given the user is on the Categories page
When the user clicks "Neue Kategorie"
And enters name "Streaming", type "expense", color "#7a39bb"
And clicks "Erstellen"
Then "Streaming" appears in the Ausgabe-Kategorien section
And a success toast "Kategorie erstellt" is shown
```

**Notes:** Covered by `POST /api/categories` → `creates a new category and returns 201`. UI
section placement and toast text are client-side concerns.

---

### TC-003-02 — Create a new income category

**Maps to:** AC-003-02
**Type:** integration
**File:** ❌ missing

**Notes:** No test creates a category with `type: "income"` and asserts it round-trips correctly
(the existing `POST` test only creates `type: "expense"`). `GET /api/categories` →
`includes the seeded default categories` incidentally proves income categories exist ("Gehalt"),
but nothing exercises *creating* one. See Test Gap Backlog.

---

### TC-003-03 — Edit an existing category

**Maps to:** AC-003-03
**Type:** integration
**File:** `tests/server/api/categories.test.ts`

```gherkin
Given a category "Lebensmittel" with color "#da7101" exists
When the user hovers over it and clicks the pencil icon
Then an edit dialog opens pre-filled with "Lebensmittel" and color "#da7101"
When the user changes the name to "Supermarkt" and saves
Then the category is renamed to "Supermarkt" in the list
And a success toast "Kategorie gespeichert" is shown
```

**Notes:** Covered by `PUT /api/categories/:id` → `updates name and color` for the save/rename
part. The pre-fill-dialog part is UI-only, see TC-003-04.

---

### TC-003-04 — Edit dialog pre-fills current values

**Maps to:** AC-003-04
**Type:** e2e
**File:** `tests/e2e/categories.spec.ts`

```gherkin
Given a category "Gehalt" of type "income" with color "#437a22" exists
When the user opens the edit dialog for "Gehalt"
Then the name field shows "Gehalt"
And the type selector shows "Einnahme"
And the color "#437a22" is highlighted in the color picker
```

**Notes:** Covered **partially** by `edits an existing category` →
`expect(editDialog.getByTestId("input-cat-name")).toHaveValue("Zu Bearbeiten")` — only the *name*
field's pre-fill is asserted. Neither the type-selector pre-fill nor the color-picker highlight is
checked. See Test Gap Backlog.

---

### TC-003-05 — Delete a category

**Maps to:** AC-003-05
**Type:** integration
**File:** `tests/server/api/categories.test.ts`

```gherkin
Given a category "Testkat" exists
When the user hovers over it and clicks the trash icon
Then the category is removed from the list
And a success toast "Kategorie gelöscht" is shown
```

**Notes:** Covered by `DELETE /api/categories/:id` → `deletes a created category`.

---

### TC-003-06 — Category name is required

**Maps to:** AC-003-06
**Type:** integration
**File:** `tests/server/api/categories.test.ts`

```gherkin
When the user submits a new category with an empty name
Then the form shows a validation error
And no category is created
```

**Notes:** Covered by `POST /api/categories` → `rejects missing name` (omits the field rather than
sending an empty string — same Zod `required` failure mode, not worth a separate Test Gap entry).

---

### TC-003-07 — Categories are split by type in the UI

**Maps to:** AC-003-07
**Type:** e2e
**File:** ❌ missing

**Notes:** Purely a UI-layout assertion (two-column split by type with colored headers). None of
the three tests in `tests/e2e/categories.spec.ts` (create/edit/delete) assert column placement or
header color — all three only check the category name text becomes visible/invisible. See Test
Gap Backlog.
