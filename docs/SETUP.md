# Deployment & Troubleshooting

## Voraussetzungen

- Raspberry Pi (3/4/5) mit Raspberry Pi OS
- Node.js **20 LTS** (mind. 18)
- `build-essential`, `python3` (zum Kompilieren von `better-sqlite3`, falls kein Prebuild verfügbar ist)

Die Schritt-für-Schritt-Installation steht im [README](../README.md). Hier ergänzende Hinweise.

## Netzwerk

Der Server bindet standardmäßig an `0.0.0.0:3000` und ist damit im gesamten LAN erreichbar. Aufruf über die IP des Pi (`hostname -I`).

**Feste IP empfohlen**, damit sich die URL nicht ändert – entweder im Router (DHCP-Reservierung) oder via `dhcpcd.conf` auf dem Pi.

**mDNS:** Ist Avahi aktiv (Standard), ist der Pi meist auch unter `http://<hostname>.local:3000` erreichbar.

## Konfiguration (`backend/.env`)

```
PORT=3000          # Port
HOST=0.0.0.0       # Bind-Adresse (0.0.0.0 = ganzes LAN)
DB_PATH=./data/dartzaehler.db
```

## systemd-Dienst

Die Datei `raspberry-pi/dartzaehler.service` geht von `/home/pi/dartzaehler` und Benutzer `pi` aus. Bei abweichendem Pfad/Benutzer vor dem Kopieren anpassen (oder `setup.sh` nutzen, das dies automatisch ersetzt).

```bash
sudo systemctl status dartzaehler     # Status
journalctl -u dartzaehler -f          # Live-Logs
sudo systemctl restart dartzaehler    # Neustart
```

## Optional: Port 80 statt 3000

Damit die URL ohne `:3000` funktioniert, entweder in `.env` `PORT=80` setzen (dann muss der Dienst als root laufen oder die Capability `CAP_NET_BIND_SERVICE` erhalten) **oder** einen nginx-Reverse-Proxy davorsetzen:

```nginx
server {
  listen 80;
  location / { proxy_pass http://127.0.0.1:3000; }
}
```

## Troubleshooting

| Symptom | Ursache / Lösung |
|---|---|
| `Cannot find module 'express'` | `npm --prefix backend install` erneut ausführen |
| Beim Öffnen erscheint „Frontend wurde noch nicht gebaut" | `npm --prefix frontend run build` ausführen |
| `better-sqlite3`-Buildfehler | `sudo apt-get install -y build-essential python3` und neu installieren |
| Seite im LAN nicht erreichbar | Firewall/Port prüfen, `HOST=0.0.0.0`, richtige IP verwenden |
| Dienst startet nicht | `journalctl -u dartzaehler -e` ansehen; Pfad/User in der Service-Datei prüfen |
| Spielstände zurücksetzen | `rm backend/data/dartzaehler.db*` und Dienst neu starten |

## Backup

Die gesamte Historie liegt in einer einzigen Datei: `backend/data/dartzaehler.db`. Zum Sichern einfach kopieren (idealerweise bei gestopptem Dienst).
