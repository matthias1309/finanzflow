# FinanzFlow — CLAUDE.md

Persönliches Finanz-Dashboard für deutsche Bankkonten (N26, DKB, ING). React-SPA + Express-5-API + SQLite. Single-User, läuft auf Uberspace-Shared-Hosting.

## Schnellstart

```bash
PORT=3000 npm run dev      # Nicht Port 5000 — macOS AirPlay belegt ihn
npm test                   # Vitest: Unit- + API-Tests
npm run test:e2e           # Playwright E2E (erfordert laufenden Dev-Server)
npm run build              # Lokaler Build (ohne Uberspace-Pfade)
```

> **Port 3000 ist Pflicht lokal.** Port 5000 ist auf macOS durch AirPlay Receiver (ControlCenter) belegt und führt zu EADDRINUSE.

## Projektstruktur

```
shared/schema.ts          ← Einzige Quelle der Wahrheit für Typen + Validierung
server/
  db.ts                   ← SQLite-Verbindung + Schema-Migration + Seeding
  storage.ts              ← Alle DB-Zugriffe (Façade, nie direktes Drizzle außerhalb)
  createApp.ts            ← App-Factory ohne listen() — von Tests und index.ts genutzt
  pdfParser.ts            ← PDF-Extraktion + bankspezifische Parser
  routes/                 ← Ein Router pro Ressource
client/src/
  lib/config.ts           ← API_BASE-Auflösung + safeCssColor()
  lib/queryClient.ts      ← QueryClient, apiRequest()
  pages/                  ← Eine Komponente pro Seite
documentation/
  REQ/                    ← Anforderungen REQ-001 bis REQ-012
  architecture/ARC42.md   ← Arc42-Architekturdokument
tests/
  server/                 ← Vitest (Unit + API via Supertest)
  e2e/                    ← Playwright-Specs
```

## Entwicklungsprozess

Bei neuen Features oder Erweiterungen bestehender Features immer in dieser Reihenfolge:

1. **REQ erstellen oder anpassen** — Acceptance Criteria (Gherkin-Szenarien) vollständig ausformulieren, bevor Code geschrieben wird
2. **Tests schreiben** — direkt aus den AC abgeleitet (Vitest für Unit/API, Playwright für E2E)
3. **Implementieren** — erst wenn REQ und Tests stehen
4. **CHANGELOG.md erweitern** — unter `[Unreleased]` die Änderungen eintragen (Added / Changed / Fixed / Removed)
5. **Committen und pushen** — erst nach Changelog-Eintrag

Wenn TDD nicht möglich ist (z.B. rein visuelle Änderungen ohne messbare Assertions), explizit darauf hinweisen bevor weitergemacht wird.

## Architektur-Kernregeln

### Shared Schema — Single Source of Truth

`shared/schema.ts` definiert Drizzle-Tabellen, Zod-Insert-Schemas und TypeScript-Typen. **Alle** Validierungen und Typen kommen von hier — nie duplizieren.

```
shared/schema.ts  →  server/routes/*.ts  (Zod .safeParse zur Laufzeit)
                  →  client/src/pages/*.tsx  (z.infer<> für Form-Typen)
```

Neues Feld immer zuerst in `shared/schema.ts` (Tabelle + Zod-Erweiterung), dann `CREATE TABLE IF NOT EXISTS` in `db.ts` erweitern, dann Storage-Methode.

### Storage-Façade — kein direktes Drizzle außerhalb

Alle Datenbankzugriffe gehen über das `storage`-Objekt in `server/storage.ts`. Keine Drizzle-Queries in Route-Handlern, Parsern oder anderen Dateien.

```typescript
// ✅ Korrekt
storage.getAccounts()
storage.createTransaction(data)

// ❌ Verboten
db.select().from(accounts).all()  // nicht in routes/*.ts
```

### CSS-Injection verhindern

Farben aus der DB **immer** durch `safeCssColor()` aus `client/src/lib/config.ts` leiten, bevor sie in SVG-`fill`/`stroke`-Attribute fließen.

```typescript
style={{ backgroundColor: safeCssColor(acc.color) }}  // ✅
style={{ backgroundColor: acc.color }}                 // ❌
```

## Sicherheitsregeln — nicht umgehen

Diese Middleware-Schicht darf **nie** deaktiviert oder umgangen werden:

| Middleware | Datei |
|---|---|
| `authRateLimiter` | `server/auth.ts` |
| `basicAuthMiddleware` | `server/auth.ts` |
| `csrfProtectionMiddleware` | `server/securityHeaders.ts` |
| `securityHeadersMiddleware` | `server/securityHeaders.ts` |

In `NODE_ENV !== 'production'` (dev + test) sind Auth und CSRF automatisch deaktiviert — das ist so gewollt und kein Bug.

Spezifische Anforderungen (Rate-Limits, ReDoS-Schutz) stehen in [REQ-001](documentation/REQ/REQ-001-authentication.md) und [REQ-005](documentation/REQ/REQ-005-pdf-import.md).

