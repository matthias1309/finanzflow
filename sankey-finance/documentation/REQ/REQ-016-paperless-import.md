# REQ-016 — Paperless-Kontoauszug-Import

## User Story

Als Benutzer,
möchte ich Kontoauszüge, die ich bereits in Paperless-ngx archiviert habe, direkt in FinanzFlow einlesen lassen,
damit ich sie nicht zusätzlich manuell herunterladen und hochladen muss.

## Background

FinanzFlow kann PDF-Kontoauszüge bereits manuell verarbeiten (REQ-005): Upload → bankspezifischer Parser (`server/pdfParser.ts`) → Preview → Bestätigung. Paperless-ngx läuft auf demselben Raspberry Pi und archiviert dieselben Kontoauszüge bereits als PDF, getaggt mit `Kontoauszug` sowie einem zweiten Tag, der das Konto benennt (`Autokonto`, `Tagesgeldkonto`, `Essenskonto`, …).

Diese Funktion ergänzt eine zweite Quelle für PDFs — die Paperless-REST-API — vor dieselbe Parsing-Pipeline. Der bestehende Parser, die Preview und der Bestätigungs-Flow aus REQ-005 werden wiederverwendet, nicht dupliziert.

### Datenmodell

**Neue Tabelle `paperless_account_mappings`** — ordnet einen Paperless-Tag einem FinanzFlow-Konto zu:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | integer, PK | — |
| `paperlessTag` | text, unique | Zweiter Tag in Paperless, z.B. `"Essenskonto"` |
| `accountId` | integer, FK → `accounts.id` | Zugehöriges FinanzFlow-Konto |

**Neue Tabelle `paperless_imports`** — verhindert Doppel-Import bei wiederholten Sync-Läufen:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | integer, PK | — |
| `paperlessDocumentId` | integer, unique | Dokument-ID aus Paperless |
| `accountId` | integer, FK → `accounts.id` | Konto, dem der Import zugeordnet wurde |
| `importedAt` | text (ISO-Timestamp) | Zeitpunkt des Imports |

### Konfiguration

Neue Umgebungsvariablen (analog zu bestehenden Secrets in `.env`):

| Variable | Beschreibung |
|---|---|
| `PAPERLESS_BASE_URL` | z.B. `http://localhost:8000` (selbes Docker-Netz auf dem Pi) |
| `PAPERLESS_API_TOKEN` | Paperless-API-Token, nie im Client sichtbar |

## Acceptance Criteria

