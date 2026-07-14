# DartZähler für Raspberry Pi

## Projektbeschreibung

Ein moderner, responsiver Darts-Zähler (Scorer) zum Hosten auf einem Raspberry Pi im lokalen Netzwerk. Die Anwendung bietet eine optimierte mobile Ansicht für Handys (Spieleingabe) und eine Desktop-Ansicht für Laptops/Monitore (Anzeigetafel).

**Inspiriert von:** https://www.dartzaehler.de/

---

## Features

### Core-Funktionalität
- **Spielverwaltung**: Single-Game oder Turnier-Modus
- **Punkte-Tracking**: Live Punkte-Eingabe und Anzeige
- **Spieler-Management**: Unbegrenzt viele Spieler pro Spiel/Turnier
- **Score-Verlauf**: Alle Würfe tracken und anzeigen
- **Undo-Funktion**: Letzte Würfe rückgängig machen
- **Runden-Anzeige**: Zeigt aktuelle Runde und Wurfanzahl pro Spieler

### Dart-Spielmodi
- **501**: Start mit 501 Punkten, exakt auf 0 finishen
- **301**: Start mit 301 Punkten, exakt auf 0 finishen
- **101**: Start mit 101 Punkten, exakt auf 0 finishen

### Check-In-Optionen
- **Straight In**: Start sofort mit Eingabe
- **Double In**: Muss mit Double starten

### Checkout-Optionen (Pro-Spieler konfigurierbar)
- **Master Out:** Leg endet auf einem Doppel **oder** Triple (Bull zählt als Doppel); Checkout-Wege nach der darts1.de-Master-Tabelle. Pro Spieler wählbar wie Double/Single Out.
- **Double Out** (Standard): Muss mit Double finishen
- **Single Out**: Kann mit beliebiger Zahl finishen
- **Konfigurierbar beim Setup**: Beim Erstellen der Paarung wählbar
  - Ideal für Mixed-Level-Spiele (Anfänger vs. Erfahrene)
  - Erhöht Spielspaß durch faire Regelwerk-Anpassung

### Dart-Regeln
- **Checkout-Vorschläge**: Double Out nach offizieller dartcoach-Tabelle; Single Out bevorzugt das einfachste Feld (z. B. 10 statt D5)
- **Busting-Handling**: Automatische Erkennung wenn Punkte überschritten
- **Fehlwurf-Tracking**: Option für 0-Punkte Würfe

### Turnier-Modus
- **Turnier-Setup**: Mehrere Spieler auswählen
  - Spieler hinzufügen (Person oder Bot Easy/Medium/Hard)
  - Pro Spieler: Checkout-Mode wählbar (Double Out oder Single Out)
  - Ideal für Mixed-Level Turniere
- **Automatische Paarungen**: Zufällige Zuordnung (Jeder gegen Jeden)
- **Turnier-Tabelle**: Live Standings mit Punkte/Gewinn-Bilanz
- **Bracket-Verwaltung**: Übersicht aller Matches und Ergebnisse
- **Match-Konfiguration**: Vor jedem Match Regelwerk anzeigen/anpassen

### Dart-Bots (Computergegner)
- **3 Bot-Profile**: Unterschiedliche Spielweisen
  - **Easy Bot**: Anfänger-Level, niedrige Checkouts, höhere Miss-Rate
  - **Medium Bot**: Fortgeschrittene, gute Konsistenz, realistische Fehler
  - **Hard Bot**: Profi-Level, hohe Consistency, beste Checkout-Raten
- **Intelligente Throwing**: Zufällige aber realistisch Würfe
- **Spieler-Ersatz**: Bots können als reguläre Spieler in Spielen verwendet werden

### UI/UX
- **Mobile-First Design**: Optimiert für Handys (Spielereingabe, Numpad mit 0 für Fehlwurf)
- **Desktop Variante**: Anzeigetafel auf großen Bildschirmen
- **MUI Theme**: Material Design mit konsistenter Styling
- **Zwei Color-Modes**: Hell und Dunkel (theme-switcher in UI)
- **Responsive**: Nahtlos zwischen Viewport-Größen
- **Schnelle Eingabe**: Numpad (0-20) für schnelle Punkt-Eingaben
- **Runden-Info**: Zeigt aktuelle Runde und Wurfanzahl
- **Aktiver Spieler Hervorhebung**: Grüner Balken + visuelle Betonung zeigt wer dran ist

### Technische Features
- **Offline-First**: Funktioniert ohne Internet
- **Responsive Web App**: PWA-tauglich (optional Phase 2)
- **Responsive Layout**: Mobile, Tablet, Desktop
- **Session-Persistence**: Spielstände bleiben erhalten bei Neustart

---

## Tech Stack

### Backend
- **Runtime**: Node.js + Express (oder Pure Node.js für Minimal-Setup)
- **Datenbank**: SQLite (einfach, lokal, keine Dependencies)
- **API**: REST (oder WebSocket für Live-Updates)
- **Hosting**: Raspberry Pi (systemd Service)

### Frontend
- **Framework**: React (für komplexe State-Management, besonders Turnier-Logik)
- **UI Library**: Material-UI (MUI) v5 - professionell, responsive, accessible
- **Styling**: MUI Theme System + Emotion (CSS-in-JS)
- **Mobile**: Responsive Design, Touch-optimiert
- **Icons**: MUI Icons (Material Design Icons)
- **State Management**: React Hooks (useState, useReducer für Game-State)

### Deployment
- **Raspberry Pi**: OS Lite oder Full (Node.js vorinstalliert)
- **Autostart**: systemd Service
- **Netzwerk**: Lokale IP-Adresse im Netzwerk
- **Optional**: Reverse-Proxy (nginx) vor Node.js

---

## Projektstruktur

