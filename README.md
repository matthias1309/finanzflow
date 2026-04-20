# FinanzFlow — Uberspace Deployment

## Voraussetzungen

- Uberspace-Account mit SSH-Zugang
- Node.js ≥ 18 (auf Uberspace standardmäßig verfügbar: `node --version`)

---

## Installation (Ersteinrichtung)

### Schritt 1 — Paket hochladen

```bash
scp finanzflow-uberspace.tar.gz nutzername@bellatrix.uberspace.de:~
```

*(Hostname je nach deinem Uberspace-Server anpassen — steht im Dashboard)*

### Schritt 2 — SSH verbinden

```bash
ssh nutzername@bellatrix.uberspace.de
```

### Schritt 3 — Entpacken & Setup ausführen

```bash
tar -xzf finanzflow-uberspace.tar.gz
cd finanzflow-uberspace
chmod +x setup.sh
./setup.sh
```

Das Skript erledigt automatisch:
- App-Dateien nach `/var/www/virtual/$USER/finanzflow/` kopieren
- `npm ci --omit=dev` ausführen (Abhängigkeiten installieren)
- Freien Port reservieren
- supervisord-Dienst anlegen und starten
- Uberspace Web-Backend auf `/finanzflow` konfigurieren

### Schritt 4 — App aufrufen

```
https://DEIN-NUTZERNAME.uber.space/finanzflow
```

---

## Update auf neue Version

Einfach das neue Paket hochladen und `setup.sh` erneut ausführen.  
Die Datenbank (`~/finanzflow-data/finance.db`) wird dabei **nicht** verändert — alle Daten bleiben erhalten.

```bash
tar -xzf finanzflow-uberspace-neu.tar.gz
cd finanzflow-uberspace
./setup.sh
```

---

## Verzeichnisstruktur auf Uberspace

```
~/
├── finanzflow-data/
│   └── finance.db          ← SQLite-Datenbank (Buchungen, Konten, Kategorien)
├── logs/
│   └── finanzflow/
│       └── current          ← aktuelle Log-Datei
└── etc/
    └── services.d/
        └── finanzflow/
            └── run          ← supervisord-Startskript

/var/www/virtual/$USER/finanzflow/
├── index.cjs               ← kompilierter Server
├── public/                 ← React-Frontend (statische Dateien)
│   ├── index.html
│   └── assets/
└── node_modules/           ← Laufzeit-Abhängigkeiten
```

---

## Dienst steuern

```bash
# Status prüfen
supervisorctl status finanzflow

# Neu starten (z.B. nach Konfigurationsänderung)
supervisorctl restart finanzflow

# Stoppen
supervisorctl stop finanzflow

# Logs live verfolgen
tail -f ~/logs/finanzflow/current
```

---

## Datenbank sichern

```bash
# Backup erstellen
cp ~/finanzflow-data/finance.db ~/finanzflow-backup-$(date +%Y%m%d).db

# Auf lokalen Rechner kopieren
scp nutzername@server.uberspace.de:~/finanzflow-data/finance.db ./
```

---

## Troubleshooting

**App nicht erreichbar:**
```bash
# Dienst-Status prüfen
supervisorctl status finanzflow

# Web-Backend prüfen
uberspace web backend list

# Backend manuell setzen (PORT aus supervisord run-Skript ablesen)
cat ~/etc/services.d/finanzflow/run
uberspace web backend set /finanzflow --http --port XXXX
```

**Logs prüfen:**
```bash
tail -50 ~/logs/finanzflow/current
```

**Port-Konflikt:**
```bash
# Anderen freien Port wählen und run-Skript anpassen
nano ~/etc/services.d/finanzflow/run
# PORT=NEUE_PORTNUMMER setzen, dann:
uberspace web backend set /finanzflow --http --port NEUE_PORTNUMMER
supervisorctl restart finanzflow
```
