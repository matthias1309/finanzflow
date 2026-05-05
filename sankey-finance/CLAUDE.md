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
4. **Arc42 aktualisieren** — betroffene Kapitel in `documentation/architecture/ARC42.md` anpassen: Kapitel 5 (Building Block View) bei neuen Komponenten/Routen, Kapitel 6 (Runtime View) bei neuen Abläufen, Kapitel 8 (Crosscutting Concepts) bei übergreifenden Änderungen (Auth, Sicherheit, Logging)
5. **CHANGELOG.md erweitern** — unter `[Unreleased]` die Änderungen eintragen (Added / Changed / Fixed / Removed)
6. **Committen und pushen** — erst nach Changelog-Eintrag

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

**Uberspace-Daten:** `mattmaxx@giclas.uberspace.de`, App läuft unter `/finanzflow/`

### Update-Prozess (Schritt für Schritt)

**1. Lokal bauen** — immer mit beiden Variablen:

```bash
cd sankey-finance
DEPLOY_BASE="/finanzflow/" VITE_API_BASE="/finanzflow" npm run build
```

`VITE_API_BASE` wird zur Build-Zeit in den Client-Bundle gebacken (`client/src/lib/config.ts`). Fehlt er, landen alle API-Calls auf `/api/…` statt `/finanzflow/api/…`.  
**Falle:** Neue Client-Seiten müssen `API_BASE` aus `@/lib/config` importieren und alle `fetch()`-Calls damit prefixen — nie URLs hardcoden.

**2. Archiv erstellen** — `node_modules` nicht einpacken (macOS-Binaries laufen nicht auf Linux):

```bash
COPYFILE_DISABLE=1 tar -czf finanzflow-uberspace.tar.gz \
  dist/ package.json package-lock.json deploy.sh
```

**3. Hochladen:**

```bash
scp finanzflow-uberspace.tar.gz mattmaxx@giclas.uberspace.de:~
```

**4. Auf Uberspace deployen:**

```bash
ssh mattmaxx@giclas.uberspace.de
tar -xzf finanzflow-uberspace.tar.gz
./deploy.sh
```

`deploy.sh` kopiert Dateien nach `/var/www/virtual/mattmaxx/finanzflow/`, installiert Abhängigkeiten in zwei Schritten (siehe Constraints unten) und startet den supervisord-Dienst neu.

### Bekannte Constraints

| Thema | Detail |
|---|---|
| Node.js auf Uberspace | Node 18.20.8 (CentOS 7) — `uberspace tools version use node 18` |
| `better-sqlite3` | Pinned auf `^9.6.0` — nutzt C++17; kein prebuilt für CentOS 7, daher kompiliert `deploy.sh` via node-gyp@9 + `scl enable devtoolset-9` (GCC 9). Lokal (Node 25) kein prebuilt → `npm install --ignore-scripts` verwenden. |
| node-gyp auf Uberspace | npm liefert node-gyp@10 (C++20), CentOS 7 hat max. GCC 9. `deploy.sh` installiert node-gyp@9 in `/tmp/finanzflow-ngv9` und ruft es direkt auf. |
| `otplib` | Pinned auf `^12.0.1` — v13 zieht `@noble/hashes@2.x` und `@scure/base@2.x` rein, beide ESM-only, nicht mit CJS-Bundle auf Node 18 kompatibel. |
| `@scure/base` / `@noble/hashes` overrides | Im `overrides`-Block auf `^1.2.0` resp. `^1.6.0` gehalten — v2 beider Pakete ist ESM-only und nicht per `require()` aus dem CJS-Bundle ladbar (Node 18). |
| `node_modules` im Archiv | Niemals einpacken — macOS-Binaries sind nicht Linux-kompatibel |
| Session-Cookie / `trust proxy` | Uberspace terminiert HTTPS bei nginx und leitet intern per HTTP weiter. Ohne `app.set("trust proxy", 1)` setzt express-session den Cookie nicht (da `req.secure = false`), Login schlägt mit 401 fehl. Ist in `server/createApp.ts` gesetzt — nicht entfernen. |
| API-URLs im Client | Alle `fetch()`-Calls müssen `API_BASE` aus `@/lib/config` nutzen — nie `/api/...` hardcoden. `API_BASE` wird beim Build mit `VITE_API_BASE=/finanzflow` eingebettet. |

