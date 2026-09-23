# Tests — CLAUDE.md

Zwei Testschichten: **Vitest + Supertest** (Unit + API) und **Playwright** (E2E). Beide laufen vollständig isoliert — keine geteilte Datenbank, kein laufender Server nötig für Unit/API-Tests.

## Welche Schicht wofür

| Was testen | Schicht | Datei |
|---|---|---|
| Parser-Hilfsfunktionen (pure functions) | Vitest Unit | `tests/server/unit/*.test.ts` |
| REST-Endpunkte (Request → Response) | Vitest + Supertest API | `tests/server/api/*.test.ts` |
| Kritische User-Journeys im Browser | Playwright E2E | `tests/e2e/*.spec.ts` |

Keine Duplikation zwischen Schichten: Was ein API-Test abdeckt, braucht kein E2E-Test zu wiederholen.

## Isolationsmechanismus (Vitest)

`vitest.config.ts` setzt `pool: "forks"` — jede Testdatei läuft in einem eigenen Node.js-Prozess. `tests/server/setup.ts` setzt **vor** jedem Modul-Import:

```typescript
process.env.DB_PATH  = ":memory:";   // frische SQLite-DB pro Testdatei
process.env.NODE_ENV = "test";        // Auth + CSRF automatisch deaktiviert
```

**Wichtig:** `DB_PATH` muss in `setup.ts` gesetzt sein, nicht erst im Test — `db.ts` wird beim ersten Import ausgewertet.

Der DB-Seed (14 Standard-Kategorien) läuft bei jedem Prozessstart automatisch. Tests dürfen darauf aufbauen, müssen aber robust gegen zusätzliche Einträge sein (nie auf exakte Gesamtzahl prüfen).

## API-Tests schreiben

```typescript
import { createApp } from "../../../server/createApp";
import request from "supertest";

const { app } = createApp();   // kein listen() — Supertest bindet sich selbst
const agent = request(app);
```

`createApp()` einmal pro Testdatei aufrufen (nicht in `beforeEach` — das wäre eine neue App-Instanz mit neuer DB).

**Muster für abhängige Tests:**

```typescript
let createdId: number;

beforeEach(async () => {
  const res = await agent.post("/api/accounts").send({ name: "Test", … });
  createdId = res.body.id;
});
```

## E2E-Tests (Playwright)

**Separater Server** auf Port 3001 mit eigener Datenbank:
- `DB_PATH=/tmp/finanzflow_e2e.db` — persistiert zwischen Tests innerhalb eines Runs
- `tests/e2e/globalSetup.ts` löscht die DB vor jedem Run
- `baseURL: "http://localhost:3001"` — nie Port 3000 (Konflikt mit Dev-Server)

**Testdaten per API anlegen** (nicht per UI, wenn es nur Setup ist):

```typescript
const base = page.context().request;
await base.post("/api/accounts", { data: { name: "Test", … } });
```

**`data-testid` für alle interaktiven Elemente** die E2E-Tests verwenden. Naming-Schema:
- `button-add-{ressource}` — Öffnet Create-Dialog
- `button-save-{ressource}` — Speichert Formular
- `button-edit-{ressource}-{id}` — Öffnet Edit-Dialog für spezifischen Eintrag
- `button-delete-{ressource}-{id}` — Löscht spezifischen Eintrag
- `input-{feldname}` — Eingabefeld
- `select-{feldname}` — Auswahlfeld
- `{ressource}-card-{id}` / `{ressource}-item-{id}` — Listenelement

Fehlende `data-testid`-Attribute in der UI ergänzen, bevor der E2E-Test geschrieben wird.

## Befehle

```bash
npm test                   # Vitest run (alle server/ Tests)
npm run test:watch         # Vitest im Watch-Modus
npm run test:e2e           # Playwright (startet automatisch dev-Server auf Port 3001)
npm run test:e2e:ui        # Playwright mit UI-Modus
npx playwright install     # Browser installieren (einmalig)
```

## Was nicht testen

- Keine Tests für Drizzle-ORM-interne Logik — das ist eine externe Library
- Keine Tests für shadcn/ui-Komponenten — UI-Bibliothek, kein eigener Code
- Keine Tests für React Query Cache-Verhalten — Unit-Tests testen die API, E2E-Tests testen das Ergebnis im Browser
