# Documentation — CLAUDE.md

Zwei Dokumentationsarten: **Software-Anforderungen** (REQ/) und **Architekturdokumentation** (architecture/ARC42.md). Beide müssen bei Änderungen an der Software aktualisiert werden.

## Anforderungen (REQ/)

### Wann eine neue REQ-Datei erstellen

Bei jeder neuen Funktion, die ein sichtbares Benutzerverhalten beschreibt. Interne Refactorings, Performance-Optimierungen und Bugfixes brauchen keine eigene REQ.

### Dateiname und ID

```
REQ-{NNN}-{kurzname}.md    z.B. REQ-013-export-csv.md
```

Die ID ist fortlaufend. Neue Datei im README.md-Index unter `REQ/README.md` eintragen.

### Pflichtstruktur jeder REQ-Datei

```markdown
# REQ-NNN — Titel

## User Story

Als [Benutzerrolle],
möchte ich [Funktion],
damit [Nutzen].

## Background

[Kontext, Geschäftsregeln, relevante Datenmodelle, Abhängigkeiten zu anderen Features]

## Acceptance Criteria

\`\`\`gherkin
Feature: [Titel]

  Scenario: [Beschreibung]
    Given [Ausgangszustand]
    When [Aktion]
    Then [Erwartetes Ergebnis]
\`\`\`

## Notes

[Implementierungsdetails, Randfälle, Einschränkungen]
```

### Gherkin-Regeln

- **Given** — stabiler Ausgangszustand (Datenbankinhalt, UI-Zustand)
- **When** — genau eine Benutzeraktion oder ein Systemereignis
- **Then** — messbare, überprüfbare Ergebnisse (HTTP-Status, sichtbares UI-Element, DB-Inhalt)
- Keine Implementierungsdetails in Gherkin — was, nicht wie
- Deutsche Benutzernamen und Bezeichnungen (z.B. "Girokonto", "Importieren", "Kategorie")
- Technische IDs und Endpunkte sind erlaubt (z.B. `POST /api/transactions/batch`)

### Sprache

Englisch: Dateistruktur, Feldnamen, technische Begriffe  
Deutsch: Benutzerinteraktionen, UI-Labels, Fehlermeldungen in Gherkin

### Bestehende REQs aktualisieren

Bei Feature-Änderungen die betroffene REQ-Datei mitändern — insbesondere `## Notes` für Implementierungsdetails und neue Szenarien in `## Acceptance Criteria`.

---

## Architekturdokumentation (architecture/ARC42.md)

Arc42 mit 12 Kapiteln. Vollständige Struktur ist in der Datei selbst dokumentiert.

### Was muss aktualisiert werden

| Änderung | Zu aktualisierende Kapitel |
|---|---|
| Neue Route / neuer Endpunkt | Kap. 5 (Building Block View → Server) |
| Neue Seite / Komponente | Kap. 5 (Building Block View → Client) |
| Neue Tabelle / neues Feld | Kap. 5 (Building Block View → Datenbank) |
| Neue externe Abhängigkeit | Kap. 3 (System Scope), Kap. 4 (Solution Strategy) |
| Neue Architekturentscheidung (ADR) | Kap. 9 (Architecture Decisions) — neues ADR-NNN |
| Neues Sicherheitskonzept | Kap. 8.1 (Crosscutting Concepts → Security) |
| Neues Risiko / Tech Debt | Kap. 11 (Risks and Technical Debt) |
| Deployment-Änderung | Kap. 7 (Deployment View) |

### ADR-Format (Kapitel 9)

```markdown
### ADR-NNN — Kurztitel

**Context:** Warum war eine Entscheidung nötig?

**Decision:** Was wurde entschieden?

**Consequences:**
- ✅ Vorteil
- ⚠️ Nachteil / Einschränkung
```

ADRs sind immutable — bestehende ADRs werden nicht geändert, sondern durch einen neuen ADR ersetzt/überschrieben, der auf den alten verweist.

### Diagramme

ASCII-Diagramme bevorzugen (keine externen Tools erforderlich, versionierbar). Mermaid ist akzeptabel für komplexere Strukturen (GitHub rendert es).

### Glossar (Kapitel 12)

Neue fachliche oder technische Begriffe die im Dokument verwendet werden immer ins Glossar aufnehmen.
