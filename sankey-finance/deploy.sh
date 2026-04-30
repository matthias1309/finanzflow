#!/bin/bash
# Deployment-Skript für Uberspace (Update und Ersteinrichtung)
set -e

APP_DIR="/var/www/virtual/$USER/finanzflow"
SERVICES_DIR="$HOME/etc/services.d/finanzflow"

echo "==> Kopiere App-Dateien nach $APP_DIR ..."
mkdir -p "$APP_DIR"
cp -r dist/. "$APP_DIR/"
cp package.json package-lock.json "$APP_DIR/"

echo "==> Installiere Abhängigkeiten (devtoolset-11 für better-sqlite3) ..."
cd "$APP_DIR"
scl enable devtoolset-11 -- npm ci --omit=dev

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
