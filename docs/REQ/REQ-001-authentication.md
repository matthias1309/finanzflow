# REQ-001 — Authentication & Access Control

> **Hinweis:** REQ-001 wurde mit REQ-013 erweitert. HTTP Basic Auth wurde durch session-basierte Authentifizierung mit TOTP (2FA) ersetzt. Die Login-Seite und der TOTP-Setup-Flow sind in REQ-013 beschrieben.

## User Story

Als Nutzer von FinanzFlow  
möchte ich, dass die App durch Passwort und einen zweiten Faktor geschützt ist,  
damit meine persönlichen Finanzdaten nicht von Dritten eingesehen werden können, die die URL kennen.

## Background

FinanzFlow ist auf einer öffentlichen URL deployed. Alle Routen — API und Frontend — müssen geschützt sein. Die App verwendet eine eigene Login-Seite mit session-basierter Authentifizierung: nach erfolgreichem Login (Passwort + TOTP) wird ein Session-Cookie gesetzt. HTTP Basic Auth wird nicht mehr verwendet.

Benutzerdaten (Username, Passwort-Hash, Admin-Flag, TOTP-Secret) werden in der `users`-Tabelle der Datenbank gespeichert. Beim Serverstart wird der Benutzer aus `APP_USER` und `APP_PASSWORD_HASH` in die DB synchronisiert (upsert mit `isAdmin=true`). Anlegen und Verwalten weiterer Benutzer ist in REQ-015 beschrieben.

In development mode (`NODE_ENV=development`) ist Auth vollständig deaktiviert, damit Entwicklungs- und Test-Workflows nicht blockiert werden.

**Session-Konfiguration:**
- Cookie-Flags: `httpOnly`, `Secure`, `SameSite=Strict`
- Standard-Session-Dauer: 8 Stunden (überschreibbar via `SESSION_MAX_AGE_HOURS`)
- Nach Ablauf: Redirect zur Login-Seite

## Acceptance Criteria

```gherkin
Feature: Session-basierte Authentifizierung mit 2FA

  Background:
    Given die App läuft im production mode
    And ein Benutzer "admin" mit Passwort "secret" existiert in der Datenbank
    And 2FA ist für "admin" bereits eingerichtet

  Scenario: Erfolgreicher Login mit korrektem Passwort und TOTP
    Given der Nutzer ist auf der Login-Seite
    When der Nutzer "admin" und "secret" eingibt und abschickt
    Then erscheint die TOTP-Eingabemaske
    When der Nutzer einen gültigen 6-stelligen TOTP-Code eingibt
    Then wird ein Session-Cookie gesetzt
    And der Nutzer wird zum Dashboard weitergeleitet

  Scenario: Falsches Passwort wird abgelehnt
    Given der Nutzer ist auf der Login-Seite
    When der Nutzer "admin" und ein falsches Passwort eingibt
    Then bleibt der Nutzer auf der Login-Seite
    And eine Fehlermeldung "Benutzername oder Passwort falsch" wird angezeigt
    And kein Session-Cookie wird gesetzt

  Scenario: Falscher TOTP-Code wird abgelehnt
    Given der Nutzer hat Passwort korrekt eingegeben
    And die TOTP-Eingabemaske ist sichtbar
    When der Nutzer einen falschen 6-stelligen Code eingibt
    Then bleibt der Nutzer auf der TOTP-Eingabemaske
    And eine Fehlermeldung "Ungültiger Code" wird angezeigt
    And kein Session-Cookie wird gesetzt

  Scenario: Login mit Recovery-Code
    Given der Nutzer hat Passwort korrekt eingegeben
    And die TOTP-Eingabemaske ist sichtbar
    When der Nutzer einen gültigen Recovery-Code eingibt
    Then wird ein Session-Cookie gesetzt
    And der Nutzer wird zum Dashboard weitergeleitet
    And der verwendete Recovery-Code ist dauerhaft ungültig

  Scenario: Brute-Force-Schutz auf Login-Versuche
    When dieselbe IP 10 fehlgeschlagene Login-Versuche innerhalb von 15 Minuten sendet
    Then gibt der 11. Versuch Status 429 zurück
    And die Fehlermeldung enthält "Zu viele Login-Versuche"

  Scenario: Session läuft ab
    Given der Nutzer ist eingeloggt
    And die Session ist abgelaufen
    When der Nutzer eine geschützte Seite aufruft
    Then wird der Nutzer zur Login-Seite weitergeleitet

  Scenario: Expliziter Logout
    Given der Nutzer ist eingeloggt
    When der Nutzer auf "Abmelden" klickt
    Then wird die Session serverseitig zerstört
    And der Cookie wird gelöscht
    And der Nutzer wird zur Login-Seite weitergeleitet

  Scenario: Produktionsstart ohne APP_USER oder APP_PASSWORD_HASH schlägt fehl
    Given APP_USER oder APP_PASSWORD_HASH ist nicht gesetzt
    And NODE_ENV ist "production"
    When der Server startet
    Then beendet sich der Server mit einer fatalen Fehlermeldung
    And die Fehlermeldung erklärt wie ein Passwort-Hash generiert wird

  Scenario: Development mode erlaubt Zugriff ohne Credentials
    Given APP_PASSWORD_HASH ist nicht gesetzt
    And NODE_ENV ist "development"
    When der Nutzer eine Seite aufruft
    Then ist der Zugriff ohne Login möglich
```

## Notes

- Passwortvergleich verwendet `timingSafeEqual` mit fixen 256-Byte-Puffern gegen Timing-Angriffe. Der Benutzereintrag wird anhand des Usernamens aus der `users`-Tabelle geladen; existiert er nicht, wird trotzdem ein Dummy-Vergleich durchgeführt (Timing-Leak verhindern).
- Der Brute-Force-Limiter zählt nur fehlgeschlagene Requests (`skipSuccessfulRequests: true`).
- Bcrypt-Kostenfaktor: 10. Passwort-Hashes werden nie geloggt oder in API-Responses zurückgegeben.
- TOTP-Verifikation: RFC 6238, Zeitfenster ±1 Schritt (30 s) gegen Uhr-Drift. Jeder Code ist nur einmal verwendbar (Replay-Schutz).
- Session-Daten werden server-seitig im Memory-Store gehalten (memorystore, TTL = Session-Dauer). Die Session enthält die Benutzer-ID; alle geschützten Routen lesen den Benutzer anhand dieser ID aus der DB.
