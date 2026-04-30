# FinanzFlow — Uberspace Deployment

## Voraussetzungen

- Uberspace-Account mit SSH-Zugang
- Node.js ≥ 18 (auf Uberspace standardmäßig verfügbar: `node --version`)

---

## Update auf neue Version

### Lokal: bauen und Paket erstellen

```bash
cd sankey-finance
DEPLOY_BASE="/finanzflow/" VITE_API_BASE="/finanzflow" npm run build
COPYFILE_DISABLE=1 tar -czf finanzflow-uberspace.tar.gz \
  dist/ package.json package-lock.json deploy.sh
```

> `node_modules` wird **nicht** eingepackt — native Addons (`better-sqlite3`) müssen auf dem Linux-Server kompiliert werden, macOS-Binaries laufen dort nicht.

### Hochladen und deployen

```bash
scp finanzflow-uberspace.tar.gz mattmaxx@giclas.uberspace.de:~
ssh mattmaxx@giclas.uberspace.de
tar -xzf finanzflow-uberspace.tar.gz
chmod +x deploy.sh
./deploy.sh
```

Das Skript erledigt automatisch:
- App-Dateien nach `/var/www/virtual/$USER/finanzflow/` kopieren
- `npm ci --omit=dev` via `scl enable devtoolset-11` ausführen (CentOS 7 braucht neueres g++ für `better-sqlite3`)
- supervisord-Dienst neu starten

Die Datenbank (`~/finanzflow-data/finance.db`) wird dabei **nicht** verändert.

---

## Ersteinrichtung supervisord (einmalig)

Falls der Dienst noch nicht existiert, muss er einmalig manuell angelegt werden.

### 1. Freien Port reservieren

```bash
uberspace port add
# → merke dir die ausgegebene Portnummer, z.B. 12345
```

### 2. Passwort-Hash erzeugen

```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('DEIN_PASSWORT', 10))"
```

### 3. supervisord-Dienst anlegen

```bash
mkdir -p ~/etc/services.d/finanzflow
cat > ~/etc/services.d/finanzflow/run << 'EOF'
#!/bin/bash
export NODE_ENV=production
export PORT=12345
export DB_PATH=/home/mattmaxx/finanzflow-data/finance.db
export APP_USER=admin
export APP_PASSWORD_HASH=HASH_AUS_SCHRITT_2
export APP_ORIGIN=https://mattmaxx.uber.space
export TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32)
export SESSION_MAX_AGE_HOURS=8
export TOTP_ISSUER=FinanzFlow
exec node /var/www/virtual/$USER/finanzflow/index.cjs
EOF
chmod +x ~/etc/services.d/finanzflow/run
```

> **Hinweis:** `TOTP_ENCRYPTION_KEY` muss dauerhaft gesetzt und gespeichert werden — wird er geändert, sind bestehende 2FA-Geheimnisse in der DB nicht mehr entschlüsselbar.

### 4. Dienst starten und Web-Backend setzen

```bash
supervisorctl reread
supervisorctl update
supervisorctl status finanzflow
uberspace web backend set /finanzflow --http --port 12345
```

### 5. App aufrufen

```
https://mattmaxx.uber.space/finanzflow
```

---

## Verzeichnisstruktur auf Uberspace

```
~/
├── finanzflow-data/
│   └── finance.db          ← SQLite-Datenbank (Buchungen, Konten, Kategorien)
└── etc/
    └── services.d/
        └── finanzflow/
            └── run          ← supervisord-Startskript

/var/www/virtual/$USER/finanzflow/
├── index.cjs               ← kompilierter Server
├── public/                 ← React-Frontend (statische Dateien)
│   ├── index.html
│   └── assets/
└── node_modules/           ← Laufzeit-Abhängigkeiten (auf Server kompiliert)
```

---

## Dienst steuern

```bash
supervisorctl status finanzflow
supervisorctl restart finanzflow
supervisorctl stop finanzflow
```

---

## Datenbank sichern

```bash
cp ~/finanzflow-data/finance.db ~/finanzflow-backup-$(date +%Y%m%d).db
scp mattmaxx@giclas.uberspace.de:~/finanzflow-data/finance.db ./
```

---

## Troubleshooting

**`FATAL Exited too quickly`:**
```bash
# Prozess manuell starten, um den echten Fehler zu sehen:
NODE_ENV=production node /var/www/virtual/$USER/finanzflow/index.cjs
```

**`Cannot find module` / `npm install` schlägt fehl:**
```bash
cd /var/www/virtual/$USER/finanzflow
rm -rf node_modules
scl enable devtoolset-11 -- npm ci --omit=dev
supervisorctl restart finanzflow
```

**App nicht erreichbar:**
```bash
uberspace web backend list
cat ~/etc/services.d/finanzflow/run   # PORT ablesen
uberspace web backend set /finanzflow --http --port XXXX
```

**Leeres Dashboard nach Deploy:**  
`VITE_API_BASE` fehlte beim Build → lokal neu bauen mit beiden Env-Variablen.

**Port-Konflikt:**
```bash
nano ~/etc/services.d/finanzflow/run
# PORT= anpassen, dann:
uberspace web backend set /finanzflow --http --port NEUE_PORTNUMMER
supervisorctl restart finanzflow
```
