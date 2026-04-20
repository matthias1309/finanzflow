#!/bin/bash
# ============================================================
# FinanzFlow -- Uberspace Setup-Skript
# Einmalig ausfuehren nach dem Hochladen des Pakets
# Erneut ausfuehren zum Aktualisieren auf eine neue Version
# ============================================================
set -e

APP_DIR="/var/www/virtual/$USER/finanzflow"
DB_DIR="$HOME/finanzflow-data"
INI_FILE="$HOME/etc/services.d/finanzflow.ini"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "======================================================"
echo "       FinanzFlow -- Uberspace Setup"
echo "======================================================"
echo ""

# -- 0. Passwortschutz konfigurieren ------------------------
if [ -z "$APP_PASSWORD" ]; then
  echo "Passwortschutz (leer lassen = kein Schutz):"
  read -rsp "  APP_PASSWORD: " APP_PASSWORD
  echo ""
fi
if [ -n "$APP_PASSWORD" ] && [ -z "$APP_USER" ]; then
  APP_USER="admin"
fi

# -- 1. Verzeichnisse anlegen --------------------------------
echo "[1/6] Verzeichnisse anlegen..."
mkdir -p "$APP_DIR"
mkdir -p "$DB_DIR"
mkdir -p "$HOME/etc/services.d"

# -- 2. App-Dateien kopieren ---------------------------------
echo "[2/6] App-Dateien kopieren..."
cp "$SCRIPT_DIR/app/index.cjs" "$APP_DIR/"
cp "$SCRIPT_DIR/app/package.json" "$APP_DIR/"
cp "$SCRIPT_DIR/app/package-lock.json" "$APP_DIR/"
rm -rf "$APP_DIR/public"
cp -r "$SCRIPT_DIR/app/public" "$APP_DIR/"

# -- 3. Node.js-Abhaengigkeiten installieren -----------------
echo "[3/6] Node.js-Abhaengigkeiten installieren..."
echo "      (Das kann 1-2 Minuten dauern)"
cd "$APP_DIR"
npm ci --omit=dev 2>&1 | tail -3
echo "      Native Module kompilieren (better-sqlite3, C++17)..."
npm rebuild better-sqlite3 2>&1 | tail -3

# -- 4. Port ermitteln ---------------------------------------
echo "[4/6] Port ermitteln..."
EXISTING_PORT=$(uberspace web backend list 2>/dev/null | grep "/finanzflow" | grep -oP 'port \K[0-9]+' || true)
if [ -n "$EXISTING_PORT" ]; then
  PORT=$EXISTING_PORT
  echo "      Vorhandener Port wiederverwendet: $PORT"
else
  PORT=$(python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(('', 0))
port = s.getsockname()[1]
s.close()
print(port)
")
  echo "      Neuer Port: $PORT"
fi

# -- 5. supervisord .ini erstellen ---------------------------
echo "[5/6] supervisord .ini erstellen..."

# Falls der Dienst bereits laeuft, zuerst stoppen
if supervisorctl status finanzflow 2>/dev/null | grep -qE "RUNNING|STOPPED|EXITED"; then
  echo "      Bestehenden Dienst stoppen..."
  supervisorctl stop finanzflow 2>/dev/null || true
  supervisorctl remove finanzflow 2>/dev/null || true
fi

cat > "$INI_FILE" << EOF
[program:finanzflow]
command=node $APP_DIR/index.cjs
environment=NODE_ENV="production",PORT="$PORT",DB_PATH="$DB_DIR/finance.db",APP_PASSWORD="$APP_PASSWORD",APP_USER="${APP_USER:-admin}"
autostart=yes
autorestart=yes
startsecs=10
stderr_logfile=$HOME/logs/finanzflow.err.log
stdout_logfile=$HOME/logs/finanzflow.out.log
EOF

echo "      .ini erstellt: $INI_FILE"

# -- 6. Web-Backend setzen und Dienst starten ----------------
echo "[6/6] Web-Backend konfigurieren und Dienst starten..."

uberspace web backend set /finanzflow --http --port "$PORT" --remove-prefix 2>&1 || true

# Uberspace-Ablauf: reread -> update -> start
supervisorctl reread
supervisorctl update
sleep 2
supervisorctl start finanzflow
sleep 3

# -- Fertig --------------------------------------------------
STATUS=$(supervisorctl status finanzflow 2>/dev/null | awk '{print $2}' || echo "UNBEKANNT")
echo ""
echo "======================================================"
echo "  Setup abgeschlossen!"
echo "======================================================"
echo ""
echo "  App-URL:    https://$USER.uber.space/finanzflow"
echo "  Port:       $PORT"
echo "  Datenbank:  $DB_DIR/finance.db"
echo "  Dienst:     $STATUS"
if [ -n "$APP_PASSWORD" ]; then
  echo "  Passwort:   gesetzt (Benutzer: ${APP_USER:-admin})"
else
  echo "  Passwort:   KEIN SCHUTZ aktiv"
fi
echo ""
echo "  Dienst steuern:"
echo "    supervisorctl status finanzflow"
echo "    supervisorctl restart finanzflow"
echo "    supervisorctl tail finanzflow"
echo ""

if [ "$STATUS" != "RUNNING" ]; then
  echo "  HINWEIS: Dienst ist nicht RUNNING."
  echo "  Logs pruefen:"
  echo "    supervisorctl tail finanzflow"
  echo "    cat ~/logs/finanzflow.err.log"
  echo ""
fi
