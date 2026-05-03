# REQ-015 — Multi-User Management

## User Story

Als Admin von FinanzFlow  
möchte ich weitere Benutzerkonten anlegen und verwalten können,  
damit mehrere Personen mit denselben Datenzugriffsrechten die App nutzen können.

## Background

FinanzFlow unterstützt mehrere Benutzerkonten. Alle Benutzer teilen denselben Datensatz (Konten, Transaktionen, Kategorien). Es gibt zwei Rollen:

- **Admin**: Kann alle Daten verwalten und Benutzer anlegen, bearbeiten, löschen sowie Passwörter anderer Benutzer setzen. Kann anderen Benutzern Admin-Rechte vergeben oder entziehen.
- **Normaler Benutzer**: Kann alle Daten verwalten, aber kein User-Management. Kann nur das eigene Passwort ändern (über ein Profil-Dropdown in der Navigation).

**Datenmodell:** Benutzer werden in der `users`-Tabelle gespeichert (`id`, `username`, `passwordHash`, `isAdmin`, `totpSecret`, `totpEnabled`, `createdAt`).

**Seeding beim Start:** Beim Serverstart wird der Benutzer aus `APP_USER` und `APP_PASSWORD_HASH` in die DB synchronisiert (upsert mit `isAdmin=true`). Fehlen diese Umgebungsvariablen im Production-Mode, schlägt der Start fehl (siehe REQ-001).

**Schutz des letzten Admins:** Es muss immer mindestens ein Admin-Benutzer existieren. Der letzte Admin kann weder gelöscht noch zum normalen Benutzer degradiert werden.

**TOTP:** Jeder Benutzer richtet ein eigenes TOTP ein. Neue Benutzer werden beim ersten Login durch den TOTP-Setup-Flow geführt (siehe REQ-013). Admins können das TOTP eines beliebigen Benutzers zurücksetzen.

**Session-Invalidierung:** Ändert ein Admin das Passwort eines anderen Benutzers oder setzt dessen TOTP zurück, werden alle aktiven Sessions dieses Benutzers invalidiert.

**UI:** Die User-Verwaltungsseite (`/users`) ist nur für Admin-Benutzer zugänglich. Normale Benutzer ändern ihr Passwort über ein Profil-Dropdown in der Navigation.

## Acceptance Criteria

