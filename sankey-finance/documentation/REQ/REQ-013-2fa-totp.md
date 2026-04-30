# REQ-013 — Two-Factor Authentication Setup (TOTP)

## User Story

Als Nutzer von FinanzFlow  
möchte ich einen zweiten Faktor (TOTP) einrichten und verwalten können,  
damit mein Konto auch dann geschützt ist, wenn mein Passwort kompromittiert wird.

## Background

TOTP (Time-based One-Time Password, RFC 6238) erzeugt alle 30 Sekunden einen 6-stelligen Code in einer Authenticator-App (Google Authenticator, Authy, 1Password o.ä.). Beim ersten Dashboard-Aufruf nach der Einführung dieses Features wird der Nutzer durch den Setup-Flow geführt.

**8 Einmal-Recovery-Codes** werden direkt nach dem Setup angezeigt — genau einmal. Jeder Code kann nur einmal für einen Login verwendet werden. Über das Dashboard können neue Codes generiert werden (invalidiert alle alten).

**Notfall-Reset via CLI:** Falls weder TOTP noch Recovery-Codes verfügbar sind, kann 2FA über einen Server-Befehl zurückgesetzt werden.

**Umgebungsvariablen:**

| Variable | Zweck | Beispiel |
|---|---|---|
| `TOTP_ISSUER` | Name in der Authenticator-App | `FinanzFlow` |
| `SESSION_MAX_AGE_HOURS` | Session-Dauer in Stunden | `8` |

## Acceptance Criteria

```gherkin
Feature: TOTP-Setup und Verwaltung

  Scenario: Dashboard zeigt Setup-Prompt wenn 2FA nicht eingerichtet ist
    Given der Nutzer ist eingeloggt (nur Passwort, 2FA noch nicht konfiguriert)
    When der Nutzer das Dashboard aufruft
    Then wird ein deutlicher Hinweis angezeigt "2FA noch nicht eingerichtet"
    And ein Button "2FA jetzt einrichten" ist sichtbar

  Scenario: Setup-Flow — QR-Code wird angezeigt
    Given der Nutzer klickt auf "2FA jetzt einrichten"
    Then öffnet sich ein Setup-Dialog
    And ein QR-Code wird angezeigt, der mit einer Authenticator-App gescannt werden kann
    And der manuelle Eingabe-Key (Base32) ist ebenfalls sichtbar

  Scenario: Setup-Verifikation erfolgreich
    Given der Nutzer hat den QR-Code mit seiner Authenticator-App gescannt
    When der Nutzer einen gültigen 6-stelligen TOTP-Code eingibt und bestätigt
    Then ist 2FA aktiviert
    And 8 Recovery-Codes werden angezeigt
    And ein Hinweis erklärt, dass diese Codes nur einmal angezeigt werden

  Scenario: Setup-Verifikation schlägt fehl
    Given der Nutzer hat den QR-Code gescannt
    When der Nutzer einen falschen 6-stelligen Code eingibt
    Then bleibt der Setup-Dialog offen
    And eine Fehlermeldung "Ungültiger Code — bitte erneut versuchen" wird angezeigt
    And 2FA ist nicht aktiviert

  Scenario: Recovery-Codes werden nur einmal angezeigt
    Given 2FA wurde gerade erfolgreich eingerichtet
    And die Recovery-Codes wurden angezeigt
    When der Nutzer den Dialog schließt und erneut öffnet
    Then sind die Recovery-Codes nicht mehr sichtbar
    And nur die Anzahl verbleibender Codes wird angezeigt

  Scenario: Recovery-Codes neu generieren
    Given der Nutzer ist eingeloggt und 2FA ist aktiv
    When der Nutzer im Dashboard auf "Recovery-Codes neu generieren" klickt
    And die Aktion in einem Bestätigungsdialog bestätigt
    Then werden 8 neue Recovery-Codes angezeigt
    And alle alten Recovery-Codes sind dauerhaft ungültig

  Scenario: 2FA zurücksetzen via CLI
    Given der Nutzer hat keinen Zugriff mehr auf TOTP und alle Recovery-Codes sind verbraucht
    When der Serverbefehl "npm run 2fa:reset" auf dem Server ausgeführt wird
    Then wird 2FA deaktiviert und der TOTP-Secret gelöscht
    And beim nächsten Login-Versuch reicht das Passwort allein
    And das Dashboard zeigt den Setup-Prompt erneut an
```

## Notes

- Der TOTP-Secret wird verschlüsselt in der Datenbank gespeichert (AES-256, Key via Umgebungsvariable `TOTP_ENCRYPTION_KEY`).
- Recovery-Codes werden als bcrypt-Hashes gespeichert — nie im Klartext.
- Zeitfenster für TOTP-Validierung: ±1 Schritt (±30 s) gegen Uhr-Drift auf Client oder Server.
- Jeder TOTP-Code darf nur einmal pro 30-s-Fenster akzeptiert werden (Replay-Schutz via last-used-timestamp in DB).
- Der Setup-Flow ist nur zugänglich wenn der Nutzer eingeloggt ist (Passwort-Auth bereits erfolgt).
- `npm run 2fa:reset` ist ein separates Script (`script/reset2fa.ts`), das direkt auf die DB schreibt — kein API-Endpunkt.