```
dartzaehler/
├── backend/
│   ├── server.js                 # Express App
│   ├── routes/
│   │   ├── games.js             # GET/POST/PUT Games (Single Match)
│   │   ├── tournaments.js       # GET/POST Tournaments, Create, Get Standings
│   │   ├── matches.js           # GET/PUT Matches (Turnier Paarungen)
│   │   ├── players.js           # GET/POST Players (Create, List)
│   │   └── scores.js            # POST Score/Wurf, GET History
│   ├── models/
│   │   ├── Game.js              # Single Game (501/301/101)
│   │   ├── Tournament.js         # Tournament Management
│   │   ├── Match.js             # Einzelnes Match im Turnier
│   │   ├── Player.js            # Spieler-Daten + checkoutMode (Double/Single)
│   │   ├── Bot.js               # Bot Profile (Easy/Medium/Hard)
│   │   └── Score.js             # Wurf/Score Records
│   ├── db/
│   │   ├── init.js              # SQLite Setup
│   │   └── schema.sql
│   ├── utils/
│   │   ├── dartRules.js         # 501er Logik, Checkout, Busting
│   │   └── validators.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── index.js             # React Entry Point
│   │   ├── App.jsx              # Main App Router + Theme Provider
│   │   ├── theme.js             # MUI Theme (Hell/Dunkel)
│   │   ├── pages/
│   │   │   ├── GamePage.jsx     # Single Game View (Mobile + Desktop)
│   │   │   ├── TournamentPage.jsx # Tournament Setup & Standings
│   │   │   └── SetupPage.jsx    # Spieler-Setup, Checkout-Optionen
│   │   ├── components/
│   │   │   ├── Header.jsx           # MUI AppBar mit Zurück-Button
│   │   │   ├── PlayerList.jsx       # Spieler-Liste mit aktiv-Hervorhebung
│   │   │   ├── Numpad.jsx           # Dart-Numpad (D/T Prefix, Triple-Limits)
│   │   │   ├── PlayerCard.jsx       # Single Player Info Card
│   │   │   ├── TournamentTable.jsx  # Standings Tabelle + Info-Hinweis
│   │   │   ├── NextMatches.jsx      # Nächste Paarungen (statt Timer)
│   │   │   └── ThemeToggle.jsx      # Hell/Dunkel Switch
│   │   ├── hooks/
│   │   │   ├── useGame.js       # Game State Hook
│   │   │   ├── useTournament.js # Tournament State Hook
│   │   │   └── useApi.js        # API Call Hook
│   │   ├── utils/
│   │   │   ├── dartRules.js     # 501/301/101 Logik
│   │   │   ├── botAI.js         # Dart-Bot Algorithms (Easy/Medium/Hard)
│   │   │   ├── tournamentLogic.js # Pairings, Standings Calculation
│   │   │   └── api.js           # API Client
│   │   ├── styles/
│   │   │   └── global.css       # Global MUI Overrides
│   │   └── public/
│   │       ├── index.html       # HTML Wrapper
│   │       └── manifest.json    # PWA Manifest
├── raspberry-pi/
│   ├── setup.sh                 # Installation Script
│   ├── dartzaehler.service      # systemd Service
│   └── README.md                # RPI Setup Guide
├── docs/
│   ├── API.md                   # API Documentation
│   ├── DESIGN.md                # Design System
│   └── SETUP.md                 # Deployment Guide
├── tests/
│   ├── rules.test.js            # Dart-Logik Tests
│   └── api.test.js
├── .gitignore
├── README.md
└── package.json
```

---

## Design-Anforderungen

