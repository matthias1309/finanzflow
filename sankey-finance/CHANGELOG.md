# Changelog

Alle nennenswerten Änderungen an FinanzFlow werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [Unreleased]

### Hinzugefügt
- **Paperless-Kontoauszug-Import (REQ-016)** — Kontoauszüge, die bereits in Paperless-ngx (gleicher Raspberry Pi) archiviert sind, können ohne erneuten manuellen Upload übernommen werden
  - Zuordnungstabelle Paperless-Tag → Konto (`paperless_account_mappings`), z.B. Tag "Essenskonto" → Konto "Gemeinschaftskonto"
  - Neuer HTTP-Client `server/paperlessClient.ts` gegen die Paperless-REST-API (Tag-Auflösung + PDF-Download), eigene Fehlerklassen für Config-/Erreichbarkeits-/Auth-/API-Fehler
  - Dokumente mit Tag `Kontoauszug` werden nach eindeutigem, fehlendem oder mehrdeutigem Konto-Tag klassifiziert (`resolved` / `unmapped` / `ambiguous`)
  - Wiederverwendung der bestehenden PDF-Parsing-Pipeline (REQ-005) und Kategorie-Vorschläge (REQ-006) — nur die Quelle des PDFs ist neu
  - Neue Tabelle `paperless_imports` verhindert Doppel-Import bereits übernommener Dokumente
  - Neue API-Endpunkte unter `/api/paperless`: `GET/POST/PUT/DELETE /mappings`, `GET /documents`, `POST /documents/:id/import`, `POST /documents/:id/confirm`
  - Neue Seite `/import/paperless`: Zuordnungsverwaltung + Liste offener Dokumente mit Import-Vorschau (gleiches Preview-Pattern wie beim PDF-Upload)
  - **23 neue Tests**: `tests/server/unit/paperlessClient.test.ts` (gemocktes `fetch`), `tests/server/api/paperless.test.ts` (Supertest, gemockter `paperlessClient`/`pdfParser`)
  - **REQ-016** `documentation/REQ/REQ-016-paperless-import.md` mit 10 Gherkin-Szenarien

### Behoben
- **Login schlug immer fehl (SHA256- statt bcrypt-Vergleich)** — `POST /api/auth/login` hashte das eingegebene Passwort mit SHA256 und verglich es gegen `user.passwordHash` bzw. `APP_PASSWORD_HASH` — beide sind aber immer bcrypt-Hashes (siehe `routes/users.ts`, `.env.example`-Anleitung "Generate with: npx bcryptjs"). Der Vergleich konnte dadurch nie erfolgreich sein; jedes korrekte Passwort wurde als falsch abgelehnt. Login nutzt jetzt `bcrypt.compareSync()`. Zusätzlich abgesichert: ein undefinierter `user` bei gesetztem `useEnvHash` führte vorher zu einem ungefangenen 500er statt eines sauberen 401.
- **Auth-Bypass in Tests ausgehebelt** — `server/auth.ts` setzte `APP_PASSWORD_HASH` auf einen Default-Hash sobald die Variable leer war, auch wenn `NODE_ENV=test` den in `tests/server/setup.ts` vorgesehenen Auth-Bypass erzwingen sollte; dadurch schlugen praktisch alle API-Tests mit 401 fehl. Fallback greift jetzt nicht mehr bei `NODE_ENV=test`.
- **`tests/server/api/auth.test.ts` und `users.test.ts` liefen nie vollständig durch** — beide setzen bewusst einen echten `APP_PASSWORD_HASH`, um den echten Login-Flow zu testen; das war vom SHA256-Bug oben überdeckt und blieb daher unentdeckt. Nach dessen Behebung zeigten sich drei weitere, unabhängige Probleme:
  - `regenerate-recovery` und die "Full login flow"-Tests riefen `/api/auth/2fa/setup` bzw. `/api/auth/totp` mehrfach für dasselbe TOTP-Secret innerhalb desselben 30-Sekunden-Zeitfensters auf — `requireStepUp` bzw. die Replay-Protection (`totp_last_used_token`) lehnten die wiederholt identischen Codes ab. Tests generieren TOTP-Codes jetzt gezielt für unterschiedliche Zeitfenster (`totpCodeAt()`) bzw. aktivieren 2FA für unabhängige Testabschnitte über `resetAndReactivate2fa()` neu, statt ein bereits verbrauchtes Secret wiederzuverwenden.
  - `users.test.ts` rief alle admin-geschützten Endpunkte mit einem unauthentifizierten `request(app)` auf, obwohl die Datei (für den ENV-Sync-Login-Test) einen echten `APP_PASSWORD_HASH` setzt und Auth damit für die ganze Datei erzwungen wird. Alle Aufrufe laufen jetzt über eine eingeloggte `adminSession`.
  - Mehrere Tests erwarteten `isAdmin`/`totpEnabled` als `true`/`false`, obwohl diese Felder laut `shared/schema.ts` (und ARC42) vorsätzlich `0`/`1`-Integer sind, keine Booleans — Testerwartungen korrigiert.