**Pflicht-Umgebungsvariablen (supervisord .ini):**

```ini
NODE_ENV=production
PORT=3001
DB_PATH=/home/user/finanzflow/finance.db
APP_USER=admin
APP_PASSWORD_HASH=$2b$10$...      ; $$ escapen in supervisord
APP_ORIGIN=https://user.uberspace.de
SESSION_SECRET=...                ; mind. 32 Zeichen: openssl rand -hex 32
TOTP_ENCRYPTION_KEY=...           ; 32 zufällige Bytes als Hex: openssl rand -hex 32
SESSION_MAX_AGE_HOURS=8           ; optional, Standard: 8
TOTP_ISSUER=FinanzFlow            ; optional, Name in der Authenticator-App
```

## Codestil

Projektspezifische Regeln, die über die allgemeinen TypeScript-Standards hinausgehen:

- Zod `.safeParse()` für alle externen Eingaben — nie `parse()` (wirft unkontrolliert)
- `amount` in der DB immer positiv; `type` (`income` / `expense` / `transfer`) trägt die Vorzeichen-Semantik

## TypeScript-Standards

### Typsicherheit

- **Kein `any` — niemals.** Stattdessen `unknown` mit Type Guard oder konkreten Typen.
- **Explizite Return-Typen** bei allen nicht-trivialen Funktionen.
- **`interface`** für Objektstrukturen, **`type`** für Unions und Aliases.
- **Strict Mode bleibt aktiv** (`"strict": true` in tsconfig) — nicht aushebeln, nicht mit `@ts-ignore` umgehen.
- **`readonly`** wo immer möglich bei Parametern und Properties.

```typescript
// ❌ Schlecht
function process(data: any): any { ... }

// ✅ Gut
function processUser(data: User): ProcessedUser { ... }
```

### Naming

- **Variablen und Funktionen**: `camelCase`
- **Klassen, Interfaces, Types, React-Komponenten**: `PascalCase`
- **Globale unveränderliche Konstanten**: `UPPER_SNAKE_CASE`
- **Keine Abkürzungen** — erlaubte Ausnahmen: `id`, `db`, `req`, `res`, `err`, `ctx`
- **Namen sind selbsterklärend** — kein `data`, `info`, `temp`, `value` ohne Kontext

### Funktionen

- **Single Responsibility** — eine Funktion, eine Aufgabe.
- **Maximale Länge: ~20 Zeilen** — bei mehr aufteilen.
- **Maximale Parameter: 3** — bei mehr ein Optionsobjekt übergeben.
- **Keine Flag-Parameter** — `doSomething(true)` ist verboten (was ist `true`?).
- **Pure Functions bevorzugen** — keine versteckten Seiteneffekte.
- **Fehler über Exceptions**, nicht über `boolean`-Rückgabewerte.

```typescript
// ❌ Schlecht
function handle(user: User, isAdmin: boolean, sendMail: boolean) { ... }

// ✅ Gut
interface HandleUserOptions {
  readonly user: User;
  readonly role: UserRole;
  readonly notifications: NotificationConfig;
}
function handleUser(options: HandleUserOptions): void { ... }
```

### Code-Struktur

- **DRY** — ab der dritten Wiederholung abstrahieren (Rule of Three).
- **KISS** — einfachste funktionierende Lösung bevorzugen.
- **YAGNI** — keine Features auf Vorrat; nur bauen, was jetzt gebraucht wird.
- **Einheitliches Abstraktionslevel** — eine Funktion arbeitet auf genau einem Level.

### Fehlerbehandlung

