# 🎯 DartZähler

**🇩🇪 Deutsch | [🇬🇧 English](README.en.md)**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node](https://img.shields.io/badge/Node-%E2%89%A518-brightgreen.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![Express](https://img.shields.io/badge/Express-4-000000.svg)
![Offline-first](https://img.shields.io/badge/Offline--first-yes-blue.svg)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

Ein moderner, responsiver Darts-Scorer für das lokale Netzwerk – gehostet auf einem Raspberry Pi. Handys dienen als Eingabegeräte (Numpad), Laptops/Monitore als Anzeigetafel. Mit Einzel- und Doppel-/Team-Spielen (501/301/101), Bots (Easy/Medium/Hard), Turnier-Modus, Live-Sync mehrerer Geräte, Statistik-/Analyse-Bereich, Achievements und drei Themes. Vollständig zweisprachig (DE/EN) und offline-fähig.

## Screenshots

<!-- Screenshots unter docs/screenshots/ ablegen (siehe docs/screenshots/README.md). -->

| Startseite | Spielansicht | Anzeigetafel (Cast) |
| --- | --- | --- |
| ![Startseite](docs/screenshots/home.png) | ![Spielansicht](docs/screenshots/game.png) | ![Cast](docs/screenshots/cast.png) |

| Statistik & Analyse | Turnierbaum |
| --- | --- |
| ![Analyse](docs/screenshots/analysis.png) | ![Turnier](docs/screenshots/tournament.png) |

## Schnellstart

```bash
git clone https://github.com/Affensteve/dartzaehler.git
cd dartzaehler
npm run setup      # installiert Backend + Frontend und baut das Frontend
npm start          # startet den Server (Standard: Port 3000)
```

Danach im Browser `http://<host>:3000` öffnen. Details zu Raspberry-Pi-Deployment, Update und Wartung siehe unten sowie [docs/SETUP.md](docs/SETUP.md).

---

## Funktionsumfang

- **Spielmodi:** 501, 301, 101
- **Check-In:** Straight In oder Double In
- **Checkout:** Double Out, Single Out oder **Master Out** (Finish auf Doppel **oder** Triple) – **pro Spieler** wählbar (ideal für Mixed-Level)
- **Match-Format:** *First to* (X Sätze à Y Legs), *Best of* (X Legs, Mehrheit gewinnt) oder *Unbegrenzt* (endlos Leg um Leg, endet manuell über „Spiel beenden & werten“) – mit Tooltip-Erklärung; **Best of** ist beim neuen Einzelspiel voreingestellt
- **Ausbullen:** konfigurierbares Rundenlimit mit sinnvollem Default je Modus (501→20, 301→15, 101→10), im Einzelspiel wie im Turnier; wird es ohne Checkout erreicht, entscheidet ein Bull-off (wer näher am Bull war) das Leg
- **Rundenanzeige** im Spiel (aktuelle Runde / Limit)
- **Numpad** mit Single/Double/Triple, Fehlwurf (0) und Undo; mit Double/Triple gewählt wird die 0 zu **0×2 / 0×3** (zwei bzw. drei Fehlwürfe auf einmal, nur solange genug Pfeile im Zug frei sind). Kein Triple-Bull (T25)
- **Checkout-Vorschläge:** bei Double Out nach offizieller Tabelle (dartcoach.de); bei Single Out wird das einfachste Feld bevorzugt (z. B. 10 statt D5, 18 statt D9); bei Master Out wird die darts1.de-Master-Tabelle genutzt (Triple-Finishes, bis 180) und zusätzlich die klassische **Doppel-Route als Alternative** angezeigt (z. B. Rest 18 → T6 oder D9); der Checkout-Modus hat einen erklärenden Tooltip. Der Vorschlag berücksichtigt die **im aktuellen Zug verbleibenden Pfeile** – mit nur noch einem Pfeil werden keine 3-Feld-Routen mehr angezeigt
- **Zählvariante (vor Spielbeginn wählbar):** Numpad (Dart für Dart), **Freitext-Summe** der Aufnahme oder **Board** (aufs virtuelle Dartboard tippen – der Ring bestimmt Single/Double/Triple, volle Detailstatistik wie beim Numpad) – in der Spiel-/Turnier-Konfiguration neben „Ausbullen nach Runden" festgelegt (pro Spiel bzw. pro Turnier). Der Umschalter zeigt die drei Modi mit Icon. Im Freitext-Modus werden 3 Pfeile je Aufnahme angenommen und beim Checkout die Pfeilzahl (1–3, auch per Tastatur) abgefragt, sodass **Ø, Legs und Siege** erfasst werden; die Pfeilanzeige (🎯) blendet sich aus und Detailwerte (Doppel-%, Checkout-%, 60+…180, Sektoren) entfallen. Das Eingabefeld ist automatisch fokussiert – im reinen Tastatur-Modus lässt sich fortlaufend „Zahl + Enter“ tippen; auf dem Handy (iPhone/Android) erscheint die reine Zifferntastatur. In der gestapelten Handy-Ansicht wird bei jedem Zugwechsel der **aktive Spieler automatisch in den sichtbaren Bereich gescrollt**.
- **Bust-Erkennung** inkl. „Rest 1"-Regel bei Double Out; Bust/Checkout-Meldung nennt den Spielernamen
- **Dart-Bots** in drei Schwierigkeitsstufen als vollwertige Gegner
- **Turnier-Modus:** 1 oder 2 Gruppen (Jeder gegen Jeden), Live-Tabelle (Ø, Legs, Punkte 2/0) die sich nach jedem Leg aktualisiert; optionale **KO-Phase** mit Kreuz-Seeding und Freilosen als **klassischer Turnierbaum**: je Runde eine eigene Spalte, jede Folgepartie mittig zwischen ihren Vorgängern, klassische Verbindungslinien, Legs je Spieler am rechten Rand, Sieger fett und Verlierer durchgestrichen; startbare Partien haben den Start-/Weiter-/Bull-off-Button direkt in der Box. Dreistufige Formate (Gruppe/KO/Finale), Tie-Break (Punkte→Leg-Diff→direkter Vergleich→Ø→Bull-off), **Platz 3 per Bull-off** und Abschluss-Podium mit Bestwerten. **Export des Turnierbaums als PNG oder PDF** (mit allen Ergebnissen; bei beendetem Turnier inklusive Endstand/Podium) – dependency-frei aus den Turnierdaten gerendert
- **Doppel-/Team-Spiel (X01):** im *Neues Spiel*-Setup gibt es die Tabs **Einzel** und **Doppel**. Im Doppel-Tab bildet man ueber **+Team** beliebig viele Teams (Standard 2 Slots je Team, **+Spieler** fuer weitere), je Team ein Name (auto „A & B“) und Checkout-Modus. Im Spiel teilen sich Partner **einen Team-Score**; die Werfer **rotieren** innerhalb des Teams (A1, B1, A2, B2, ...). Statistik wird **pro Spieler** aus dessen Wuerfen erfasst, der **Sieg zaehlt fuers Team**. Auf der Anzeigetafel zeigt die Team-Kachel einen **geteilten Avatar** beider Profilbilder, beide Namen und hebt den **aktiven Werfer** hervor (nur Menschen; Bots bleiben dem Einzelspiel vorbehalten). **Team-Achievements** (Doppel-Sieg, Team-Zu-Null, gemeinsames 180er-Leg, Partner-Checkout) werden beiden Partnern gutgeschrieben; **feste Doppel** lassen sich mit Name und Farbe speichern und im Setup per „Team laden" einfügen (Team-Farbe erscheint auf der Anzeigetafel); Bust-/Checkout-Ansagen nennen den **aktiven Werfer**
- **Spielerverwaltung:** Spieler anlegen/umbenennen (mit Checkout-Modus und **zugewiesenem Pfeil**), im Setup auswählbar; eindeutige IDs, Namensauflösung überall
- **Erweiterte Spielerprofile:** eigene **Profil-Seite** je Spieler (über die Verwaltung) mit **Foto-Upload** (clientseitig verkleinert) und **Profilfarbe**, **Spitzname/Anzeigename**, **Händigkeit**, **Lieblingsdoppel** (beeinflusst die Checkout-Vorschläge – die Route bevorzugt dieses Doppel, sofern mit den verbleibenden Pfeilen erreichbar), **Geburtstag**, **Verein/Team** und **Notizen**. Das Foto/​die Farbe erscheinen als Avatar auf der Spielerkarte (im Spiel und auf der Anzeigetafel) sowie in der Spielerliste. Die Profil-Seite zeigt zudem eine **Highlights-Karte** mit Zeitraumfilter (Spiele, Siege, Ø, Ø-Trend, bestes Leg, höchstes Checkout, 180er sowie **Lieblings-/Angst-Doppel** aus den gemessenen Doppel-Quoten)
- **Pfeile verwalten:** eigener Bereich für Pfeile (Name + Gewicht in Gramm); jeder Spieler bekommt standardmäßig einen 20-g-Pfeil, die Zuweisung ist im Setup wählbar und wird (wie der Checkout-Modus) je Spieler gespeichert. Jedes Spiel merkt sich den verwendeten Pfeil, sodass die Statistik pro Pfeil auswertbar ist
- **Vereinfachte Startseite & Verwaltung:** die Startseite bietet nur noch *Neues Spiel*, *Neues Turnier*, *Training*, **Verwaltung** und *Cast*. Unter **Verwaltung** liegen **Spieler- und Pfeilverwaltung nebeneinander** in einer Ansicht; darüber führen Buttons zu **Statistik, Match-Historie und Achievements**. Zurück-Navigation führt jeweils zur vorherigen Ansicht
- **Training:** eigener Bereich mit **14 Trainingsmodi** – Around the Clock, Bob's 27, Count-up, Cricket (Solo), Shanghai, Halve-it, Checkout-Challenge (121), **Checkout-Trainer** (wählbare/zufällige Rest-Stände, „Nur-Doppel" & „unter Druck"), **Doppel-Rundlauf** (D1→D20) und **Bull-Training** (beide speisen das Doppel-/Checkout-Profil) sowie vier **Scoring-Drills** (T20, T19, 100+- und 140+-Aufnahmen) – jeweils mit Anleitung und Dartboard-Erklärung. Je Modus/Spieler wird ein **Bestwert** gespeichert; im Statistik-Bereich „Training“ gibt es zudem **je Modus eine eigene Auswertung** (z. B. bei Around the Clock die Fehlversuche je Feld, bei Bob's 27 die verfehlten Doppel). Zusätzlich **X01 Unbegrenzt** (endlos, Ende über „Spiel beenden & werten“); im normalen Einzelspiel ist Unbegrenzt nicht wählbar. Ein **abgebrochenes Training** speichert seinen Zwischenstand und lässt sich beim nächsten Aufruf fortsetzen. Über den **Trainings-Builder** legst du eigene Übungen an (Ziel-Feld/Ring, Rundenzahl, Zielwert), planst sie je Wochentag (Wochenplan) und verfolgst den Fortschritt zum Ziel; der heutige Plan erscheint zusätzlich beim KI-Coach
- **Statistik-Bereich:** getrennt nach **Spiel & Turnier** und **Training** (Trainingsergebnisse verfälschen die Wertung nicht); Zeitfilter (Heute/7/30 Tage/Ganze Zeit), Ø, Erste-9, Double/Triple-%, 60+/100+/140+/180, Checkout-Quote, höchste Aufnahme, Tons (100+), Fehlwürfe/Fehlwurf-Quote, **bestes Leg (Min. Darts) je Spielmodus** (501/301/101 getrennt) und Sektor-Diagramm – auch pro Spieler und **je Pfeil filterbar**; im Sektor-Diagramm wird zudem der **Ø je Pfeil** gezeigt und der beste Pfeil **fett als Empfehlung** markiert; Bots inklusive
- **Analyse & Vergleiche:** eigener **Analyse**-Bereich (in der Verwaltung) mit **Bestenlisten** je Kennzahl (Ø, Erste-9, 180er, höchstes Checkout, Checkout-%, Siege, bestes Leg), **Head-to-Head** zweier Spieler (Siege/Legs/Ø aus der Match-Historie) und **Zeitraum-Vergleich** (zwei Zeiträume desselben Spielers nebeneinander). In der Spielerstatistik zusätzlich die **Checkout-Quote nach Rest-Bereichen** (2–40, 41–70, 71–100, 101–170) und **„unter Druck“** (Quote im Entscheidungs-Leg) sowie ein clientseitiger, dependency-freier **PDF-Spielerbericht** (Kennzahlen, Rest-Bereiche, Ø-Verlauf). First-9 ist als Timeline-Metrik enthalten.
- **Live-Sync:** mehrere Clients sehen Würfe sofort (Server-Sent Events); Bots laufen serverseitig. Der werfende Client rendert denselben Zustand nicht doppelt (Echo-**Dedupe** von HTTP-Antwort und SSE-Push), und alle API-/HTML-/JS-Antworten werden **gzip-komprimiert** (der SSE-Stream bewusst ausgenommen, damit er nicht puffert)
- **Cast / Anzeigetafel:** eigener Bereich, der ein laufendes Spiel groß und **eingabefrei** auf einem zweiten Bildschirm (z. B. TV) zeigt – große Restscores, aktiver Spieler hervorgehoben, Checkout-Vorschlag, Live-Sync, echter Browser-Vollbildmodus; **ab 3 Spielern** eine Infobox mit höchster Aufnahme der Runde (samt Spieler), höchster Aufnahme des Spiels und den meisten Fehlwürfen. **Bildschirm bleibt wach:** solange ein Spiel läuft, verhindert ein Wake-Lock das Abdunkeln/Sperren von TV/Tablet (native Screen-Wake-Lock-API, mit automatischem Video-Fallback für den HTTP-Betrieb im LAN); er aktiviert sich bei der ersten Nutzergeste und wird bei Spielende/Verlassen wieder freigegeben. Im normalen Spielmodus ist das bewusst nicht nötig, da dort ohnehin ständig getippt wird
- **Achievements:** über 80 Erfolge in den Kategorien Siege, Scoring, Checkout, Meilensteine, Training, Team und Kurios – u. a. Triple 20, Bullseye, Bull-Finish, 9-Darter, High Roller (drei 140+), zwei 180er in Folge, Bull-Bull- und Madhouse-Finish, Nervenstark (100+-Checkout zum Matchgewinn), Bed & Breakfast (26), Drei im Bett, Meilensteine (500/1.000 Spiele, 1.000 Legs, 10k/50k Darts), Tages- und Trainingsserien, Wochenend-Krieger und Geburtstagsspiel sowie die Team-Erfolge; werden je Spieler automatisch beim Spiel-/Trainingsende vergeben und auf einer eigenen Seite mit Spieler-Zuordnung angezeigt; die **in diesem Spiel neu erspielten** Erfolge erscheinen zudem im Endstand-Dialog je Spieler
- **Sound & Voice-Caller:** akustisches Feedback pro Gerät (Menü im Header) – Sound-Effekte für Leg/Match/Bust/180/Ausbullen und ein Voice-Caller in **Deutsch oder Englisch** und **weiblicher/männlicher Stimme** („One hundred and eighty!", „Game shot!"). Sprache/Stimme sind Geräte-Standard und **je Spieler in der Spielerverwaltung** überschreibbar. Zusätzlich lässt sich je Sprache eine **konkrete, auf dem Gerät installierte Stimme** direkt auswählen (hilfreich, wenn z. B. iOS für eine Sprache nur bestimmte Stimmen bereitstellt); „Automatisch" wählt weiterhin nach Geschlecht. Zwei Tonquellen: im Browser erzeugt (offline) oder eigene Audio-Clips unter `/sounds/…` mit Fallback
- **Coaching & KI (lokal, offline):** ein **KI-Coach** (eigener Verwaltungs-Punkt) erkennt aus der Statistik Schwächen und empfiehlt passende Trainingsmodi – mit „Fokus der Woche", Begründung, Ø-Trend und Direktstart der Übung. Ein **adaptiver Bot** („Adaptiv" im Setup, fair oder fordernd) passt seine Stärke automatisch an die Tagesform an (Gummiband). Ein optionaler **Live-Kommentar** kommentiert Highlights (180, große Aufnahmen/Checkouts, Bust, Sieg) per Voice-Caller und als Ticker auf der Anzeigetafel. Alles regelbasiert auf dem Pi – ohne externen KI-Dienst
- **Themes – zweistufig:** Farbwelt (Standard/Girlie) × Modus (Hell/Dunkel) = vier Kombinationen inkl. Girlie-Dark; Auswahl per Menü mit Farbpunkten, Präferenz wird gespeichert
- **Persistenz:** Spielstände in SQLite – überleben einen Neustart. Die Datenbank läuft im **WAL-Modus mit `synchronous = NORMAL`** – auf dem Pi/SD-Karte kein `fsync` pro Wurf, also deutlich schnellere Schreibvorgänge (Risiko bei Stromausfall max. die letzte Aufnahme, keine Korruption). Die Undo-Historie bleibt im Arbeitsspeicher, der Aufnahme-Verlauf ist auf 500 Einträge begrenzt (greift nur bei Marathon-/Unbegrenzt-Sessions), und die Liste offener Spiele liest schlanke Metadaten statt komplette Spielzustände
- **Performance-Rendering:** die Spielerkarten rendern nur bei tatsächlicher Datenänderung neu (React-Memo mit Inhaltsvergleich), sodass bei jedem Wurf nicht die ganze Ansicht neu aufgebaut wird; die Dartboard-Geometrie wird einmalig statt bei jedem Render berechnet. Statistik-/Historie-Queries nutzen einen Prepared-Statement-Cache. Das Frontend ist per **Route-Level Code-Splitting** aufgeteilt (jede Seite als eigener Chunk, React/MUI als separate Vendor-Bundles), sodass der initiale Download klein bleibt
- **Offline-First:** funktioniert komplett ohne Internet im LAN

