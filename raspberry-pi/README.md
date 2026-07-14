# Raspberry-Pi-Deployment

Dieser Ordner enthält alles für den Betrieb auf dem Pi:

- **`setup.sh`** – Ein-Klick-Installation: Node.js, Abhängigkeiten, Frontend-Build und Autostart-Dienst.
- **`dartzaehler.service`** – systemd-Unit für den Autostart.

## Schnellstart

```bash
git clone <REPO-URL> /home/pi/dartzaehler
cd /home/pi/dartzaehler
sudo bash raspberry-pi/setup.sh
```

Danach ist der DartZähler unter `http://<PI-IP>:3000` erreichbar und startet bei jedem Booten automatisch.

Die vollständige Schritt-für-Schritt-Anleitung (inkl. manueller Variante und Troubleshooting) steht im [Haupt-README](../README.md) und in [docs/SETUP.md](../docs/SETUP.md).
