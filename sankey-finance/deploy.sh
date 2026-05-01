#!/bin/bash
# Deployment-Skript für Uberspace (Update und Ersteinrichtung)
set -e

APP_DIR="/var/www/virtual/$USER/finanzflow"
SERVICES_DIR="$HOME/etc/services.d/finanzflow"

echo "==> Kopiere App-Dateien nach $APP_DIR ..."
mkdir -p "$APP_DIR"
cp -r dist/. "$APP_DIR/"
cp package.json package-lock.json "$APP_DIR/"

echo "==> Installiere Abhängigkeiten ..."
cd "$APP_DIR"
# npm auf Uberspace liefert node-gyp@10, das -std=c++20 fordert. CentOS 7 hat
# maximal GCC 9 (devtoolset-9, C++17). Lösung:
#   1. npm ci --ignore-scripts: installiert alle Pakete ohne Build-Lifecycle
#   2. node-gyp@9 (C++17) + devtoolset-9 kompilieren better-sqlite3 manuell
npm ci --omit=dev --ignore-scripts

npm install --prefix /tmp/finanzflow-ngv9 node-gyp@9 2>/dev/null
cd "$APP_DIR/node_modules/better-sqlite3"
scl enable devtoolset-9 -- \
  node /tmp/finanzflow-ngv9/node_modules/node-gyp/bin/node-gyp.js rebuild --release
cd "$APP_DIR"

echo "==> Starte Dienst neu ..."
if supervisorctl status finanzflow &>/dev/null 2>&1; then
  supervisorctl restart finanzflow
  echo ""
  supervisorctl status finanzflow
else
  echo ""
  echo "HINWEIS: supervisord-Dienst noch nicht eingerichtet."
  echo "Siehe README.md → Abschnitt 'Ersteinrichtung supervisord'."
fi
