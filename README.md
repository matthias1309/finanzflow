# FinanzFlow

Persönliches Finanz-Dashboard für deutsche Bankkonten (N26, DKB, ING). React-SPA + Express-5-API + SQLite. Single-User, läuft als Docker-Container auf einem Raspberry Pi.

## Schnellstart (lokale Entwicklung)

```bash
PORT=3000 npm run dev      # Nicht Port 5000 — macOS AirPlay belegt ihn
npm test                   # Vitest: Unit- + API-Tests
npm run test:e2e           # Playwright E2E (erfordert laufenden Dev-Server)
npm run build              # Production Build
```

## Deployment

FinanzFlow läuft ausschließlich als Docker-Container auf einem Raspberry Pi. Siehe **[`DEPLOYMENT.md`](DEPLOYMENT.md)** für:

- Ersteinrichtung (Docker Compose, HTTPS-Zertifikat, `.env`)
- Updates nach Code-Änderungen
- Backup der Datenbank
- Troubleshooting

Weitere Details zum Container-Setup: [`DOCKER.md`](DOCKER.md).

## Projektdokumentation

Siehe [`CLAUDE.md`](CLAUDE.md) für Projektstruktur, Architektur-Kernregeln und Entwicklungsprozess.