### Farbschema - DUNKEL Theme (Default, inspiriert von dartzaehler.de)
- **Hintergrund**: Dunkelblau/Schwarz (#020617 oder #0F1117)
- **Primär**: Hellblau oder Grün (Accent)
- **Sekundär**: Grau (Inactive, Secondary)
- **Warnings**: Rot (Busting, Errors)
- **Success**: Grün (Checkout erreicht)

### Farbschema - HELL Theme
- **Hintergrund**: Weiß (#FFFFFF) oder Light Gray (#F5F5F5)
- **Primär**: Dunkelblau (Accent)
- **Sekundär**: Mittleres Grau (Inactive, Secondary)
- **Warnings**: Rot (Busting, Errors)
- **Success**: Grün (Checkout erreicht)

### Theme-Switcher
- Toggle in UI für Hell/Dunkel Umschaltung
- Präferenz in localStorage speichern
- CSS Custom Properties für flexible Themisierung

### Typography
- **Schrift**: System-Font oder Open Sans / Roboto
- **Große Zahlen**: Monospace (z.B. JetBrains Mono) für Scores

### Layout

#### Mobile Layout (320px - 767px) – Detailliertes Design

**Header (MUI AppBar - Dunkel)**
```
┌────────────────────────────────────────┐
│ [<]              501, Double Out (D/S) │  Minimalistischer Header
│                                        │  Nur Zurück-Button, Spiel-Info
└────────────────────────────────────────┘
```
*Erklärung: (D/S) = Double Out / Single Out pro Spieler angezeigt*

**Spieler-Liste (Scrollbar, Aktiver Spieler hervorgehoben)**
```
┌────────────────────────────────────────┐
│ Spieler-Liste:                         │
├────────────────────────────────────────┤
│ ◆ steffen (Double Out)      501 Punkte│  ← Aktiver Spieler
│   501 ▢▢▢  0 Sätze | Ø 0.00          │     Grüner Balken links
│                                        │     Hervorhobenes Styling
├────────────────────────────────────────┤
│   DartBot 2 (Single Out)    501 Punkte│  ← Nächster
│   501 ▢▢▢  0 Sätze | Ø 0.00          │
├────────────────────────────────────────┤
│   Alex (Double Out)         501 Punkte│  ← Reihe 3
│   501 ▢▢▢  0 Sätze | Ø 0.00          │
└────────────────────────────────────────┘

Legend:
◆ = Grüner Indicator (Aktiv)
(Double Out / Single Out) = Pro-Spieler Checkout-Mode
▢ = Letzte 3 Würfe (graue Boxen)
0 = Aktueller Wurf (große Zahl)
```

**Numpad Grid (7 Spalten) – Dynamischer Multiplikator**
```
Standard (Single/Keine Multiplikation):
┌────────────────────────────────────────┐
│  1  │  2  │  3  │  4  │  5  │  6  │  7 │
├─────┼─────┼─────┼─────┼─────┼─────┼────┤
│  8  │  9  │ 10  │ 11  │ 12  │ 13  │ 14 │
├─────┼─────┼─────┼─────┼─────┼─────┼────┤
│ 15  │ 16  │ 17  │ 18  │ 19  │ 20  │ 25 │
├─────┼─────────────────┼──────────┼────┤
│  0  │   DOUBLE (gelb) │ TRIPLE   │ ↶  │
└─────┴─────────────────┴──────────┴────┘

Bei DOUBLE (gelb) aktiv:
┌────────────────────────────────────────┐
│ D1 │ D2 │ D3 │ D4 │ D5 │ D6 │ D7 │
├────┼────┼────┼────┼────┼────┼────┤
│ D8 │ D9 │ D10│ D11│ D12│ D13│ D14│
├────┼────┼────┼────┼────┼────┼────┤
│D15 │D16 │D17 │D18 │D19 │D20 │ D25│
├────┼─────────────────┼──────────┼────┤
│ — │  DOUBLE (aktiv) │ TRIPLE   │ ↶  │  ← 0 deaktiviert
│(de)│                │          │(rot)│
└────┴─────────────────┴──────────┴────┘

Bei TRIPLE (orange) aktiv:
┌────────────────────────────────────────┐
│ T1 │ T2 │ T3 │ T4 │ T5 │ T6 │ T7 │
├────┼────┼────┼────┼────┼────┼────┤
│ T8 │ T9 │T10 │T11 │T12 │T13 │T14 │
├────┼────┼────┼────┼────┼────┼────┤
│T15 │T16 │T17 │T18 │T19 │T20 │ — │  ← 25 deaktiviert
├────┼─────────────────┼──────────┼────┤
│ — │   DOUBLE        │ TRIPLE   │ ↶  │  ← 0 deaktiviert
│(de)│                │ (aktiv)  │(rot)│
└────┴─────────────────┴──────────┴────┘

Funktionalität:
- [Zahl] = Eingeben (mit aktuellem Multiplikator)
- [0] = Fehlwurf (Miss) – nur bei Single aktiv
- [25] = Bullseye – nur bei Single aktiv
- [DOUBLE] = D Multiplikator umschalten (gelb)
- [TRIPLE] = T Multiplikator umschalten (orange)
- [↶] = Undo/Zurück (rot)

**Deaktivierte Buttons:**
- Bei DOUBLE: [0] deaktiviert (Double-0 existiert nicht!)
- Bei DOUBLE: [25] aktiv (D25 = Bullseye)
- Bei TRIPLE: [0] deaktiviert (Triple-0 existiert nicht!)
- Bei TRIPLE: [25] deaktiviert (Triple-25 existiert nicht!)
```

**Color-Coding:**
- Numpad Zahlen: Weiß auf grau
- DOUBLE: Weiß auf Gelb/Orange (#FFA500)
- TRIPLE: Weiß auf Orange (#FF6B35)
- UNDO: Weiß auf Rot (#E63946)
- Grüner Header: #52B788 (oder ähnlich)
- Cards: Weiß mit grünem linkem Balken (#52B788)

**Responsive Behavior:**
- Zahlen-Buttons: Finger-freundlich (~50px minimum)
- Header-Icons: Rechts oben User + Mute toggle
- Spieler-Cards: Scrollbar wenn mehr als 2 Spieler
- Numpad: Immer am unteren Rand sichtbar
- Letzte 3 Würfe: Graue Boxen als visueller Verlauf

#### Desktop Single Game (Laptops/Monitore - 1024px+)
```
┌──────────────────────────────────────────┐
│          DartZähler - Spiel #1 (Runde 4) │
├──────────────────────────────────────────┤
│                                          │
│    Spieler 1    │    Spieler 2    │ ... │
│    Score: 156   │    Score: 203   │     │
│    Letzter: D20 │    Letzter: 45  │     │
│                                          │
├──────────────────────────────────────────┤
│  Verlauf / Statistiken                   │
│  Throw: 45 | Running: 156                │
└──────────────────────────────────────────┘
```

#### Desktop Turnier-Modus (Laptops/Monitore - 1024px+)
```
┌────────────────────────────────────────────────────┐
│      DartZähler - Turnier (8 Spieler)              │
│      ℹ️ Namen sind Beispiele, frei konfigurierbar  │
├────────────────────────────────────────────────────┤
│ Aktuelle Paarung: Alex vs. Bob (Runde 3)           │
│ [Score] Alex: 220 | Bob: 280                       │
├────────────────────────────────────────────────────┤
│                                                    │
│ TURNIER-TABELLE:                                   │
│ ┌──────────────┬────┬────┬──────┬──────┐          │
│ │ Spieler      │ W-L│ Pts│ Ø    │ +/-  │          │
│ ├──────────────┼────┼────┼──────┼──────┤          │
│ │ 1. Alex      │ 4-1│ 4  │ 98   │ +180 │          │
│ │ 2. Charlie   │ 3-2│ 3  │ 95   │ +120 │          │
│ │ 3. Bob       │ 3-2│ 3  │ 92   │ -60  │          │
│ │ 4. Diana     │ 2-3│ 2  │ 88   │ -100 │          │
│ └──────────────┴────┴────┴──────┴──────┘          │
│                                                    │
│ Nächste Paarungen:                                 │
│   • Charlie (Easy Bot) vs. Diana                   │
│   • steffen vs. Easy Bot                           │
└────────────────────────────────────────────────────┘
```

**Turnier-Tabelle zeigt:**
- Spieler-Rang
- Wins-Losses (Siege-Niederlagen)
- Punkte (Turniermaßstab)
- Durchschnitt (Ø Punkte pro Runde)
- Differenz (+/- Punkte-Bilanz)

**Info-Hinweis:**
- ℹ️ "Namen sind Beispiele, frei konfigurierbar" → Benutzer kann eigene Namen setzen
- Statt "Zeit" werden die **nächsten Paarungen angezeigt**
- Bot-Namen sind erkennbar (z.B. "Easy Bot", "Medium Bot", "Hard Bot")

---

## Spieler-Setup Flow

### Neue Paarung erstellen
```
1. Spieler-Liste aufbauen:
   - Namen eingeben oder aus existierenden Spielern wählen
   - Optionen: Human oder Bot (Easy/Medium/Hard)
   
2. Pro Spieler Checkout-Optionen setzen:
   ┌─────────────────────────────────────┐
   │ Spieler: steffen                    │
   │ Type: Human                         │
   │ Checkout-Mode: [Double Out] [Single]│
   └─────────────────────────────────────┘
   
3. Spielmodus wählen:
   - 501 / 301 / 101
   - Check-In: Straight / Double
   
4. Match-Format wählen (Sätze/Legs):
   ┌──────────────────────────────────────┐
   │ Modus:                               │
   │ ○ Unbegrenzt     (Keine Limits)     │
   │ ○ Best of        (z.B. Best of 5)  │
   │ ○ First to       (z.B. First to 3) │
   └──────────────────────────────────────┘
   
   Bei "Best of":
   ┌──────────────────────────────────────┐
   │ Best of Sätze: [___] (z.B. 3, 5, 7) │
   │ → Spiel endet wenn Spieler n/2+1    │
   │   Sätze gewonnen haben              │
   └──────────────────────────────────────┘
   
   Bei "First to":
   ┌──────────────────────────────────────┐
   │ First to X Legs: [___]  (z.B. 3, 5) │
   │ Best of Y Sätze: [___]  (z.B. 1, 3) │
   │ → Leg = 1 Spiel                     │
   │ → Satz = n Legs gewonnen            │
   │ → Match = First to Y Sätze          │
   └──────────────────────────────────────┘
   
5. Bestätigung:
   - Zusammenfassung der Paarung anzeigen
   - "Spiel starten" Button
```

---

## Match-Format Erklärung

### Unbegrenzt
- Spieler spielen solange bis Beenden geklickt wird
- Kein Limit für Sätze/Legs
- Ideal für Trainings- oder Freizeitspiele

### Best of N
- Beispiele: Best of 3, Best of 5, Best of 7
- Spiel endet wenn ein Spieler (n/2 + 1) Sätze gewonnen hat
- **Best of 3**: Wer 2 Sätze gewinnt, gewinnt das Match
- **Best of 5**: Wer 3 Sätze gewinnt, gewinnt das Match
- **Best of 7**: Wer 4 Sätze gewinnt, gewinnt das Match

### First to X Legs, Best of Y Sätze
- Struktur: Leg → Satz → Match
  - **Leg**: Ein einzelnes 501/301/101 Spiel
  - **Satz**: Wer X Legs gewinnt, gewinnt einen Satz
  - **Match**: Wer Y Sätze gewinnt, gewinnt das Match
- **Beispiel "First to 3 Legs, Best of 1 Sätze"**:
  - Einfachste Form: Wer 3 Spiele (Legs) gewinnt, gewinnt das Match
  - = Identisch mit "Unbegrenzt" aber mit Stop bei 3 Gewinnen
- **Beispiel "First to 3 Legs, Best of 3 Sätze"**:
  - Wer 3 Legs gewinnt, gewinnt einen Satz
  - Wer 2 Sätze gewinnt, gewinnt das Match
  - Maximum: 15 Legs (3+3+3+3+3 = beste 3 von 5 Sätze)

### Beispiel Turnier-Setup
```
Turnier: "Friday Night Darts"
Spieler:
  1. steffen (Human, Double Out)
  2. DartBot Easy (Easy Bot)
  3. Alex (Human, Single Out)     ← Mixed Level
  4. DartBot Hard (Hard Bot)

Automatische Paarungen:
  - Runde 1: steffen vs. DartBot Easy
  - Runde 1: Alex vs. DartBot Hard
  - ... etc
```

---

## Roadmap

> **Umsetzungsstand:** Phase 1 und Phase 2 sind umgesetzt und im Einsatz (Hosting auf Raspberry Pi).
> Zusätzlich realisiert: Live-Sync mehrerer Clients per **Server-Sent Events (SSE)**, serverseitig
> getaktete Bot-Züge, **Ausbullen** bei Rundenlimit, Spielerverwaltung (anlegen/umbenennen, ID-basierte
> Namensauflösung), gespeicherte Spieler mit gemerktem Checkout-Modus, ausführlicher **Statistik-Bereich**
> (Zeitfilter, Double/Triple-%, 60+/100+/140+/180, Checkout, Sektor-Diagramm), ein **zweistufiger
> Theme-Switcher** (Farbwelt Standard/Girlie × Hell/Dunkel, inkl. Girlie-Dark), eine vor Spielbeginn
> wählbare **Zählvariante** (Numpad ↔ Freitext-Summe, pro Spiel bzw. Turnier) und **Checkout-Vorschläge nach offizieller
> Tabelle** (dartcoach.de). Offener Punkt siehe „Ausblick".

### Phase 1 (MVP) — ✅ umgesetzt
- [x] Express Backend mit SQLite
- [x] Basis-API (Games, Players, Scores)
- [x] 501/301/101 Spielmodi
- [x] Checkout-Modi: Double Out, Single Out (pro Spieler)
- [x] Check-In-Modi: Straight In, Double In
- [x] Match-Format: First to (Sätze+Legs), Best of (Leg-Mehrheit) und Unbegrenzt (endlos; „Spiel beenden & werten“ wertet den Leg-Führenden)
- [x] Numpad mit D/T Prefix (0 bei Double/Triple deaktiviert)
- [x] React + MUI Frontend
- [x] Mobile responsives Layout
- [x] Desktop-Anzeigetafel: Spieler nebeneinander, großer Restscore, aktiver umrahmt, Leg-/Satz-Pips (auch mobil)
- [x] Hell & Dunkel Theme (+ Girlie als drittes Theme)
- [x] Numpad Eingabe (0-20, 25, Multiplikatoren)
- [x] Zählvariante vor Spielbeginn wählbar: Numpad ↔ Freitext-Summe (Umschalter mit Icons in der Konfiguration, pro Spiel/Turnier). Freitext: 3 Pfeile/Aufnahme angenommen, Checkout-Pfeilzahl abgefragt (auch per Tastatur) → Ø/Legs/Siege erfasst; Feld auto-fokussiert (Zahl + Enter), Pfeilanzeige 🎯 nur im Numpad-Modus
- [x] Training-Bereich mit 7 Modi (Around the Clock, Bob's 27, Count-up, Cricket, Shanghai, Halve-it, Checkout-121) inkl. Anleitung + Dartboard, Bestwerte je Modus und modus-spezifischer Trainings-Statistik; plus X01 Unbegrenzt (nur hier); zuletzt gewählter Spieler/Pfeil wird in der DB gemerkt
- [x] Pfeile verwalten (Name + Gewicht g); Pfeil-Zuweisung je Spieler (Default 20 g), im Setup wählbar + persistiert; verwendeter Pfeil wird je Spiel erfasst (Statistik pro Pfeil)
- [x] Runden-Anzeige & Legs/Sätze Tracking
- [x] Undo-Funktion
- [x] Checkout-Vorschläge: Double Out nach offizieller Tabelle (dartcoach.de), Single Out bevorzugt einfaches Feld (10 statt D5)
- [x] Ausbullen bei konfigurierbarem Rundenlimit (Standard 20)

### Phase 2 (Turnier & Erweitert) — größtenteils umgesetzt
- [x] Turnier-Modus (Jeder gegen Jeden)
- [x] Automatische Paarungen (Random)
- [x] Turnier-Tabelle mit Live-Standings (Punkte 2/0, Legs, Ø) + Live-Match-Score (Tabelle ändert sich nach jedem Leg)
- [x] Turnier mit 1 oder 2 Gruppen + optionaler KO-Phase (Kreuz-Seeding, Freilose, Bracket mit durchgestrichenen Verlierern)
- [x] Dreistufige Phasen-Formate (Gruppe/KO/Finale), Tie-Break (Punkte→Leg-Diff→direkter Vergleich→Ø→Bull-off)
- [x] Platz 3 per Bull-off, Abschluss-Screen (Podium + Bestwerte: bester Ø, höchstes Finish, meiste 180er)
- [x] Statistiken (Ø, Checkout-Quote, Win-Rate, Legs, 60+/100+/140+/180, Sektor-Diagramm) mit Zeitfilter, getrennt nach Spiel & Turnier / Training und je Spieler nach Pfeil filterbar; Sektor-Balken prozentual und bei „Alle Pfeile“ farbig je Pfeil gestapelt
- [x] Training-Statistik je Modus im Bereich „Training“ (z. B. Fehlversuche je Feld bei Around the Clock)
- [x] Spieler-Profile (Spielerverwaltung + Einzel-Statistik pro Spieler)
- [x] Live-Sync mehrerer Clients (SSE) statt reinem Polling
- [ ] PWA (Offline-Fähigkeit)
- [ ] Multiple Spiele gleichzeitig
- [ ] Export (PDF/CSV)

### Phase 3 (Polish)
- [x] Zweistufiger Theme-Switcher: Farbwelt (Standard/Girlie) × Modus (Hell/Dunkel), inkl. Girlie-Dark, per Menü umschaltbar
- [ ] Animations / Transitions
- [ ] Accessibility (WCAG AA)
- [ ] Performance-Optimierung
- [ ] Sound-Effekte (optional)
- [ ] Mobile App (React Native, optional)

---

## Erste Schritte

### Local Development
```bash
# Setup
cd backend && npm install
cd ../frontend

# Backend starten (auf Port 3000)
npm start

# Frontend: Browser öffnen
http://localhost:3000
```

### Raspberry Pi Deployment
```bash
# 1. Node.js installieren (falls nicht vorhanden)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Projekt klonen/hochladen
git clone <repo> /home/pi/dartzaehler
cd /home/pi/dartzaehler/backend

# 3. Dependencies installieren
npm install

# 4. Service registrieren
sudo cp raspberry-pi/dartzaehler.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dartzaehler
sudo systemctl start dartzaehler

# 5. Im Browser aufrufen
http://<pi-ip>:3000
```

---

## Key Decisions

| Aspekt | Entscheidung | Begründung |
|--------|-------------|-----------|
| Backend Framework | Express | Lightweight, gut dokumentiert, einfach zu starten |
| Datenbank | SQLite | Lokal, keine zusätzliche Infra, perfekt für RPI |
| Frontend Framework | React + MUI | State Management für Turnier-Logik, professionelle UI |
| Spielmodi | 501/301/101 | Standard Dartzähler Modi, Cricket entfernt |
| Checkout | Pro-Spieler konfigurierbar | Anfänger (Single Out) vs. Erfahrene (Double Out) |
| Check-In | Straight/Double In | Mehr Variabilität im Spiel |
| Match-Format | Unbegrenzt/Best of/First to | Flexible Sätze/Legs Optionen |
| Numpad DOUBLE | 0 deaktiviert | D0 existiert nicht in Darts |
| Numpad TRIPLE | 0 & 25 deaktiviert | T0 und T25 existieren nicht |
| Theme | MUI Hell & Dunkel | User-wählbar, Material Design, professionell |
| Dart-Bots | 3 Schwierigkeiten | Easy/Medium/Hard für verschiedene Spielstärken |
| Mobile Numpad | 0-20 + Multiplikator | 0 für Fehlwurf, Single/Double/Triple Buttons |
| Header | Minimal (nur Zurück) | Fokus auf Spiel, keine ablenkenden Icons |
| Player-Liste | Scrollbar, aktiv hervorgehoben | Übersicht aller Spieler, klare Reihenfolge |
| Turnier-Modus | Jeder gegen Jeden | Zufällige Paarungen, Live-Tabelle mit Standings |
| PWA | Phase 2 | Erst MVP, dann erweitern |
| Live-Sync | Server-Sent Events (SSE) | Push statt Polling; ein Prozess liefert Frontend, API und Stream |
| Bot-Züge | Serverseitig getaktet | Bei mehreren Clients wirft niemand doppelt; wird per SSE gepusht |
| Ausbullen | Rundenlimit (Standard 20) | Absehbares Ende, falls Doppel nicht getroffen werden |
| Spieler-Identität | Eindeutige DB-ID, Name per ID aufgelöst | Umbenennen wirkt überall; gleiche Namen erlaubt |
| Statistik | Pro Spiel erfasst, mit Zeitstempel | Zeitfilter (Heute/7/30 Tage/Ganze Zeit), Detailkennzahlen inkl. Bots |
| Themes | Registry mit 3 Themes (Hell/Dunkel/Girlie) | Menü mit Farbpunkten, beliebig erweiterbar |

---

## Dart-Bot AI Strategie

### Bot Profile & Schwierigkeitsstufen

**Easy Bot (Anfänger)**
- Miss-Rate: ~40%
- Durchschnitt pro Runde: 25-35 Punkte
- Checkout-Versuche: Sehr selten erfolgreich (~20%)
- Throw-Muster: Zufällig, niedrige Multiplikatoren
- Use Case: Spieler trainieren, Anfänger-Matches

**Medium Bot (Mittel)**
- Miss-Rate: ~20%
- Durchschnitt pro Runde: 45-65 Punkte
- Checkout-Versuche: Gelegentlich erfolgreich (~50%)
- Throw-Muster: Balance zwischen Sicherheit und Risiko
- Use Case: Freizeitspiele, ausgewogener Gegner

**Hard Bot (Schwer)**
- Miss-Rate: ~10%
- Durchschnitt pro Runde: 70-90 Punkte
- Checkout-Versuche: Häufig erfolgreich (~80%)
- Throw-Muster: Optimierte Segmente, gute Multiplikatoren
- Use Case: Challenge-Spiele, Profi-Simulation

### Implementierung
- Zufallsalgorithmus mit Bot-Profil-Parametern
- Gewichtete Wahrscheinlichkeiten für verschiedene Segmente
- Checkout-Logik: Intelligente Auswahl bei niedrigen Scores
- Keine echte KI/ML nötig – parametrische Randomisierung genügt

---

## Nicht im Scope (MVP)

- Multiplayer über Internet (nur LAN)
- Mobile App (Web-App genügt)
- Backend Admin Panel
- Benutzer-Authentifizierung
- Statistik-Dashboards (Phase 2)
- Echtzeit-Multiplayer-Sync (nur Turnier-Paarungen)

---

## Ausblick – Geplante Erweiterung

Alle zuvor hier geplanten Erweiterungen sind inzwischen **umgesetzt**: der zweistufige Theme-Switcher,
die wählbare Zählvariante (Numpad ↔ Freitext-Summe) und das Turnier mit Gruppen- und optionaler
KO-Phase. Die folgende Beschreibung dokumentiert das umgesetzte Turnier-Feature.

### Turnier mit Gruppen- und optionaler KO-Phase — ✅ umgesetzt
Aus einer Gruppe lassen sich **zwei Gruppen** bilden (z. B. 8 Spieler → 2× 4). Zuerst spielt jede
Gruppe **Jeder gegen Jeden**; anschließend folgt – wenn aktiviert – eine **KO-Phase über Kreuz**.

**Turnier-Einstellungen:**
- Neuer Schalter **„KO-Phase spielen? Ja / Nein"**.
- Bei **Ja** wird zusätzlich abgefragt, **wie viele Spieler je Gruppe weiterkommen** (alle oder – per
  Eingabe – nur die ersten 2 bzw. 3). Dieser Wert bestimmt die Größe des KO-Baums.
- **Getrenntes Match-Format je Phase – dreistufig:** Gruppenphase, KO-Runden **und das Finale** werden
  jeweils separat abgefragt, sodass das Turnier zum Ende hin immer länger wird – z. B. Gruppenphase
  **Best of 1**, KO-Runden **Best of 3**, **Finale Best of 5/7**. Alternativ gilt ein Format fürs ganze Turnier.

**Gruppenphase – Übersicht:**
- Die **beiden Gruppen werden visuell nebeneinander** dargestellt (zwei Tabellen Seite an Seite),
  jeweils mit **Live-Scoring** der gerade laufenden Matches.
- Die **Tabelle aktualisiert sich nach jedem gewonnenen Leg** – nicht erst nach Spielende. Legstand
  und Platzierung ändern sich live (per SSE), während noch gespielt wird. (Gilt generell im Turnier.)

**Tabellen-Rangfolge (Tie-Breaker) bei Punktgleichheit:**
Haben mehrere Spieler gleich viele Punkte, entscheidet der Reihe nach:
1. **Punkte** (Sieg = 2)
2. **Leg-Differenz** (gewonnene − verlorene Legs)
3. **direkter Vergleich** (Ergebnis der Partie untereinander)
4. **Average** (Ø)
5. **Bull-off** (ein Wurf auf Bull – wer näher dran ist)

So ist die Setzung ins KO-Bracket immer eindeutig.

**Übergang zur KO-Phase (nur bei „Ja"):**
- Der Button **„Start Elimination-Phase"** wird **erst freigeschaltet, wenn alle Gruppen-Paarungen
  durchgespielt** sind. Vorher bleibt er deaktiviert.
- Kreuz-Seeding-Beispiele bei 2× 4 Spielern: **Alle (→ 8):** A1 vs. B4, A2 vs. B3, B1 vs. A4,
  B2 vs. A3 (Viertelfinale); **Top 2 (→ 4):** A1 vs. B2, B1 vs. A2 (Halbfinale). Bei ungerader/
  nicht-2er-Potenz-Anzahl erhalten die Gruppenbesten ein **Freilos** in die nächste Runde.

**KO-Phase – klassischer Turnierbaum:**
- Ein **klassischer Turnierbaum**: je Runde eine eigene Hintergrund-Spalte (Achtelfinale, Viertelfinale
  …), die Partien untereinander und jede Folgepartie **mittig zwischen ihren beiden Vorgängern**,
  verbunden durch klassische **Elbow-Verbindungslinien**.
- Je Paarung eine Karte mit beiden Spielern; die **gewonnenen Legs** stehen je Spieler rechts im
  dunklen Kasten, der **Sieger** ist fett und der **Verlierer durchgestrichen**. Startbare Partien haben
  den **Start-/Weiter-/Bull-off-Button direkt in der Box**.
- Optional: **Spiel um Platz 3** als eigener Block unter dem Baum.
- **Export:** der Turnierbaum lässt sich als **PNG oder PDF** exportieren – mit allen Ergebnissen und,
  bei beendetem Turnier, inklusive **Endstand/Podium und Bestwerten**. Das Bild wird dependency-frei aus
  den Turnierdaten als SVG gerendert (scroll-unabhängig, volle Breite).

**Turnier-Abschluss:**
- **Siegerehrung/Champion-Screen** mit Platz 1–3 sowie **Turnier-Bestwerte**: bester Average,
  höchstes Checkout-Finish und meiste 180er des Turniers.

---

### Training – Modi (umgesetzt)

Der Training-Bereich bietet Karten je Methode (Anleitung + Dartboard-Erklärung), Spieler-/Pfeilauswahl und
Bestwerte je Modus. **X01 Unbegrenzt** bleibt als freies Übungsspiel erhalten. Trainingsergebnisse werden
in der Statistik getrennt erfasst (eigener Bereich „Training"), damit sie Spiel-/Turnierwerte nicht
verfälschen, und lassen sich je Pfeil auswerten. Umgesetzte Trainingsmodi (nach gängigen Solo-Übungen):

- **Around the Clock (Rundum die Uhr):** der Reihe nach 1 → 20 → Bull treffen; misst Treffer/Würfe,
  ideales Aufwärmen und Feld-für-Feld-Genauigkeit.
- **Cricket (Solo):** 15–20 und Bull „schließen" (je 3 Treffer); klassisches Genauigkeitsspiel.
- **Shanghai:** je Runde eine Zielzahl auf Single/Double/Triple; Single+Double+Triple in einer Runde
  („Shanghai") gewinnt sofort, sonst höchste Punktzahl.
- **Bob's 27 (Doppel-Training):** Konto ab 27, nacheinander D1 → D20 → Bull; Treffer addieren, drei
  Fehlwürfe ziehen den Doppelwert ab – trainiert gezielt die Doppel.
- **Doubles- & Checkout-Training:** gezielte Doppel-/Finish-Übung, inkl. Checkout-Challenges
  (z. B. „121 in drei Darts", Restscore sinkt bei Erfolg) für die Finish-Sicherheit.
- **Halve-it:** feste Zielvorgaben je Runde; wird ein Ziel verfehlt, wird der bisherige Punktestand
  halbiert – trainiert Konstanz.
- **Count-up / High-Score:** feste Rundenzahl, maximale Punktzahl scoren; gut zum Verfolgen des
  3-Dart-Ø über die Zeit.

Jeder Modus speichert einen **Bestwert je Spieler** und erfasst **Detaildaten** (z. B. Fehlversuche je
Feld). Im Statistik-Bereich „Training“ bekommt jeder Modus dadurch eine **eigene Auswertung** (Rekord,
Ø und modus-spezifische Kennzahlen/Balken). Ausblick: Fortschritts-Tracking (Ø-Verlauf über Wochen).

## Personalisierte Checkout-Empfehlung (✅ umgesetzt)
Der Checkout-Vorschlag folgt weiterhin den **allgemeinen Richtlinien** (dartcoach-Tabelle). Zusätzlich
lernt die App **je Spieler**, welche Doppel er sicherer trifft, und richtet den **finalen Wurf** darauf aus.

- **Datenbasis:** Doppel-Trefferquote je Feld aus dem Training (Bob's 27) und aus echten Spielen
  (Doppel-Versuche/-Treffer je Ziel-Feld), gleich gewichtet in ein Spieler-Profil gepoolt.
- **Regel „deutlich besser":** greift erst ab **≥ 15 Versuchen** je Doppel und einem **Quotenunterschied
  von ≥ 15 Prozentpunkten** gegenüber dem Standard-Doppel (feste Werte im Code).
- **Umfang:** angepasst wird das **Finish-Doppel** (z. B. D16 statt D20) **inkl. Aufbau-Würfe** – die
  komplette Route wird für das neue Zieldoppel neu hergeleitet, aber immer mit derselben Dartzahl wie die
  Standard-Route, sodass **nie ein mathematisch schlechterer Weg** vorgeschlagen wird.
- **Steuerung:** pro Spieler an-/abschaltbar (nur in der Spielerverwaltung); im UI ein kleiner Hinweis
  („angepasst an deine Doppelquote").

## Statistik-Tiefe (✅ umgesetzt)

- **Fortschritts-Timeline:** je Kalenderwoche Average, Erste-9-Ø, Checkout-% und 180er als Linien-Chart
  auf der Spieler-Statistikseite – gefiltert nach Bereich (Spiel/Turnier bzw. Training) und je Pfeil.
- **Match-Historie mit Wiederansicht:** jedes beendete Spiel wird Aufnahme für Aufnahme gespeichert
  (Würfe, Restscore, Bust/Checkout/Ausbullen je Leg und Satz) und lässt sich als Verlauf erneut ansehen
  (eigener Bereich „Match-Historie", auch je Spieler gefiltert).
- **Erweiterte Kennzahlen:** bestes Visit (höchste Aufnahme), Doppelquote je Wurf („Checkout unter Druck")
  und Cricket-MPR (Marks pro Runde) in der Trainings-Statistik.
- **Export:** Spielerstatistik und Match-Historie als **CSV** (Datei-Download); **PDF** über die
  Druckfunktion des Browsers („Als PDF speichern") mit ausgeblendeten Bedienelementen.

## Sound & Voice-Caller (✅ umgesetzt)

Akustisches Feedback, **pro Gerät** an-/abschaltbar (Menü im Header, Einstellung im Browser gespeichert) –
so kann z. B. nur die Anzeigetafel am TV tönen, während die Handys stumm bleiben.

- **Sound-Effekte** bei Leg-Gewinn, Spielende, Bust, 180 und der Ausbullen-Aufforderung.
- **Voice-Caller (Deutsch oder Englisch, weiblich/männlich):** im PDC-Stil, z. B. „Game on!", Ansage der Aufnahme-Summe (mit dem legendären
  „One hundred and eighty!"), „Game shot!" beim Leg und „Game shot, and the match!" beim Sieg. Beim
  Spiel-/Paarungsstart wird zudem eine Eröffnung mit den Spielernamen angesagt („… gegen …, auf geht's!").
- **Stimmenauswahl je Gerät:** zusätzlich zum Weiblich/Männlich-Schalter lässt sich eine **konkrete, auf
  dem Gerät installierte Stimme** je Sprache direkt auswählen (hilfreich, wenn ein Betriebssystem – z. B.
  iOS – für eine Sprache nur bestimmte Stimmen bereitstellt). „Automatisch" wählt weiterhin nach
  Geschlecht; Sprache/Stimme sind Geräte-Standard und **je Spieler** überschreibbar.
- **Zwei Tonquellen umschaltbar:** *Erzeugt* (im Browser synthetisiert bzw. Sprachausgabe – komplett
  offline, keine Dateien nötig) oder *Audio-Clips* (eigene MP3s unter `/sounds/…`, mit automatischem
  Fallback auf „Erzeugt"). Lautstärke regelbar, Voice separat abschaltbar.

## Cast-/Vollbild-Modus & Achievements (✅ umgesetzt)

- **Cast / Anzeigetafel:** eigener Startseiten-Bereich; ein laufendes Spiel wird groß und **eingabefrei**
  auf einem zweiten Bildschirm angezeigt (Spieler nebeneinander, großer Restscore, aktiver Spieler
  hervorgehoben, Leg-/Satz-Pips, Checkout-Vorschlag), inkl. Browser-Vollbild und Live-Sync.
- **Achievements:** über 40 Erfolge in den Kategorien Siege, Scoring, Checkout, Meilensteine und Training,
  jeweils mit Beschreibung. Sie werden je Spieler automatisch beim Spiel- bzw. Trainingsende vergeben
  (ab jetzt, nicht rückwirkend) und auf einer eigenen Seite mit Zuordnung der Spieler angezeigt.

## Startseite & Verwaltung (✅ umgesetzt)

Die Startseite ist auf fünf Aktionen reduziert: *Neues Spiel*, *Neues Turnier*, *Training*,
**Verwaltung** und *Cast*. Unter **Verwaltung** liegen **Spieler- und Pfeilverwaltung nebeneinander**
in einer Ansicht; darüber führen Buttons zu **Statistik, Match-Historie und Achievements**. Die
Zurück-Navigation im Verwaltungs-Bereich führt jeweils zur zuvor besuchten Ansicht zurück (nicht mehr
fest auf die alte Spielerseite).

## Coaching & KI – lokal & regelbasiert (✅ umgesetzt)

Stufe 6 in der Offline-Variante: alles läuft heuristisch auf dem Pi, ohne externen KI-Dienst.

- **KI-Coach:** eigener Punkt in der Verwaltung mit Spielerauswahl. Wertet die Spielstatistik und das
  Doppel-Profil aus, bildet ein **Schwächen-Ranking** und mappt jede Schwäche auf einen konkreten
  Trainingsmodus (Checkout → Checkout-Challenge, Doppel → Bob's 27, Scoring → Count-up, Erste 9 →
  Around the Clock, 100+ → Shanghai). Liefert **Fokus der Woche**, Begründung mit echten Werten, einen
  Ø-Trend aus der Timeline und einen „Übung starten"-Button, der direkt in den Modus springt. Endpoint
  `GET /api/players/:id/coach` (`backend/utils/coach.js`).
- **Adaptiver KI-Gegner:** Bot-Level **„Adaptiv"** (fair oder fordernd). Die Ziel-Stärke startet am
  historischen Ø der menschlichen Gegner und wird leg-für-leg an deren aktuelle Match-Form nachgeführt
  (Gummiband). Das Treffer-Modell wird dafür stufenlos zwischen den Easy/Medium/Hard-Parametern
  interpoliert (`profileForAverage` in `botAI.js`).
- **Live-Kommentar:** optional, in den Ton-Einstellungen aktivierbar. Regelbasierte Bausteine kommentieren
  Highlights (180, große Aufnahme, starkes Checkout, Bust, Match-Sieg) zweisprachig über den Voice-Caller
  und als **Ticker auf der Anzeigetafel**.

## Feinschliff aus dem Praxistest (✅ umgesetzt)

- **Statistik erweitert:** höchste Aufnahme (war bereits vorhanden) plus **Tons (100+)**, **Fehlwürfe** und **Fehlwurf-Quote** je Spieler.
- **Ausbullen-Default je Modus:** 501 → 20, 301 → 15, 101 → 10 Runden (wird beim Moduswechsel automatisch gesetzt).
- **Anzeigetafel-Infobox ab 3 Spielern:** höchste Aufnahme der aktuellen Runde (mit Spieler), höchste Aufnahme des Spiels und die meisten Fehlwürfe.
- **Checkout-Vorschlag beachtet verbleibende Pfeile:** mit nur noch einem Pfeil im Zug werden keine 2-/3-Feld-Routen mehr angezeigt (`findCheckout(score, mode, maxDarts)`).
- **Training-Zwischenstand:** ein abgebrochenes Training speichert seinen Stand (localStorage je Modus/Spieler) und bietet beim nächsten Aufruf „Fortsetzen".
- **Mehr Achievements:** u. a. Triple 20, Bullseye, erstes Doppel, Triple-/Bull-Sammler, Bull-Finish, Siegesserie (3), Sparsam (501-Leg ≤15 Darts), Vielwerfer (10.000 Darts) sowie die Kategorie „Kurios" (Frühaufsteher/Nachteule). Zusätzlich engine-gestützt: **Zu-Null-Satz**, **Comeback** (Gegner war am Matchdart), **Doppel-Serie** (5 Legs in Folge per Checkout) und **Shanghai im echten Spiel** – jetzt 57 insgesamt.
- **Achievements im Endstand:** die in einem Spiel neu erspielten Erfolge werden im „Spiel beendet"-Dialog je Spieler mit Icon angezeigt (`game.achievementsEarned`).
- **Master Out:** eigener Checkout-Modus (Finish auf Doppel oder Triple) nach der darts1.de-Master-Tabelle; der Vorschlag zeigt zusätzlich die klassische Doppel-Alternative (z. B. Rest 18 → T6 oder D9). Pro Spieler wählbar, mit Info-Tooltip.
- **Dritte Zählvariante „Board":** Eingabe per Antippen des virtuellen Dartboards (Ring = Single/Double/Triple), volle Detailstatistik wie der Numpad; backend-seitig identisch zu `numpad`.
- **Mehrfach-Fehlwurf:** im Numpad und Board wird die 0 mit Double/Triple zu 0×2/0×3 (zwei bzw. drei Fehlwürfe auf einmal, gegen die verbleibenden Pfeile validiert).
- **Statistik je Modus/Pfeil:** bestes Leg (Min. Darts) getrennt nach 501/301/101; im Sektor-Diagramm der Ø je Pfeil, bester Pfeil fett als Empfehlung.
- **Best of als Default** beim neuen Einzelspiel; **Auto-Scroll** zur aktiven Spielerkarte in der gestapelten Handy-Ansicht.
- **Performance:** die Undo-Historie wird nicht mehr in SQLite persistiert (nur im Speicher) und die Snapshots enthalten das Verlaufsprotokoll nicht mehr – behebt zunehmende Latenz/„Failed to fetch" in langen Spielen auf dem Pi.

## Weitere Ausbaustufen (Roadmap)

Ideen für die Weiterentwicklung, orientiert an führenden Dart-Systemen
(Scolia, Gungnir, Dartsmind, DartCounter). Grob nach Aufwand gestaffelt:

### Stufe 1 – Komfort & Anzeige (klein)
- **PWA/Offline-Installation** (App-Icon, ohne Browserleiste) sowie **Backup/Restore** der SQLite-Datenbank.

### Stufe 3 – Auto-Scoring (groß)
- **Kamerabasierte automatische Wurferkennung** (lokal auf dem Gerät, wie Dartsmind) inklusive
  **Heatmap/Trefferbild** und koordinatenbasierter Statistik (wie Scolia/Gungnir).

### Stufe 4 – Online & Community (groß)
- **Online-Multiplayer** für Fernduelle und ein **Zuschauer-Link** zum Mitverfolgen.
- **Benutzerkonten + Cloud-Sync**, **Bestenlisten/Hall of Fame**, **Elo-Rating** (auch als Turnier-Setzung),
  Ranglisten.

### Stufe 5 – Turnier-Ausbau (mittel)
- Mehr als zwei Gruppen, **Doppel-/Team-Modus**, **Handicaps**, Spielplan/Scheduling, Bracket-Druck/-Export.

### Querschnitt
- **Mehrsprachigkeit** (i18n) und **Barrierefreiheit** (WCAG AA).

---

## Kontakt / Owner

- **Projekt Lead**: Steffen Kunz
- **Status**: Umgesetzt & im Einsatz (MVP + Turnier mit KO-Phase + Statistik nach Pfeil + Training + SSE-Live-Sync), Hosting auf Raspberry Pi
- **Start**: 2026-07-02