- **BUG-001/002/003 — SankeyChart refactored (Security + Clean Code)**
  - CSS-Injection-Risiko geschlossen: Farben aus DB werden jetzt durch `safeCssColor()` geleitet bevor sie in SVG-`fill`-Attribute fließen
  - 30+ `(d: any)`-Callbacks durch typisierte Interfaces (`D3LayoutNode`, `D3LayoutLink`) ersetzt — kein `any` mehr in D3-Code
  - `useEffect` von ~208 Zeilen in 10 eigenständige Funktionen aufgeteilt (`collectChartData`, `buildNodeList`, `buildLinkList`, `computeChartDimensions`, `computeSankeyLayout`, `renderLinks`, `renderNodeRects`, `appendAccountNameLabel`, `appendAccountValueLabel`, `renderIncomeLabels`, `renderExpenseLabels`, `setupZoom`)
  - Magic Numbers `80` durch benannte Konstanten `ROW_HEIGHT_PX` / `ROW_MARGIN_PX` ersetzt
  - Tote Variable `centerLabel` entfernt
- **Speichern-Button bei Bearbeitung nicht klickbar** — Konto-, Kategorie- und Buchungs-Dialoge konnten beim Bearbeiten nicht gespeichert werden
  - `ibanSchema` lehnte leeren String `""` ab; IBAN-Feld wird nun intern als `null` (statt `""`) verwaltet, leerer Input wird zu `null` konvertiert
  - `accountTypeSchema` fehlte Wert `"other"` (Typ „Sonstiges" war im Formular wählbar, aber nicht im Schema erlaubt)
  - Alle drei Edit-Mutations (`updateAccount`, `updateTransaction`, `editCategory`) zeigen jetzt einen Fehler-Toast wenn der API-Call scheitert

### Hinzugefügt
- **Multi-User-Verwaltung (REQ-015)** — Admins können weitere Benutzer anlegen, löschen, Admin-Status vergeben, Passwörter setzen und 2FA zurücksetzen
  - Neue Seite `/users` (nur für Admins sichtbar): Benutzerliste mit Admin-Badge, TOTP-Status, Dialoge für alle Aktionen
  - Jeder Benutzer hat eigenes TOTP und eigene Recovery-Codes in der Datenbank
  - Erster Admin wird beim Serverstart aus `APP_USER`/`APP_PASSWORD_HASH` upserted (idempotent)
  - Letzter Admin ist vor Löschung und Degradierung geschützt
  - `GET /api/auth/me` gibt den eingeloggten Benutzernamen und Admin-Status zurück (Sidebar zeigt Benutzernamen)
  - Neue API-Endpunkte: `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`, `PATCH /api/users/:id/password`, `POST /api/users/:id/2fa-reset`
  - Neue Datenbanktabelle: `users` mit TOTP-Feldern; `recovery_codes` um `user_id` erweitert
  - **22 API-Tests** (`tests/server/api/users.test.ts`) und **Playwright E2E-Tests** (`tests/e2e/users.spec.ts`)
  - **REQ-015** `documentation/REQ/REQ-015-user-management.md` mit 16 Gherkin-Szenarien
  - **ADR-008** in ARC42: Entscheidung für Multi-User mit geteiltem Datensatz dokumentiert
- **Mobile-Responsive UI (REQ-014)** — Hamburger-Menü mit Slide-in Drawer für Smartphones (<768 px); Sidebar wird bei Klick auf Nav-Link oder Backdrop automatisch geschlossen; fixierte Top-Bar mit Logo auf Mobile; responsive Grids auf allen Seiten (`grid-cols-2 lg:grid-cols-4` für KPIs, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` für Konten, `grid-cols-1 md:grid-cols-2` für Kategorien/Kontoübersicht); Abstände skalieren von `p-4` auf Mobile bis `p-8` auf Desktop

### Geändert
- **Auth-Login nutzt Datenbank** — `POST /api/auth/login` sucht Benutzer per `storage.getUserByUsername()`; bei unbekanntem Benutzernamen wird ein Dummy-Hash verglichen (Timing-Schutz gegen Username-Enumeration)
- **Session speichert `userId`** — nach Login enthält `req.session.userId` die DB-ID des Benutzers; alle TOTP-Operationen arbeiten per-User
- **TOTP per User** — `totp_secret`, `totp_enabled`, `totp_pending_secret`, `totp_last_used_token` in der `users`-Tabelle statt in `app_settings`
- `requireAdmin`-Middleware in `server/auth.ts` schützt alle `/api/users`-Routen
- `REQ-001-authentication.md` und `REQ-013-2fa-totp.md` aktualisiert (Multi-User-Kontext, per-User TOTP)
- `npm run 2fa:reset` erwartet jetzt `--user <username>` als Pflichtargument

### Behoben
- **Kontoübertrag: Saldo des Zielkontos korrekt berechnet** — `GET /api/summary/:month` befüllt nun `transfersIn` für das Empfängerkonto; die Dashboard-Kontoübersicht addiert eingehende Überträge zum Saldo (`Einnahmen − Ausgaben + transfersIn`). Bisher zeigte das Zielkonto 0 € wenn die importierte Eingangs-Transaktion gelöscht wurde, um Doppelzählung im Sankey zu vermeiden.

## [0.5.0] – 2026-04-30

### Hinzugefügt
- **2FA-Setup-Flow im Dashboard** — vollständige UI für Einrichtung und Verwaltung von TOTP
  - Banner "2FA noch nicht eingerichtet" mit "Jetzt einrichten"-Button (nur wenn Auth aktiv)
  - Setup-Dialog: QR-Code (generiert aus `otpauth://`-URL), manueller Base32-Key, `InputOTP`-Feld zur Verifikation
  - Recovery-Codes-Anzeige direkt nach Setup: 8 Codes im Grid, "Codes kopieren"-Button (einmaliges Anzeigen)
  - Status-Zeile wenn 2FA aktiv: verbleibende Recovery-Codes + "Neu generieren"-Button
  - Regenerierungs-Dialog: Bestätigungsschritt (Warnung dass alte Codes ungültig werden), danach neue Codes einmalig anzeigen
- **Logout-Button** in der Sidebar (nur sichtbar wenn Auth aktiv)
- **`npm run 2fa:reset`** — CLI-Script für Notfall-Reset auf dem Server (`script/reset2fa.ts`)
- `authEnabled`-Flag im `GET /api/auth/2fa/status`-Response (Client zeigt UI nur wenn Auth aktiv)

### Abhängigkeiten
- `qrcode` hinzugefügt (QR-Code-Generierung im Browser)

## [0.4.0] – 2026-04-30

### Hinzugefügt
- **Zwei-Faktor-Authentifizierung (TOTP)** — vollständiger 2FA-Login-Flow nach RFC 6238
  - Zweistufiger Login: Passwort → TOTP-Code (oder Recovery-Code)
  - TOTP-Setup im Dashboard: Secret-Generierung, QR-Code-URL (`otpauth://`-Schema), Bestätigungsschritt
  - 8 Recovery-Codes (einmalig angezeigt), einzeln verbrauchbar, jederzeit neu generierbar
  - Replay-Schutz: gleicher TOTP-Code darf pro 30-Sekunden-Fenster nur einmal verwendet werden
  - TOTP-Secret verschlüsselt in der DB gespeichert (AES-256-CBC, Key via `TOTP_ENCRYPTION_KEY`)
- **Session-basierte Authentifizierung** ersetzt HTTP Basic Auth
  - `express-session` mit `MemoryStore`, `httpOnly`/`Secure`/`SameSite=Strict`-Cookie
  - Logout-Endpunkt (`POST /api/auth/logout`) zerstört die Session
  - Auth-Bypass im Dev/Test-Modus wenn `APP_PASSWORD_HASH` nicht gesetzt
- **Login-Seite** (`/login`) als eigene React-Seite mit zweistufigem Formular
- **Neue Datenbanktabellen**: `app_settings` (Key-Value-Store), `recovery_codes`
- **Neue API-Endpunkte**:
  - `POST /api/auth/login` — Passwort-Login
  - `POST /api/auth/totp` — TOTP- oder Recovery-Code-Verifikation
  - `POST /api/auth/logout`
  - `GET  /api/auth/status`
  - `GET  /api/auth/2fa/status` — öffentlich, kein Login nötig
  - `POST /api/auth/2fa/setup`
  - `POST /api/auth/2fa/verify-setup`
  - `POST /api/auth/2fa/regenerate-recovery`
- **Neue Anforderungsdatei** `REQ-013-2fa-totp.md`
- **ADR-007** in ARC42: Entscheidung für Session-Auth + TOTP dokumentiert
- **API-Tests** `tests/server/api/auth.test.ts` — 23 Tests für den gesamten Auth-Flow

### Geändert
- `REQ-001-authentication.md` vollständig überarbeitet (Basic Auth → Session + TOTP)
- `server/auth.ts`: `basicAuthMiddleware` ersetzt durch `requireAuth` (Session-Check)
- `server/createApp.ts`: Session-Middleware und Auth-Router eingebunden
- `server/storage.ts`: TOTP- und Recovery-Code-Methoden hinzugefügt
- `shared/schema.ts`: zwei neue Tabellen (`appSettings`, `recoveryCodes`)
- `client/src/App.tsx`: `/login`-Route außerhalb des Layout-Wrappers
- `client/src/lib/queryClient.ts`: 401-Fehler leitet auf `/#/login` um
- CLAUDE.md: Entwicklungsprozess (REQ-First + TDD) dokumentiert, Deployment-Variablen ergänzt

### Abhängigkeiten
- `otplib` hinzugefügt (TOTP-Generierung und -Verifikation)
- `express-session` + `@types/express-session` hinzugefügt
- `memorystore` hinzugefügt (Session-Store mit automatischem Ablauf)

---

## [0.3.0] – 2025-xx-xx

### Hinzugefügt
- Kategorie-Bearbeitung
- Konto-Sichtbarkeit umschaltbar
- Sicherheitsfixes (XSS, CSRF, ReDoS)
- Uberspace-Deployment-Fix

---

## [0.2.0] – 2025-xx-xx

### Hinzugefügt
- Test-Infrastruktur (Vitest + Supertest + Playwright)
- Arc42-Architekturdokumentation
- Software-Anforderungsdokumente (REQ-001 bis REQ-012)

---

## [0.1.0] – 2025-xx-xx

### Hinzugefügt
- Initiales Release: Sankey-Chart, Transaktionen, Kategorien, Konten, PDF-Import
- N26, DKB, ING Bank-Parser
- React SPA + Express 5 + SQLite (Drizzle ORM)
