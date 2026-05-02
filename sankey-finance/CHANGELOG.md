# Changelog

Alle nennenswerten Änderungen an FinanzFlow werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [Unreleased]

### Hinzugefügt
- **Mobile-Responsive UI (REQ-014)** — Hamburger-Menü mit Slide-in Drawer für Smartphones (<768 px); Sidebar wird bei Klick auf Nav-Link oder Backdrop automatisch geschlossen; fixierte Top-Bar mit Logo auf Mobile; responsive Grids auf allen Seiten (`grid-cols-2 lg:grid-cols-4` für KPIs, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` für Konten, `grid-cols-1 md:grid-cols-2` für Kategorien/Kontoübersicht); Abstände skalieren von `p-4` auf Mobile bis `p-8` auf Desktop

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
