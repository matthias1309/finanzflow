# TEST-016 — Paperless Bank Statement Import

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-016
**Verifies:** REQ-016 (AC-016-01 … AC-016-10)

The best-covered REQ retrofitted in this migration so far — `tests/server/api/paperless.test.ts`
mocks `paperlessClient`/`pdfParser` at the module boundary and exercises nearly every AC directly.

## Test Cases

### TC-016-01 — Create a mapping between a Paperless tag and an account

**Maps to:** AC-016-01
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `Paperless-Mappings` → `legt ein Mapping an und listet es`.

---

### TC-016-02 — Edit an existing mapping

**Maps to:** AC-016-02
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `Paperless-Mappings` → `aktualisiert ein bestehendes Mapping`.

---

### TC-016-03 — Show open Paperless documents

**Maps to:** AC-016-03
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `GET /api/paperless/documents` → `blendet bereits importierte Dokumente aus`
(already-imported documents excluded) combined with `klassifiziert Dokumente...` (shape of an open
document). Does not separately assert "file name, creation date, detected tag" are *all* present
in the response — `klassifiziert Dokumente...` covers `status`/`accountId`/`matchedTag`, and
`title`/`created` are part of the `OpenDocument` type but not explicitly asserted per-field. Minor
gap, not worth a separate backlog entry — the type contract already guarantees the fields exist.

---

### TC-016-04 — Automatically assign a document with an unambiguous account tag

**Maps to:** AC-016-04
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `klassifiziert Dokumente nach eindeutigem, fehlendem und mehrdeutigem
Konto-Tag` → the `Resolved` document case (`status: "resolved"`, `accountId` set).

---

### TC-016-05 — Document without a mapped account tag shows a notice

**Maps to:** AC-016-05
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by the same test's `Unmapped-NoTag` and `Unmapped-UnknownTag` cases
(`status: "unmapped"`). The exact notice text ("Kein Konto zugeordnet") is a client-rendering
concern from the `status` value, not asserted server-side (correctly — the server returns a
status enum, not localized copy).

---

### TC-016-06 — Document with multiple account tags shows a notice

**Maps to:** AC-016-06
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by the same test's `Ambiguous` case (`status: "ambiguous"`, `accountId: null`).

---

### TC-016-07 — Load and parse a document from Paperless

**Maps to:** AC-016-07
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `POST /api/paperless/documents/:id/import` → `lädt das Dokument und liefert
eine Vorschau mit Kategorie-Vorschlag` (asserts `downloadDocument` called with the right ID, parsed
bank/transactions returned, `suggestedCategoryId` present).

---

### TC-016-08 — Confirm the import and mark the document as imported

**Maps to:** AC-016-08
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `POST /api/paperless/documents/:id/confirm` → `markiert das Dokument als
importiert`, combined with `GET /api/paperless/documents` → `blendet bereits importierte Dokumente
aus` (proves the document disappears from the open-documents list afterward — the "12 transactions
saved" half of this AC is TEST-011's concern, since `/confirm` itself doesn't save transactions,
see ARCH-016).

---

### TC-016-09 — Paperless is unreachable

**Maps to:** AC-016-09
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `GET /api/paperless/documents` → `liefert 502, wenn Paperless nicht
erreichbar ist`. "Manual upload remains usable unchanged" is implicitly true (the two routers are
independent), not separately tested — not worth a backlog entry, there's no shared state that
could couple them.

---

### TC-016-10 — Invalid or missing API token

**Maps to:** AC-016-10
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

**Notes:** Covered by `GET /api/paperless/documents` → `liefert 401, wenn der API-Token ungültig
ist`, and again for the import path by `POST /api/paperless/documents/:id/import` →
`gibt 401 zurück, wenn Paperless den Zugriff verweigert`.