---

## Architektur

```
Browser (Handy / Laptop)
        │  HTTP  (gleiche IP, Port 3000)
        ▼
┌───────────────────────────────┐
│  Express-Backend (Node.js)    │
│  • REST-API  /api/*           │
│  • liefert das gebaute        │
│    React-Frontend statisch    │
│  • Spiel-Logik (Regel-Engine) │
│  • SQLite (WAL, gzip-Antw.)   │
└───────────────────────────────┘
```

Ein Prozess, ein Port. Das React-Frontend wird zu statischen Dateien gebaut und vom selben Express-Server ausgeliefert – perfekt für den Raspberry Pi.

---

## 📦 Projekt auf den Pi übertragen

Es gibt mehrere Wege, den Projektordner auf den Pi zu bekommen. Anschließend folgt die [Installation](#-installation-auf-dem-raspberry-pi--schritt-für-schritt).

> **Voraussetzung für alle Netzwerk-Varianten:** SSH auf dem Pi aktivieren – entweder im `raspi-config` (`sudo raspi-config` → *Interface Options* → *SSH*), im Raspberry Pi Imager beim Flashen, oder durch eine leere Datei namens `ssh` in der Boot-Partition. Die IP des Pi findest du mit `hostname -I` (auf dem Pi) oder im Router.

### Variante 1 – `git clone` (wenn das Projekt in einem Git-Repo liegt)

```bash
git clone <REPO-URL> /home/pi/dartzaehler
```

### Variante 2 – SCP (Kopie über das Netzwerk, ohne Git)

Direkt vom PC/Mac in das Home-Verzeichnis des Pi kopieren. Vom **eigenen Rechner** aus ausführen (nicht auf dem Pi):

```bash
# Windows (PowerShell), macOS und Linux haben scp an Bord.
# Aus dem übergeordneten Ordner des Projekts ausführen:
scp -r ./Dartzaehler pi@<PI-IP>:/home/pi/dartzaehler
```

Tipp: Vorher unnötige lokale Ordner ausschließen (v. a. `node_modules`, `frontend/dist`), damit die Übertragung klein bleibt – die werden auf dem Pi ohnehin neu erzeugt.

### Variante 3 – rsync (empfohlen, ideal auch für Updates)

`rsync` überträgt nur geänderte Dateien und kann Ballast ausschließen – perfekt, um später Updates einzuspielen. Vom eigenen Rechner (macOS/Linux, oder Windows via WSL/Git-Bash):

```bash
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'backend/data' \
  --exclude '.git' \
  ./Dartzaehler/ pi@<PI-IP>:/home/pi/dartzaehler/
```

Für ein Update später einfach denselben Befehl erneut ausführen und den Dienst neu starten (`sudo systemctl restart dartzaehler`).

### Variante 4 – VS Code Remote-SSH (bequem per Editor)

Erweiterung **Remote - SSH** installieren, mit `pi@<PI-IP>` verbinden, den Projektordner öffnen bzw. per Drag-and-drop hineinziehen. Danach lässt sich das Setup direkt im integrierten Terminal des Pi ausführen.

### Variante 5 – SMB / Netzwerkfreigabe

Falls auf dem Pi eine Samba-Freigabe eingerichtet ist (z. B. `\\raspberrypi\pi`), den Projektordner einfach per Datei-Explorer (Windows) bzw. Finder (macOS, „Mit Server verbinden" → `smb://<PI-IP>`) dorthin kopieren.

### Variante 6 – USB-Stick

Ohne Netzwerk: Projekt auf einen USB-Stick kopieren, am Pi einstecken, mounten und ins Home-Verzeichnis kopieren:

```bash
lsblk                                   # Gerätenamen finden, z. B. /dev/sda1
sudo mkdir -p /mnt/usb && sudo mount /dev/sda1 /mnt/usb
cp -r /mnt/usb/Dartzaehler /home/pi/dartzaehler
sudo umount /mnt/usb
```

> **Wichtig:** Egal welche Variante – nach dem Kopieren müssen die Abhängigkeiten **auf dem Pi** installiert und das Frontend **auf dem Pi** gebaut werden (siehe Installation). Ein auf dem PC erzeugtes `node_modules` funktioniert wegen des nativen SQLite-Moduls nicht auf dem Pi und sollte gar nicht erst mitkopiert werden.

---

## 🔄 Update auf dem Pi einspielen

Ein neuer Stand liegt schon per SCP auf dem Pi? So spielst du eine aktualisierte Version ein.
Die **Datenbank bleibt erhalten**: Sie liegt auf dem Pi unter `backend/data/` und wird beim Update
nicht angefasst (`setup.sh` entfernt nur `node_modules` und `frontend/dist`, nicht die Daten).

> **Nie das lokale `node_modules` mitkopieren!** Das native SQLite-Modul ist auf dem Pi (Linux/ARM)
> anders gebaut als auf dem PC. Die folgenden Rezepte schließen `node_modules`, `frontend/dist` und
> `backend/data` bewusst aus.

### Schritt 1 – neuen Stand auf den Pi kopieren

**Variante A – SCP (wie beim ersten Deploy).** Vom eigenen Rechner aus nur die Quellen kopieren
(Zielordner `backend/` bzw. `frontend/` existieren bereits, die Dateien werden überschrieben):

```bash
# Backend-Quellcode (ohne node_modules / data):
scp -r backend/routes backend/models backend/utils backend/db backend/server.js backend/package.json \
    pi@<PI-IP>:/home/pi/dartzaehler/backend/

# Frontend-Quellcode (ohne node_modules / dist):
scp -r frontend/src frontend/index.html frontend/package.json frontend/vite.config.js \
    pi@<PI-IP>:/home/pi/dartzaehler/frontend/

# Setup-Script + Doku:
scp -r raspberry-pi README.md Projekt.md pi@<PI-IP>:/home/pi/dartzaehler/
```

**Variante B – rsync (empfohlen, ein Befehl).** Überträgt nur geänderte Dateien und lässt Ballast weg:

```bash
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'backend/data' \
  --exclude '.git' \
  ./Dartzaehler/ pi@<PI-IP>:/home/pi/dartzaehler/
```

### Schritt 2 – auf dem Pi neu bauen & Dienst neu starten

Per SSH auf den Pi und das Setup-Script erneut ausführen. Es installiert die Abhängigkeiten
plattformkorrekt neu, **baut das Frontend neu** und **startet den Dienst** – die Datenbank bleibt bestehen:

```bash
ssh pi@<PI-IP>
cd /home/pi/dartzaehler
sudo bash raspberry-pi/setup.sh
```

**Schnell-Variante** (nur wenn sich **keine** npm-Abhängigkeiten geändert haben): Frontend neu bauen
und Dienst neu starten – ohne kompletten Neu-Install:

```bash
npm --prefix /home/pi/dartzaehler/frontend run build
sudo systemctl restart dartzaehler
```

### Schritt 3 – prüfen

```bash
sudo systemctl status dartzaehler      # sollte "active (running)" zeigen
journalctl -u dartzaehler -f           # Live-Logs
```

Im Browser die Seite neu laden (bei hartnäckigem Cache **Strg + F5**). Danach ist der neue Stand aktiv.

---

## 🍓 Installation auf dem Raspberry Pi – Schritt für Schritt

> **Empfohlen:** Raspberry Pi 3/4/5 mit Raspberry Pi OS (Lite genügt) und Node.js 20 LTS.

### Variante A – Automatisch (empfohlen)

Ein einziges Script erledigt alles (Node.js, Abhängigkeiten, Build, Autostart-Dienst):

```bash
# 1) Projekt auf den Pi bringen – siehe Abschnitt "Projekt auf den Pi übertragen"
#    (git clone, SCP, rsync, VS Code Remote-SSH, SMB oder USB)
cd /home/pi/dartzaehler

# 2) Setup-Script ausführen
sudo bash raspberry-pi/setup.sh
```

Am Ende zeigt das Script die Adresse an, z. B. `http://192.168.1.50:3000`.
Fertig – von jedem Gerät im WLAN aufrufbar.

---

### Variante B – Manuell (Schritt für Schritt)

**Schritt 1: System aktualisieren**

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

**Schritt 2: Node.js 20 LTS installieren**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v      # sollte v20.x anzeigen
```

**Schritt 3: Build-Werkzeuge installieren** (für das native SQLite-Modul)

```bash
sudo apt-get install -y build-essential python3 git
```

**Schritt 4: Projekt auf den Pi bringen**

Wähle eine Variante aus dem Abschnitt [Projekt auf den Pi übertragen](#-projekt-auf-den-pi-übertragen) – z. B. `git clone`, SCP oder rsync. Danach in den Projektordner wechseln:

```bash
cd /home/pi/dartzaehler
```

**Schritt 5: Backend-Abhängigkeiten installieren**

```bash
npm --prefix backend install --omit=dev
```

**Schritt 6: Frontend installieren & bauen**

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

Das erzeugt `frontend/dist/`, das vom Backend ausgeliefert wird.

**Schritt 7: Konfiguration anlegen** (optional – Standardwerte reichen meist)

```bash
cp backend/.env.example backend/.env
# bei Bedarf PORT/HOST/DB_PATH in backend/.env anpassen
```

**Schritt 8: Testlauf**

```bash
npm start        # startet das Backend (Port 3000)
```

Im Browser `http://<PI-IP>:3000` öffnen. Die IP findest du mit `hostname -I`.
Läuft alles? Dann mit `Strg+C` stoppen und den Autostart einrichten:

**Schritt 9: Als Dienst einrichten (Autostart beim Booten)**

```bash
# Pfad/Benutzer in der Service-Datei ggf. anpassen (Standard: /home/pi/dartzaehler, User pi)
sudo cp raspberry-pi/dartzaehler.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dartzaehler
sudo systemctl start dartzaehler
```

**Schritt 10: Status & Logs prüfen**

```bash
sudo systemctl status dartzaehler
journalctl -u dartzaehler -f
```

Der DartZähler startet nun automatisch bei jedem Booten des Pi. 🎉

---

## Nutzung

1. `http://<PI-IP>:3000` auf allen Geräten im WLAN öffnen.
2. **Neues Einzelspiel** oder **Neues Turnier** wählen.
3. Spieler und/oder Bots hinzufügen, pro Spieler den Checkout-Modus setzen.
4. Punkte, Check-In und Match-Format einstellen → **START**.
5. Auf dem Handy per Numpad die Würfe eingeben; ein Laptop kann parallel als Anzeigetafel dienen (dieselbe Spiel-URL).

**Numpad-Bedienung:** Zahl antippen = ein Dart. Für Double/Triple zuerst **DOUBLE** bzw. **TRIPLE** antippen, dann die Zahl (gilt für genau einen Dart). **0** = Fehlwurf. **↶** = letzten Dart rückgängig machen.

---

## Entwicklung (lokal auf dem PC)

```bash
# Abhängigkeiten
npm run install:all

# Backend (Port 3000) + Frontend-Dev-Server (Port 5173) in zwei Terminals:
npm run dev:backend
npm run dev:frontend      # http://localhost:5173  (proxyt /api ans Backend)

# Produktions-Build testen (Frontend bauen, dann Backend liefert es aus):
npm run build
npm start                 # http://localhost:3000
```

### Tests

```bash
npm test                  # Regel-Engine & Game-Logik (node:test)
```

### Mit IntelliJ IDEA / WebStorm

Das Projekt enthält fertige Run-Konfigurationen im Ordner `.run/` – nach dem Öffnen des Projekts erscheinen sie oben rechts in der Auswahlliste.

**Voraussetzung:** Node.js muss installiert sein. In IntelliJ IDEA **Community** zusätzlich das kostenlose Plugin **Node.js** installieren (*Settings → Plugins*); in **WebStorm** und IntelliJ **Ultimate** ist es bereits enthalten. Unter *Settings → Languages & Frameworks → Node.js* sollte ein Node-Interpreter eingetragen sein (wird meist automatisch erkannt).

Schritt für Schritt:

1. Ordner `Dartzaehler` in IntelliJ öffnen (*File → Open*).
2. Konfiguration **„1 Install all"** ausführen (installiert Backend- und Frontend-Abhängigkeiten). Alternativ im Terminal `npm run install:all`.
3. Zum Entwickeln **„Dev (Backend + Frontend)"** starten – das startet beide Prozesse gleichzeitig:
   - Backend (API) auf `http://localhost:3000`
   - Frontend-Dev-Server (Vite, mit Hot-Reload) auf `http://localhost:5173` – dort im Browser öffnen; `/api`-Aufrufe werden automatisch ans Backend geproxyt.
4. Zum Testen des Produktions-Setups: **„4 Build frontend"**, danach **„5 Start (prod)"** – dann liefert das Backend das gebaute Frontend selbst aus (`http://localhost:3000`, wie später auf dem Pi).

Enthaltene Konfigurationen: `1 Install all`, `2 Backend (dev)`, `3 Frontend (dev)`, `4 Build frontend`, `5 Start (prod)`, `6 Tests` sowie die Compound-Konfiguration `Dev (Backend + Frontend)`.

**Debugging:** Rechtsklick auf „2 Backend (dev)" → *Debug* setzt Breakpoints im Backend-Code. Fürs Frontend eignet sich der Browser-DevTools-Debugger oder eine JavaScript-Debug-Konfiguration auf `http://localhost:5173`.

**Ohne Node.js-Plugin (IDEA Community):** Einfach das integrierte Terminal nutzen – `npm run install:all`, dann `npm run dev:backend` und in einem zweiten Terminal-Tab `npm run dev:frontend`.

---

## Wartung

| Aufgabe | Befehl |
|---|---|
| Dienst neu starten | `sudo systemctl restart dartzaehler` |
| Dienst stoppen | `sudo systemctl stop dartzaehler` |
| Logs live ansehen | `journalctl -u dartzaehler -f` |
| Update einspielen | `git pull` **oder** neue Dateien per rsync/SCP kopieren, dann `sudo bash raspberry-pi/setup.sh` (installiert neue Abhängigkeiten wie `compression` und `nosleep.js` und baut das Frontend neu) |
| Datenbank zurücksetzen | `rm backend/data/dartzaehler.db*` und Dienst neu starten |

---

## Projektstruktur

```
dartzaehler/
├── backend/          Express-API + SQLite + Regel-Engine
│   ├── server.js
│   ├── routes/       players, games, tournaments
│   ├── models/       SQLite-Datenzugriff (Stores)
│   ├── utils/        dartRules, gameEngine, botAI, tournamentLogic, coach
│   ├── db/           schema.sql + init.js
│   └── tests/        rules.test.js, engine.test.js
├── frontend/         React + MUI (Vite)
│   ├── src/pages/    Home, Verwaltung, Coach, Setup, Game, Tournament, Stats, History, Achievements, Cast
│   ├── src/components/ Numpad, BoardInput, PlayerCard, Header, SoundMenu, PlayerSetupList, ...
│   ├── src/           i18n.js, sound.js, commentary.js, tournamentExport.js (PNG/PDF-Export)
│   └── src/hooks/    useGame, useMatchSound
├── raspberry-pi/     setup.sh + systemd-Service
└── docs/             API.md, SETUP.md, DESIGN.md
```

---

## Ausblick

Der bisher umgesetzte Funktionsumfang ist vollständig oben unter **Funktionsumfang** dokumentiert (inkl.
Coaching & KI in der lokalen, regelbasierten Ausbaustufe). Diese Roadmap listet daher nur noch **offene**
Ausbaustufen. Sie orientiert sich an den Funktionen führender Dart-Systeme (u. a. Autodarts, Scolia,
Dartsmind, Dartist, MyDarts, DartConnect) und ist **von klein nach groß** gestaffelt (Stufe 1 = geringster
Aufwand). Details und der technische Stand stehen in [Projekt.md](Projekt.md).

### Stufe 1 – Komfort, Betrieb & Anzeige (klein)

- **PWA-/Offline-Installation:** Die App als installierbare Progressive Web App bereitstellen (eigenes
  App-Icon, Vollbild ohne Browserleiste, Start auch offline) – ideal für ein fest am Board montiertes
  Tablet.
- **Backup & Wiederherstellung:** Export/Import der gesamten SQLite-Datenbank (Spieler, Statistik,
  Historie, Achievements) als Datei, damit ein Umzug auf einen neuen Pi oder eine Sicherung mit einem
  Klick möglich ist.
- **Sound-Pakete & weitere Stimmen:** Zusätzliche Caller-Profile und Effekt-Sets, inklusive der
  Möglichkeit, personalisierte Ansagen (z. B. den Spielernamen) einzusprechen.

### Stufe 2 – Barrierefreiheit (klein)

- **Barrierefreiheit (WCAG AA):** Kontraste, Fokus-Reihenfolge, Screenreader-Beschriftungen und
  Tastaturbedienung durchgängig sicherstellen.

### Stufe 3 – Statistik & Analyse (mittel)

Vertiefte Kennzahlen & Vergleiche (Bestenlisten, Head-to-Head, Zeitraum-Vergleich, Checkout nach Rest-
Bereichen inkl. „unter Druck“) und der PDF-Bericht sind umgesetzt (siehe *Funktionsumfang*).

- **Trefferbild / Heatmap (umgesetzt):** Eine dartboardförmige Heatmap der Treffer zeigt Stärken und
  Schwächen je Segment auf einen Blick (wie bei Scolia/Dartist) – ergänzend zum Sektor-Diagramm. Enthalten
  in der Spieler- und Trainingsstatistik (Schwächen-Heatmap) sowie im PDF-Bericht.

### Stufe 4 – Weitere Spielmodi (mittel)

Bisher liegt der Fokus auf X01 (501/301/101), Solo-Cricket und den Trainingsspielen. Denkbar als
vollwertige, mehrspielerfähige Wettkampfmodi (Vorbilder u. a. DartConnect, King of Darts, My Dart Training):

- **Killer:** Ausscheidungs-/Partymodus – erst das eigene Feld „scharfschalten", dann den Gegnern Leben
  abnehmen.
- **Baseball & Golf:** 9 Innings auf die Felder 1–9 bzw. 18 „Löcher" mit möglichst wenigen Darts.
- **Gotcha:** eine Zielpunktzahl exakt treffen (Überwerfen bestraft) – reizvolle Alternative zu X01.
- **Shanghai / Around the Clock / Halve-it als Wettkampf (umgesetzt):** die Trainingsformen als
  Mehrspieler-Match mit Wertung, Live-Cast und Achievements – im Party-Bereich spielbar.

### Stufe 5 – Turnier-Ausbau (mittel)

- **Doppel-/Team-Turniere (umgesetzt):** Im „Neues Turnier" per Einzel/Doppel-Schalter; Teams sind eine Einheit im Gruppen- und KO-Baum, Tabellen/Setzung/Ergebnis-Sync funktionieren für Teams wie für Einzelspieler.
- **Mehr Formate (offen):** Mehr als zwei Gruppen, Handicaps und Double-Elimination.
- **Organisation:** Spielplan/Scheduling mit Board-Zuweisung sowie Druck-/Export der Turnierbäume und
  Ergebnislisten.

### Stufe 6 – Auto-Scoring per Kamera (groß)

- **Automatische Wurferkennung:** Kamerabasiertes Scoring lokal auf dem Gerät (Vorbilder: Autodarts,
  Scolia, Dartsmind) – die App erkennt Feld und Multiplikator selbst, sodass kein manuelles Eintippen
  mehr nötig ist.
- **Dual-Kamera & Koordinaten:** Zwei Kameraperspektiven für höhere Trefferwahrscheinlichkeit und
  koordinatengenaue Positionsdaten, die direkt die Heatmap aus Stufe 3 speisen.

### Stufe 7 – Online & Community (groß)

- **Online-Multiplayer & Zuschauer-Link:** Fernduelle gegen andere sowie ein Live-Zuschauer-Link zum
  Mitverfolgen laufender Spiele/Turniere über das Cast-Format.
- **Konten & Cloud-Sync:** Optionale Benutzerkonten mit geräteübergreifender Synchronisation von
  Statistik, Historie und Achievements.
- **Ligen, Ranglisten & Elo (umgesetzt, lokal):** Elo-Rating aus der Match-Historie (pro Match inkl.
  Ergebnis-Höhe/Margin, feste Bot-Ratings je Level) mit eigener Rangliste, Saisons/Ligen inklusive
  berechneter Tabelle (Punkte/Legs/Elo), Elo-Setzung im Turnier sowie zusätzliche Elo-Achievements.
  Offen bleiben Online-Multiplayer, Zuschauer-Link und Cloud-Sync.

### Stufe 8 – Coaching & KI: generativ (groß)

Der lokale, regelbasierte Ausbau (KI-Coach, adaptiver Bot, Live-Kommentar) ist umgesetzt und unter
*Funktionsumfang* dokumentiert. Offen bleibt:

- **Generativer KI-Coach/-Kommentar (LLM):** natürlichsprachige Schwächen-Analysen und Live-Kommentare.
  Würde einen Online-Dienst erfordern und ist daher bewusst nicht Teil der Offline-Variante.

---

## Weiterführende Doku

- [docs/SETUP.md](docs/SETUP.md) – Deployment-Details & Troubleshooting
- [docs/API.md](docs/API.md) – REST-API-Referenz
- [docs/DESIGN.md](docs/DESIGN.md) – Design-System

---

## Lizenz

Veröffentlicht unter der [MIT-Lizenz](LICENSE). Nutzung, Änderung und Weitergabe sind erlaubt – über einen Stern ⭐ freue ich mich.

## Unterstützung ☕

DartZähler ist ein privates Open-Source-Projekt. Wenn es dir gefällt und du die Weiterentwicklung unterstützen möchtest, kannst du dem Entwickler einen Kaffee spendieren:

[![Buy Me a Coffee](https://img.shields.io/badge/PayPal-Kaffee%20spendieren-00457C.svg?logo=paypal&logoColor=white)](https://paypal.me/SKunz1)

Ganz ohne Verpflichtung – Feedback und Pull Requests sind mindestens genauso willkommen.
