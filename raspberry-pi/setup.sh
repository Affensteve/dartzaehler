#!/usr/bin/env bash
#
# DartZähler – Installations-Script für Raspberry Pi
# ---------------------------------------------------
# Installiert Node.js (falls nötig), Build-Tools, baut Frontend + Backend
# und registriert den systemd-Dienst.
#
# Ausführen aus dem Projektstamm:   sudo bash raspberry-pi/setup.sh
#
set -euo pipefail

# --- Projektpfad ermitteln (ein Verzeichnis über diesem Script) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_USER="${SUDO_USER:-pi}"
NODE_MAJOR=20

echo "==> DartZähler Setup"
echo "    Projekt:  $PROJECT_DIR"
echo "    Benutzer: $SERVICE_USER"

# --- 1) Node.js prüfen / installieren (LTS 20) ---
need_node=1
if command -v node >/dev/null 2>&1; then
  cur="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
  if [ "$cur" -ge 18 ]; then need_node=0; echo "==> Node.js $(node -v) bereits vorhanden"; fi
fi
if [ "$need_node" -eq 1 ]; then
  echo "==> Installiere Node.js ${NODE_MAJOR}.x ..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# --- 2) Build-Tools für native Module (better-sqlite3) ---
echo "==> Installiere Build-Abhängigkeiten (falls nötig) ..."
sudo apt-get install -y build-essential python3 git

# --- 3) Aufräumen: von anderen Plattformen (z. B. Windows) mitkopierte
#         node_modules und Build-Artefakte entfernen. Das native Modul
#         better-sqlite3 wird sonst nicht für Linux/ARM neu gebaut.
echo "==> Entferne evtl. vorhandene node_modules / Build-Artefakte ..."
sudo rm -rf "$PROJECT_DIR/backend/node_modules" "$PROJECT_DIR/frontend/node_modules" "$PROJECT_DIR/frontend/dist"

# --- 4) Abhängigkeiten installieren (plattformkorrekt) ---
echo "==> Installiere Backend-Abhängigkeiten ..."
sudo -u "$SERVICE_USER" npm --prefix "$PROJECT_DIR/backend" install --omit=dev

echo "==> Installiere & baue Frontend ..."
sudo -u "$SERVICE_USER" npm --prefix "$PROJECT_DIR/frontend" install
sudo -u "$SERVICE_USER" npm --prefix "$PROJECT_DIR/frontend" run build

# --- 5) .env anlegen, falls nicht vorhanden ---
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
  echo "==> Erstelle backend/.env aus Vorlage"
  sudo -u "$SERVICE_USER" cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
fi

# --- 6) systemd-Dienst einrichten ---
echo "==> Registriere systemd-Dienst ..."
TMP_SVC="$(mktemp)"
sed -e "s#/home/pi/dartzaehler#$PROJECT_DIR#g" \
    -e "s#^User=pi#User=$SERVICE_USER#" \
    "$SCRIPT_DIR/dartzaehler.service" > "$TMP_SVC"
sudo cp "$TMP_SVC" /etc/systemd/system/dartzaehler.service
rm -f "$TMP_SVC"

sudo systemctl daemon-reload
sudo systemctl enable dartzaehler
sudo systemctl restart dartzaehler

# --- 7) Fertig ---
IP="$(hostname -I | awk '{print $1}')"
echo ""
echo "==> Fertig! DartZähler läuft als Dienst."
echo "    Status:   sudo systemctl status dartzaehler"
echo "    Logs:     journalctl -u dartzaehler -f"
echo "    Aufrufen: http://${IP}:3000"