```gherkin
Feature: Paperless-Kontoauszug-Import

  Scenario: Mapping zwischen Paperless-Tag und Konto anlegen
    Given der Benutzer ist auf der Seite "Paperless-Einstellungen"
    When der Benutzer den Paperless-Tag "Essenskonto" dem Konto "Gemeinschaftskonto" zuordnet
    And auf "Speichern" klickt
    Then wird ein neuer Eintrag in paperless_account_mappings gespeichert
    And der Tag "Essenskonto" erscheint in der Mapping-Übersicht mit dem zugeordneten Konto

  Scenario: Bestehendes Mapping bearbeiten
    Given der Tag "Autokonto" ist aktuell dem Konto "Girokonto" zugeordnet
    When der Benutzer die Zuordnung auf das Konto "Auto & Verkehr" ändert
    Then wird der bestehende Eintrag in paperless_account_mappings aktualisiert
    And zukünftige Importe mit Tag "Autokonto" verwenden das neue Konto

  Scenario: Offene Paperless-Dokumente anzeigen
    Given in Paperless existieren 5 Dokumente mit Tag "Kontoauszug"
    And 3 davon sind bereits als paperless_imports erfasst
    When der Benutzer die Seite "Aus Paperless importieren" öffnet
    Then zeigt das System nur die 2 noch nicht importierten Dokumente an
    And jedes Dokument zeigt Dateiname, Paperless-Erstellungsdatum und erkannten Zweit-Tag

  Scenario: Dokument mit eindeutigem Konto-Tag automatisch zuordnen
    Given ein offenes Paperless-Dokument trägt die Tags "Kontoauszug" und "Essenskonto"
    And "Essenskonto" ist auf das Konto "Gemeinschaftskonto" gemappt
    When der Benutzer das Dokument zum Import auswählt
    Then wird das Konto "Gemeinschaftskonto" automatisch vorausgewählt
    And der Benutzer muss das Konto nicht manuell wählen

  Scenario: Dokument ohne gemappten Konto-Tag zeigt Hinweis
    Given ein offenes Paperless-Dokument trägt nur den Tag "Kontoauszug" ohne weiteren Konto-Tag
    When der Benutzer die Liste der offenen Dokumente ansieht
    Then wird das Dokument mit dem Hinweis "Kein Konto zugeordnet" markiert
    And der Benutzer kann das Konto manuell auswählen, bevor er importiert

  Scenario: Dokument mit mehreren Konto-Tags zeigt Hinweis
    Given ein offenes Paperless-Dokument trägt die Tags "Kontoauszug", "Autokonto" und "Essenskonto"
    When der Benutzer die Liste der offenen Dokumente ansieht
    Then wird das Dokument mit dem Hinweis "Mehrdeutige Zuordnung" markiert
    And keine automatische Kontoauswahl erfolgt
    And der Benutzer muss das Konto manuell auswählen, bevor er importiert

  Scenario: Dokument aus Paperless laden und parsen
    Given der Benutzer hat ein Paperless-Dokument mit erkanntem Konto ausgewählt
    When der Benutzer auf "Importieren" klickt
    Then lädt das System das PDF über die Paperless-API herunter
    And das PDF durchläuft dieselbe Parsing-Pipeline wie bei REQ-005 (Bank-Erkennung, Transaktions-Extraktion)
    And eine Preview-Tabelle zeigt die erkannten Transaktionen zur Bestätigung

  Scenario: Import bestätigen und Dokument als importiert markieren
    Given die Preview zeigt 12 aus einem Paperless-Dokument geparste Transaktionen
    When der Benutzer die Transaktionen bestätigt
    Then werden alle 12 Transaktionen dem zugeordneten Konto gespeichert
    And ein Eintrag mit der Paperless-Dokument-ID wird in paperless_imports angelegt
    And das Dokument erscheint bei zukünftigen Abfragen nicht mehr in der Liste offener Dokumente

  Scenario: Paperless nicht erreichbar
    Given PAPERLESS_BASE_URL ist konfiguriert, aber Paperless antwortet nicht
    When der Benutzer die Seite "Aus Paperless importieren" öffnet
    Then zeigt das System eine Fehlermeldung "Paperless ist nicht erreichbar"
    And die manuelle PDF-Upload-Funktion aus REQ-005 bleibt unverändert nutzbar

  Scenario: Ungültiger oder fehlender API-Token
    Given PAPERLESS_API_TOKEN ist nicht gesetzt oder von Paperless abgelehnt
    When das System versucht, Dokumente abzufragen
    Then wird ein Fehler "Paperless-Zugriff nicht autorisiert" angezeigt
    And keine Dokumente werden angezeigt
```

## Notes

- Wiederverwendung: `parsePDF()` aus `server/pdfParser.ts` bleibt unverändert — Paperless liefert nur den PDF-Buffer als zusätzliche Quelle anstelle des Multer-Uploads. Bank-Erkennung, Transaktions-Extraktion, Duplikat-Erkennung innerhalb eines Imports und Kategorie-Vorschläge (REQ-006) gelten identisch.
- Neuer Endpunkt `server/routes/paperless.ts`:
  - `GET /api/paperless/documents` — offene Dokumente inkl. erkanntem/mehrdeutigem/fehlendem Konto-Tag
  - `POST /api/paperless/documents/:id/import` — lädt, parsed, liefert Preview (analog zur Response von `POST /api/pdf`)
  - `POST /api/paperless/documents/:id/confirm` — speichert Transaktionen, legt `paperless_imports`-Eintrag an
  - `GET /api/paperless/mappings`, `POST /api/paperless/mappings`, `PUT /api/paperless/mappings/:id` — Verwaltung von `paperless_account_mappings`
- Die Tag-Auswertung ("Zweit-Tag ≠ Kontoauszug") erfolgt serverseitig anhand der von Paperless zurückgegebenen Tag-Liste pro Dokument, nicht durch String-Matching auf Dateinamen.
- Kein Auto-Matching per Namensähnlichkeit zwischen Paperless-Tag und Kontoname — die Zuordnung erfolgt ausschließlich explizit über `paperless_account_mappings`, um Fehlzuordnungen bei ähnlich benannten Konten zu vermeiden.
- Kein automatischer Hintergrund-Sync in dieser Version — der Import wird manuell über die UI angestoßen (siehe Risiko unten für spätere Erweiterung).
- `PAPERLESS_API_TOKEN` wird serverseitig verwendet und nie an den Client ausgeliefert (analog zu bestehenden Server-Secrets).
- Offen für eine spätere Version: automatischer Cronjob-Sync mit Benachrichtigung bei neuen Dokumenten — bewusst nicht Teil dieser REQ, da Fehlerbehandlung ohne UI-Interaktion zusätzliche Konzeption braucht.
