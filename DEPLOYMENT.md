# FinanzFlow Deployment

## Raspberry Pi (Docker HTTPS)

### Initiales Setup (einmalig)

```bash
# 1. Repository auf Pi klonen/kopieren
scp -r sankey-finance/ pi@192.168.178.159:/opt/containers/apps/finanzflow/

# 2. Self-Signed Zertifikat generieren
ssh pi@192.168.178.159
cd /opt/containers/apps/finanzflow/sankey-finance
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -nodes \
  -out certs/cert.pem -keyout certs/key.pem -days 3650 \
  -subj "/CN=192.168.178.159"

# 3. Datenbank vom Uberspace kopieren
scp mattmaxx@giclas.uberspace.de:~/finanzflow/finance.db ./data/finance.db

# 4. .env mit korrekten Werten erstellen
nano .env
# Wichtig: USE_HTTPS=true, APP_ORIGIN=https://192.168.178.159:3000

# 5. Docker Image bauen und starten
docker-compose build
docker-compose up -d
```

### Updates (nach Code-Änderungen)

**Auf dem Mac lokal bauen:**
```bash
cd sankey-finance
npm run build
```

**Auf dem Pi neu bauen:**
```bash
ssh pi@192.168.178.159
cd /opt/containers/apps/finanzflow/sankey-finance

# Aktuelle Dateien vom Mac kopieren
scp -r /Users/matthias/Claude\ Code/finanzflow/sankey-finance/* pi@192.168.178.159:/opt/containers/apps/finanzflow/sankey-finance/

# Container neu bauen
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Logs prüfen
docker-compose logs -f app
```

### Backup der Datenbank

```bash
# Von Pi auf Mac
scp pi@192.168.178.159:/opt/containers/apps/finanzflow/sankey-finance/data/finance.db ~/backup/finance-$(date +%Y%m%d).db

# Von Uberspace auf Mac
scp mattmaxx@giclas.uberspace.de:~/finanzflow/finance.db ~/backup/finance-uberspace-$(date +%Y%m%d).db
```

## Entwicklung lokal

### Dev-Server starten
```bash
cd sankey-finance
PORT=3000 npm run dev
```

### Tests
```bash
npm test
npm run test:e2e
```

### Bauen für Production
```bash
npm run build
```

## Environment Variablen

| Variable | Lokal | Pi Docker | Uberspace |
|----------|-------|----------|-----------|
| `NODE_ENV` | `development` | `production` | `production` |
| `DOCKER_DEPLOY` | - | `true` | - |
| `USE_HTTPS` | - | `true` | - |
| `APP_ORIGIN` | `http://localhost:3000` | `https://192.168.178.159:3000` | `https://mattmaxx.uberspace.de` |
| `DB_PATH` | `/data/finance.db` | `/data/finance.db` | `/home/user/finanzflow/finance.db` |

## Troubleshooting

### Weiße Seite im Browser
- Browser-Cache leeren (F12 → Application → Clear Storage)
- HTTPS-Zertifikat akzeptieren (falls neue Zertifikate)
- Logs prüfen: `docker-compose logs app`

### 2FA-Loop beim Login
```bash
# SSH in Pi
ssh pi@192.168.178.159
cd /opt/containers/apps/finanzflow/sankey-finance

# DB editieren
sqlite3 data/finance.db
UPDATE users SET totp_enabled = 0 WHERE username='admin';
.quit

# Neu starten
docker-compose restart app
```

### Container startet nicht
```bash
docker-compose logs app
# Häufig: Fehlende Zertifikate oder falsche .env
```
