# FinanzFlow Deployment

## Raspberry Pi (Docker HTTPS)

### Initiales Setup (einmalig)

**1. Code auf Pi synchen:**
```bash
rsync -avp sankey-finance/ admin@dockerhome:/opt/containers/apps/finanzflow/
```

**2. Auf dem Pi: docker-compose.yml erstellen**
```bash
ssh admin@dockerhome
cd /opt/containers/apps/finanzflow

# Template in echte Config kopieren
cp docker-compose.yml.example docker-compose.yml
```

**3. .env Datei erstellen (falls nicht vorhanden)**
```bash
# Vorlage aus Root-Repo kopieren oder manuell erstellen
cat > .env << EOF
NODE_ENV=production
DOCKER_DEPLOY=true
USE_HTTPS=true
PORT=3000
DB_PATH=/data/finance.db
APP_ORIGIN=https://dockerhome:3000
APP_USER=admin
APP_PASSWORD_HASH=8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
SESSION_SECRET=b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0
TOTP_ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
TOTP_ISSUER=FinanzFlow
EOF
```

**4. Self-Signed Zertifikat generieren (einmalig)**
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -nodes \
  -out certs/cert.pem -keyout certs/key.pem -days 3650 \
  -subj "/CN=dockerhome"
```

**5. Datenbank vorbereiten**
```bash
mkdir -p data
# Optional: Datenbank vom Uberspace kopieren
scp mattmaxx@giclas.uberspace.de:~/finanzflow/finance.db ./data/finance.db
```

**6. Docker Image bauen und starten**
```bash
docker-compose build
docker-compose up -d
docker-compose logs -f app
```

### Updates (nach Code-Änderungen)

**Workflow mit rsync:**
```bash
# Auf dem Mac: Alles synchen
rsync -avp sankey-finance/ admin@dockerhome:/opt/containers/apps/finanzflow/

# Auf dem Pi: Neu bauen
ssh admin@dockerhome
cd /opt/containers/apps/finanzflow
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f app
```

**Wichtig:** `docker-compose.yml`, `.env`, `certs/` und `data/` bleiben auf dem Pi (nicht in Git)

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