## Features erweitern

### Neuen API-Endpunkt hinzufügen

1. REQ-Datei erstellen oder anpassen, AC formulieren
2. API-Tests in `tests/server/api/meinfeature.test.ts` schreiben
3. Neue Datei `server/routes/meinfeature.ts` — Router + Zod-Validierung
4. In `server/routes.ts` registrieren: `app.use("/api/meinfeature", meinfeatureRouter)`
5. Arc42 Kapitel 5 (Building Block View) aktualisieren

### Neuen Bank-Parser hinzufügen

1. REQ-005 in `documentation/REQ/REQ-005-pdf-import.md` ergänzen
2. Unit-Tests mit Fixture-Text in `tests/server/unit/pdfParser.test.ts` schreiben
3. `detectBank()` in `server/pdfParser.ts` um die Bank erweitern
4. `parseXYZ(text: string): ParsedTransaction[]` Funktion hinzufügen
5. In `parsePDF()` aufrufen (vor dem Generic-Fallback)

### Neues Datenbankfeld hinzufügen

1. Tabellendefinition in `shared/schema.ts` ergänzen
2. Zod-Schema ggf. erweitern (`.extend({})`)
3. `CREATE TABLE IF NOT EXISTS` in `server/db.ts` um die Spalte erweitern — **kein** Migration-Tool, inline SQL
4. Storage-Interface (`IStorage`) und -Implementierung in `server/storage.ts` aktualisieren
5. Route-Handler anpassen

## Deployment auf Uberspace

**Build** immer mit beiden Variablen:

```bash
DEPLOY_BASE="/finanzflow/" VITE_API_BASE="/finanzflow" npm run build
```

`VITE_API_BASE` wird zur Build-Zeit in den Client-Bundle gebacken (`client/src/lib/config.ts`). Fehlt er, landen alle API-Calls auf `/api/…` statt `/finanzflow/api/…` → leeres Dashboard.

**Package erstellen** (`node_modules` nicht einpacken — native Addons müssen auf dem Linux-Server kompiliert werden):

```bash
COPYFILE_DISABLE=1 tar -czf finanzflow-uberspace.tar.gz \
  dist/ package.json package-lock.json deploy.sh
```

`COPYFILE_DISABLE=1` verhindert macOS-`._`-Metadateien im Archiv.

**Auf Uberspace entpacken & deployen:**

```bash
tar -xzf finanzflow-uberspace.tar.gz
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` kopiert die Dateien nach `/var/www/virtual/$USER/finanzflow/`, führt `npm ci --omit=dev` via `scl enable devtoolset-11` aus (nötig für `better-sqlite3` auf CentOS 7) und startet den supervisord-Dienst neu.

**Pflicht-Umgebungsvariablen (supervisord .ini):**

```ini
NODE_ENV=production
PORT=3001
DB_PATH=/home/user/finanzflow/finance.db
APP_USER=admin
APP_PASSWORD_HASH=$2b$10$...      ; $$ escapen in supervisord
APP_ORIGIN=https://user.uberspace.de
TOTP_ENCRYPTION_KEY=...           ; 32 zufällige Bytes als Hex (openssl rand -hex 32)
SESSION_MAX_AGE_HOURS=8           ; optional, Standard: 8
TOTP_ISSUER=FinanzFlow            ; optional, Name in der Authenticator-App
```

## Codestil

- **Keine Kommentare** außer wenn das Warum nicht offensichtlich ist (versteckte Einschränkung, Sicherheits-Workaround, kontraintuitives Verhalten)
- **Kein vorauseilendes Abstrahieren** — drei ähnliche Zeilen sind besser als eine verfrühte Abstraktion
- **Keine Fehlerbehandlung** für Szenarien, die nicht auftreten können — Framework-Garantien vertrauen
- Zod `.safeParse()` für alle externen Eingaben — nie `parse()` (würft unkontrolliert)
- `amount` in der DB immer positiv; `type` (`income` / `expense` / `transfer`) trägt die Vorzeichen-Semantik

## Häufige Fallstricke

| Problem | Ursache | Lösung |
|---|---|---|
| Graue Seite im Browser | CSP blockiert Vite Fast Refresh | Nur in dev: `unsafe-inline` + `unsafe-eval` in CSP — bereits konfiguriert |
| Leeres Dashboard nach Deploy | `VITE_API_BASE` fehlte beim Build | Mit beiden Env-Vars neu bauen |
| `EADDRINUSE` auf Port 5000 | macOS AirPlay Receiver | `PORT=3000 npm run dev` |
| `import.meta`-Warning im Build | esbuild CJS-Bundle + `import.meta.url` in pdfParser | Harmlos — Dead Code im CJS-Pfad |
| `._`-Dateien im tar.gz | macOS `tar` schreibt Metadaten | `COPYFILE_DISABLE=1 tar …` |