- **Alle Fehler explizit typisieren** — kein `catch(e: any)`.
- **Eigene Error-Klassen** für domänenspezifische Fehler.
- **Keine stillen Fehler** — `catch` ohne Handling ist verboten.

```typescript
// ✅ Gut
class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}
```

## Tests

- **Jede neue Funktion braucht Testabdeckung** — mindestens Happy Path + ein Fehlerfall.
- **Testnamen beschreiben das erwartete Verhalten**, nicht die Implementierung: `should return null when user not found`.
- **Keine Logik in Tests** — nur Setup, Ausführung, Assertion. Kein `if`, kein `for`, keine Hilfsfunktionen mit Branches.

## Was Claude hier NICHT tun soll

Punkte, die nicht anderswo stehen und besondere Aufmerksamkeit brauchen:

- **Keine Magic Numbers** ohne benannte Konstante.
- **Keine auskommentierten Code-Blöcke** stehen lassen.
- **Keine Funktion über 20 Zeilen** ohne Rückfrage beim Nutzer.

## Pre-Commit Self-Review (Pflicht)

Vor jedem `git commit` führt Claude automatisch einen Self-Review durch. **Kein Commit ohne abgeschlossenen Review.** Wenn Punkte offen sind: erst beheben, dann committen.

Nach Abschluss des Reviews gibt Claude folgende strukturierte Ausgabe aus:

```
=== CLEAN CODE REVIEW ===

[ ] TypeScript
    - Kein `any` verwendet
    - Alle Return-Typen explizit
    - Strict Mode nicht ausgehebelt

[ ] Naming
    - Konventionen eingehalten (camelCase / PascalCase / UPPER_SNAKE)
    - Keine Abkürzungen
    - Namen sind selbsterklärend

[ ] Funktionen
    - Single Responsibility eingehalten
    - Keine Funktion > 20 Zeilen
    - Maximal 3 Parameter (oder Objekt)
    - Keine Flag-Parameter

[ ] Struktur
    - DRY: keine Wiederholungen ab Mal 3
    - YAGNI: kein Code auf Vorrat
    - Einheitlicher Abstraktionslevel

[ ] Kommentare
    - Kein auskommentierter Code
    - Kommentare erklären Warum, nicht Was

[ ] Fehlerbehandlung
    - Keine `catch(e: any)`
    - Keine stillen Fehler

[ ] Tests
    - Happy Path abgedeckt
    - Mindestens ein Fehlerfall

[ ] Boy Scout Rule
    - Code minimal besser als vorher

=== ERGEBNIS ===
✅ Bereit für Commit
– ODER –
❌ Offen: [Liste der Verstöße mit Datei + Zeile]
========================
```

## Häufige Fallstricke

| Problem | Ursache | Lösung |
|---|---|---|
| Graue Seite im Browser | CSP blockiert Vite Fast Refresh | Nur in dev: `unsafe-inline` + `unsafe-eval` in CSP — bereits konfiguriert |
| Leeres Dashboard nach Deploy | `VITE_API_BASE` fehlte beim Build | Mit beiden Env-Vars neu bauen |
| `EADDRINUSE` auf Port 5000 | macOS AirPlay Receiver | `PORT=3000 npm run dev` |
| `import.meta`-Warning im Build | esbuild CJS-Bundle + `import.meta.url` in pdfParser | Harmlos — Dead Code im CJS-Pfad |
| `._`-Dateien im tar.gz | macOS `tar` schreibt Metadaten | `COPYFILE_DISABLE=1 tar …` |
| `ERR_REQUIRE_ESM` beim Start | `@noble/hashes` oder `@scure/base` v2 im Lock | `overrides` in `package.json` prüfen; `otplib` nicht auf v13 upgraden |
| Tests laufen nicht lokal | `better-sqlite3 v9` hat kein prebuilt für Node 25 | `npm install --ignore-scripts` verwenden; Tests nur auf Node 18/20 lauffähig |
