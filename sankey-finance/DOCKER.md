# FinanzFlow Docker Setup

Die App ist jetzt vollständig containerisiert. Hier sind die wichtigsten Commands:

## Quick Start

```bash
# 1. Environment-Variablen konfigurieren (nur beim ersten Mal)
cp .env.example .env
# .env anpassen — besonders APP_PASSWORD_HASH, SESSION_SECRET, TOTP_ENCRYPTION_KEY

# 2. Container starten
docker compose up -d

# 3. App im Browser öffnen
# http://localhost:3000
```

## Commands

```bash
# Container starten
docker compose up -d

# Logs anschauen
docker compose logs -f app

# Container stoppen
docker compose down

# Container neustarten (nach Config-Änderungen)
docker compose restart app

# In den Container gehen
docker compose exec app sh

# Datenbank-Volume anschauen
docker volume ls
docker volume inspect sankey-finance_finanzflow_data
```

## Environment-Variablen

Alle Variablen befinden sich in der `.env`-Datei im Root des Projekts. Siehe `.env.example` für alle erforderlichen Felder.

### Wichtige Keys generieren

**APP_PASSWORD_HASH** (bcrypt für Login):
```bash
npm install -g bcryptjs
bcryptjs hash 'yourpassword'
# → $2b$10$...
```

**SESSION_SECRET** (16 bytes, als 32 Hex-Zeichen):
```bash
openssl rand -hex 16
```

**TOTP_ENCRYPTION_KEY** (32 bytes, als 64 Hex-Zeichen):
```bash
openssl rand -hex 32
```

## Architecture

### Dockerfile (Multi-Stage)
- **Build-Stage**: Installiert Dependencies, baut Client (Vite) + Server (esbuild)
- **Runtime-Stage**: Enthält nur Produktions-Dependencies, lädt Built-Artifacts

### docker-compose.yml
- Service `app` — NodeJS-Prozess auf Port 3000
- Volume `finanzflow_data` — persistente SQLite-Datenbank (`/data/finance.db`)
- Healthcheck — prüft API-Health alle 30 Sekunden

### Volumes
```
finanzflow_data  →  /data/finance.db (SQLite)
```

## Authentifizierung im Container

```
Benutzername: admin
Passwort: (aus APP_PASSWORD_HASH; lokal: 'admin')
```

Zum Ändern: neue `.env` mit neuem `APP_PASSWORD_HASH` generieren, dann `docker compose restart app`.

## Bekannte Probleme & Lösungen

| Problem | Ursache | Lösung |
|---------|--------|--------|
| `App stellt sich auf 502 Bad Gateway` | Falscher Healthcheck-Response | Prüfen: `docker compose logs app` |
| `Permission denied` für `/data` | Volume-Zugriffs-Problem | `docker volume rm finanzflow_data && docker compose up -d` |
| `TOTP_ENCRYPTION_KEY fehlt` | `.env` nicht geladen oder leer | `cat .env` prüfen, 64 Hex-Zeichen |
| `Cannot find module 'better-sqlite3'` | Native Module nicht kompiliert | Dockerfile-Build prüfen: `docker build --no-cache -t finanzflow .` |

## Production-Deployment

Für Production:
1. Echte, sichere Keys in `.env` generieren
2. `APP_ORIGIN` anpassen (auf Produktions-URL)
3. `NODE_ENV=production` (bereits gesetzt)
4. Secrets besser als `.env`-Datei verwalten (z.B. Docker Secrets oder Env-Var-Injection)

```bash
# Production mit Secrets
docker compose -f docker-compose.yml \
  --env-file /path/to/production.env \
  up -d
```

## Development mit Hot-Reload

Falls du den dev-Server mit Hot-Reload brauchst (nicht der Container), nutze lokal:

```bash
PORT=3000 npm run dev
```

Der Container ist für **production-like Testing** gedacht.