```gherkin
Feature: User-Verwaltung

  Background:
    Given die App läuft im production mode
    And ein Admin-Benutzer "admin" ist eingeloggt

  Scenario: Admin sieht User-Liste
    Given mindestens ein weiterer Benutzer "lisa" existiert
    When der Admin die Seite "/users" aufruft
    Then sieht er eine Liste aller Benutzer
    And für jeden Benutzer sind Username, Admin-Status und TOTP-Status sichtbar

  Scenario: Admin legt neuen Benutzer an
    When der Admin auf "Benutzer anlegen" klickt
    And Username "lisa" und ein initiales Passwort eingibt
    And das Formular abschickt
    Then erscheint "lisa" in der Benutzerliste
    And "lisa" hat kein Admin-Recht
    And TOTP ist für "lisa" noch nicht eingerichtet

  Scenario: Username bereits vergeben
    Given ein Benutzer "lisa" existiert bereits
    When der Admin versucht einen weiteren Benutzer mit dem Namen "lisa" anzulegen
    Then bleibt das Formular offen
    And eine Fehlermeldung "Benutzername bereits vergeben" wird angezeigt

  Scenario: Admin vergibt Admin-Rechte
    Given ein Benutzer "lisa" ohne Admin-Rechte existiert
    When der Admin bei "lisa" den Admin-Status aktiviert
    Then hat "lisa" Admin-Rechte
    And kann die Seite "/users" aufrufen

  Scenario: Admin entzieht Admin-Rechte
    Given ein Benutzer "lisa" mit Admin-Rechten existiert
    And mindestens ein weiterer Admin existiert
    When der Admin bei "lisa" den Admin-Status deaktiviert
    Then hat "lisa" keine Admin-Rechte mehr

  Scenario: Letzter Admin kann nicht degradiert werden
    Given "admin" ist der einzige Admin
    When der Admin versucht sich selbst den Admin-Status zu entziehen
    Then bleibt der Admin-Status unverändert
    And eine Fehlermeldung "Letzter Admin kann nicht degradiert werden" wird angezeigt

  Scenario: Admin löscht Benutzer
    Given ein Benutzer "lisa" existiert
    When der Admin bei "lisa" auf "Löschen" klickt
    And die Aktion im Bestätigungsdialog bestätigt
    Then ist "lisa" nicht mehr in der Benutzerliste
    And alle aktiven Sessions von "lisa" werden invalidiert

  Scenario: Letzter Admin kann nicht gelöscht werden
    Given "admin" ist der einzige Admin
    When der Admin versucht sich selbst zu löschen
    Then erscheint eine Fehlermeldung "Letzter Admin kann nicht gelöscht werden"
    And der Benutzer bleibt erhalten

  Scenario: Admin setzt Passwort eines anderen Benutzers
    Given ein Benutzer "lisa" existiert
    When der Admin bei "lisa" ein neues Passwort setzt
    Then kann sich "lisa" mit dem neuen Passwort einloggen
    And alle aktiven Sessions von "lisa" werden invalidiert

  Scenario: Benutzer ändert eigenes Passwort erfolgreich
    Given "lisa" ist eingeloggt
    When "lisa" im Profil-Dropdown das alte und das neue Passwort eingibt und bestätigt
    Then ist das neue Passwort aktiv
    And die aktuelle Session bleibt erhalten

  Scenario: Benutzer ändert eigenes Passwort — falsches altes Passwort
    Given "lisa" ist eingeloggt
    When "lisa" ein falsches altes Passwort eingibt
    Then bleibt das Formular offen
    And eine Fehlermeldung "Aktuelles Passwort falsch" wird angezeigt

  Scenario: Normaler Benutzer hat keinen Zugriff auf /users
    Given "lisa" ist eingeloggt und hat kein Admin-Recht
    When "lisa" die Seite "/users" aufruft
    Then wird "lisa" zum Dashboard weitergeleitet
    And eine Fehlermeldung "Kein Zugriff" wird angezeigt

  Scenario: Admin setzt TOTP eines Benutzers zurück
    Given ein Benutzer "lisa" hat TOTP eingerichtet
    When der Admin bei "lisa" auf "2FA zurücksetzen" klickt
    And die Aktion im Bestätigungsdialog bestätigt
    Then ist TOTP für "lisa" deaktiviert
    And alle Recovery-Codes von "lisa" sind ungültig
    And beim nächsten Login wird "lisa" durch den TOTP-Setup-Flow geführt
    And alle aktiven Sessions von "lisa" werden invalidiert

  Scenario: ENV-Sync beim Start — Benutzer existiert noch nicht
    Given APP_USER ist auf "admin" gesetzt
    And APP_PASSWORD_HASH ist auf einen gültigen bcrypt-Hash von "secret" gesetzt
    And kein Benutzer mit dem Namen "admin" existiert in der DB
    When der Server startet
    Then wird ein Benutzer "admin" mit isAdmin=true in der DB angelegt
    And der Passwort-Hash entspricht APP_PASSWORD_HASH

  Scenario: ENV-Sync beim Start — Benutzer wird aktualisiert
    Given APP_USER ist auf "admin" gesetzt
    And APP_PASSWORD_HASH ist auf einen neuen bcrypt-Hash gesetzt
    And ein Benutzer "admin" existiert bereits mit einem anderen Passwort-Hash
    When der Server startet
    Then wird der Passwort-Hash von "admin" auf APP_PASSWORD_HASH aktualisiert
    And isAdmin bleibt true

  Scenario: Neuer Benutzer wird beim ersten Login durch TOTP-Setup geführt
    Given "lisa" wurde neu angelegt und TOTP ist noch nicht eingerichtet
    When "lisa" sich mit Username und Passwort erfolgreich einloggt
    Then wird "lisa" direkt zum TOTP-Setup-Flow weitergeleitet (siehe REQ-013)
    And kann das Dashboard erst nach abgeschlossenem TOTP-Setup aufrufen
```

## Notes

- API-Endpunkte: `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`, `PATCH /api/users/:id/password`, `POST /api/users/:id/2fa-reset`
- Admin-Middleware schützt alle `/api/users`-Endpunkte außer `PATCH /api/users/:id/password` (nur Authentifizierung erforderlich, User darf nur die eigene ID verwenden)
- Session-Invalidierung bei Passwort-Reset und TOTP-Reset durch Admin: alle Sessions des betroffenen Benutzers werden aus dem Session-Store entfernt. Erfordert Zugriff auf den Session-Store in der Route.
- Passwort-Mindestlänge: 8 Zeichen, geprüft via Zod in `shared/schema.ts`.
- Benutzer-IDs in API-Requests: Integer (DB-PK), nicht Username — verhindert Pfad-Probleme mit Sonderzeichen im Username.
- Migration bestehender TOTP-Daten: Bei der DB-Migration wird der vorhandene TOTP-Secret aus dem Single-User-Setup in den `users`-Eintrag des Seed-Admins übertragen.
