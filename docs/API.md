# REST-API-Referenz

Basis-URL: `http://<host>:3000/api`

Alle Requests/Responses sind JSON. Ein Wurf (`dart`) ist `{ "segment": 0–20|25, "multiplier": 1|2|3 }` (0 = Fehlwurf).

## Health

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/health` | `{ ok: true, version }` |

## Spieler

| Methode | Pfad | Body | Beschreibung |
|---|---|---|---|
| GET | `/players` | – | Liste gespeicherter Spieler |
| POST | `/players` | `{ name, type?, botLevel?, checkoutMode?, dartId? }` | Spieler anlegen |
| PUT | `/players/:id` | `{ name?, checkoutMode?, dartId?, personalizeCheckout?, voice? }` | Umbenennen und/oder Checkout-Modus/Pfeil/Personalisierung/Sprachausgabe setzen (persistiert) |
| GET | `/players/:id/coach` | – | Regelbasierte Trainingsempfehlungen (KI-Coach): Schwächen-Ranking, Fokus, Ø-Trend |

Spieler-Objekt: `{ id, name, type, botLevel, checkoutMode, dartId, personalizeCheckout, voice, createdAt }`. `voice` = bevorzugte Sprachausgabe des Voice-Callers (`de-female` | `de-male` | `en-female` | `en-male` | `null` = Geräte-Standard). Jeder Spieler bekommt
standardmäßig den Default-Pfeil (20 g).

## Pfeile

| Methode | Pfad | Body | Beschreibung |
|---|---|---|---|
| GET | `/darts` | – | Liste aller Pfeile |
| POST | `/darts` | `{ name, weightGrams }` | Pfeil anlegen (Gewicht in ganzen Gramm) |
| PUT | `/darts/:id` | `{ name?, weightGrams? }` | Pfeil bearbeiten |
| DELETE | `/darts/:id` | – | Pfeil löschen (betroffene Spieler wandern auf einen verbleibenden Pfeil; der letzte Pfeil bleibt) |

Pfeil-Objekt: `{ id, name, weightGrams, createdAt }`.

## Einzelspiel / Training (X01)

| Methode | Pfad | Body | Beschreibung |
|---|---|---|---|
| POST | `/games` | Game-Config (s. u.) | Neues Spiel; liefert Spielzustand |
| GET | `/games` | – | Kurzliste letzter Spiele |
| GET | `/games/:id` | – | Aktueller Spielzustand |
| POST | `/games/:id/throw` | `{ segment, multiplier }` | Einen Dart werfen (Numpad-Modus) |
| POST | `/games/:id/visit` | `{ sum, checkoutDarts? }` | Ganze Aufnahme als Summe (Freitext-Modus); `checkoutDarts` (1–3) beim finishenden Wurf |
| POST | `/games/:id/finish` | – | Unbegrenzt-Spiel manuell beenden & werten (Leg-Führender gewinnt) |
| POST | `/games/:id/bot-turn` | – | Aktiven Bot einen Visit spielen lassen |
| POST | `/games/:id/bulloff` | `{ winnerId }` | Leg per Ausbullen entscheiden (bei `awaitingBullOff`) |
| GET | `/games/:id/stream` | – | **SSE-Live-Stream** (`event: state` / `deleted`); Bots laufen serverseitig und werden mitgepusht |
| POST | `/games/:id/undo` | – | Letzten Dart rückgängig machen |
| DELETE | `/games/:id` | – | Spiel löschen |

**Game-Config:**

```json
{
  "mode": 501,
  "checkIn": "straight",
  "satzLegMode": "firstto",
  "sets": 1,
  "legs": 3,
  "maxRounds": 20,
  "inputMode": "numpad",
  "training": false,
  "randomOrder": true,
  "players": [
    { "name": "steffen", "type": "human", "checkoutMode": "double", "dartId": 1 },
    { "name": "DartBot", "type": "bot", "botLevel": "easy", "checkoutMode": "single" }
  ]
}
```

- `mode`: `501 | 301 | 101`
- `checkIn`: `straight | double`
- `satzLegMode`: `firstto | bestof | unlimited` (`unlimited` nur im Training-Bereich)
- `maxRounds`: Rundenlimit fürs Ausbullen (0 = aus)
- `inputMode`: `numpad | sum | board` (`sum` = Freitext-Summe, `board` = Tippen aufs Dartboard; `board` verhält sich wie `numpad`, volle Statistik)
- `training`: `true` markiert das Spiel als Training (getrennte Statistik)
- `checkoutMode` (pro Spieler): `double | single | master` (Master = Finish auf Doppel oder Triple)
- `dartId` (pro menschlichem Spieler): zugewiesener Pfeil; wird beim Start wie der Checkout-Modus persistiert
- `botLevel`: `easy | medium | hard | adaptive` (adaptiv passt die Stärke an den Gegner-Ø an; optional `adaptivePush: true` = etwas fordernder)
- `personalizeCheckout` (Spieler-Feld, per `PUT /api/players/:id`): schaltet die personalisierte
  Checkout-Empfehlung für diesen Spieler ein/aus (Standard: aus, nur in der Spielerverwaltung setzbar)

**Spielzustand (Auszug):** `id, mode, checkIn, format, maxRounds, inputMode, checkoutLabel,
currentPlayerIndex, legNumber, setNumber, roundNumber, awaitingBullOff, status, winnerId, message,
messagePlayer, checkoutSuggestion, dartsRemaining, castInfo, canUndo, players[]`. `dartsRemaining` = im aktuellen Zug verbleibende Pfeile (der Checkout-Vorschlag ist darauf begrenzt). `castInfo` (nur bei 3+ Spielern) = `{ roundTop:{score,name}, gameTop:{score,name}, mostMiss:{count,name} }` für die Anzeigetafel. Spieler: `{ id, dbId, name, type, botLevel,
checkoutMode, score, legsWon, setsWon, average, dartsThrown (Leg), currentTurn, lastTurnDarts,
turnScore, lastVisitScore, isActive }`. `message` ist transient (`BUST | CHECKOUT | BULLOFF_WIN`).

`checkoutSuggestion` ist entweder `null` (nicht finishbar) oder `{ route: string[], personalized: boolean, targetDouble? }`. Bei **Master Out** enthält es zusätzlich `altRoute: string[]` – die klassische Doppel-Alternative (z. B. Rest 18 → `route: ["T6"]`, `altRoute: ["D9"]`).
`personalized: true` bedeutet, dass die Route (inkl. Aufbau-Würfen) auf ein Doppel umgestellt wurde, das der
aktive Spieler laut eigener Trefferstatistik zuverlässiger trifft (siehe `personalizeCheckout` bei Spielern) –
niemals mit mehr Darts als die Standard-Route.

## Turnier

| Methode | Pfad | Body | Beschreibung |
|---|---|---|---|
| POST | `/tournaments` | Turnier-Config (s. u.) | Turnier + Gruppen + Round-Robin-Paarungen anlegen |
| GET | `/tournaments` | – | Kurzliste |
| GET | `/tournaments/:id` | – | Zustand inkl. Gruppen-Standings, Bracket & nächste Paarungen (synchronisiert fertige Spiele) |
| GET | `/tournaments/:id/stream` | – | **SSE-Live-Stream** der Übersicht (`event: state` / `deleted`); aktualisiert nach jeder Änderung (auch nach jedem Leg) |
| POST | `/tournaments/:id/matches/:matchId/start` | – | Spiel für ein Match erzeugen (Phasen-Format); liefert `{ gameId, game }` |
| POST | `/tournaments/:id/start-ko` | – | KO-Phase starten (Bracket); nur wenn alle Gruppenspiele fertig und keine offenen Bull-offs |
| POST | `/tournaments/:id/bulloff` | `{ matchId, winnerId }` **oder** `{ aId, bId, winnerId }` | Bull-off: KO-/Platz-3-Match bzw. Gruppen-Gleichstand |
| DELETE | `/tournaments/:id` | – | Turnier löschen |

**Turnier-Config:** `{ name, mode, checkIn, inputMode, maxRounds, groupCount (1|2), koEnabled,
koAdvance (0=alle|2|3), thirdPlace, phaseFormats: { group, ko, final }, players[] }`. Jedes Phasen-Format
ist `{ satzLegMode, sets, legs }` (`unlimited` im Turnier nicht erlaubt). Ausbullen-Standard: 20 Runden.

**Standings-Zeile:** `{ rank, name, type, botLevel, wins, losses, legs, legsAgainst, points, avg, diff }`
(`points` = 2 pro Sieg; Tie-Break: Punkte → Leg-Differenz → direkter Vergleich → Ø → Bull-off).
Live laufende Legs fließen in die Leg-Spalten ein (Tabelle ändert sich nach jedem Leg).

## Statistik

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/stats?range=today\|7d\|30d\|all&area=game\|training` | Aggregierte Statistik aller Spieler (Bereich + Zeitfenster) |
| GET | `/stats/:playerId?range=&area=&dart=<dartId>` | Statistik eines Spielers, optional auf einen Pfeil gefiltert |
| GET | `/stats/:playerId/darts?area=` | Vom Spieler benutzte Pfeile mit Spielanzahl (für den Pfeil-Filter) |
| GET | `/stats/:playerId/sectors?area=&range=` | Sektor-Trefferzahlen **und Ø je Pfeil** (gestapelte Balken „Alle Pfeile"; bester Ø = Empfehlung) |
| GET | `/stats/:playerId/timeline?range=&area=&dart=<dartId>` | Fortschritt je Kalenderwoche (Ø, Erste-9-Ø, Checkout-%, 180er) |

- `area`: `game` = Spiel & Turnier (Standard), `training` = Trainingsspiele (getrennt).
- `dart`: optionale `dartId` zum Filtern auf einen bestimmten Pfeil.

**Zeile:** `{ playerId, name, type, botLevel, games, wins, winPct, legs, legsWon, legsWinPct, average,
first9Avg, dartsAvg, doublePct, triplePct, maxTurn, s60, s100, s140, s180, maxCheckout, minDarts,
checkoutPct, doubleHits, doubleTries, doubleRatePct, tons, misses, missPct, minDartsByMode, sectors }`. `tons` = Aufnahmen ab 100, `misses` = Fehlwuerfe (Sektor 0), `missPct` = Fehlwurf-Quote. `minDartsByMode` = bestes Leg (wenigste Darts) je Spielmodus, z. B. `{ "501": 15, "301": 9 }`. `doubleRatePct` = Doppel-Trefferquote je Wurf („Checkout unter Druck", aus `double_stats`). `sectors` = Map `Label→Treffer` (`"T20"`, `"D16"`, `"25"`, `"0"`).

## Einstellungen

| Methode | Pfad | Body | Beschreibung |
|---|---|---|---|
| GET | `/settings` | – | Alle Einstellungen als `{ key: value }` |
| PUT | `/settings` | `{ key, value }` | Eine Einstellung setzen (Upsert) |

Genutzt u. a. für `training.playerId` / `training.dartId` (zuletzt gewählter Trainings-Spieler/-Pfeil,
geräteweit gemerkt).

## Training

| Methode | Pfad | Body | Beschreibung |
|---|---|---|---|
| POST | `/training/records` | `{ playerId, mode, score, detail? }` | Trainingsergebnis speichern; liefert aktualisierte Bestwerte je Modus |
| GET | `/training/records/:playerId` | – | Bestwerte je Modus: `{ [mode]: score }` |
| GET | `/training/stats/:playerId?range=` | – | Aggregierte Trainings-Statistik je Modus: `{

## Match-Historie

Jedes beendete Spiel wird als Kopf-Datensatz plus Aufnahme-für-Aufnahme-Verlauf gespeichert
(Tabellen `match_history` + `match_visits`).

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/matches?range=&area=all\|game\|training&player=<dbId>` | Liste abgeschlossener Spiele (Kopf-Daten) |
| GET | `/matches/:id` | Ein Spiel inkl. vollem Aufnahme-Verlauf (`visits[]`) |
| DELETE | `/matches/:id` | Historie-Eintrag löschen |

**Kopf-Objekt:** `{ id, finishedAt, isTraining, tournamentId, mode, formatLabel, inputMode,
winnerName, players[] }`. Spieler: `{ dbId, name, type, botLevel, legsWon, setsWon, average, won }`.

**Visit-Objekt** (`GET /matches/:id`, Feld `visits`): `{ seq, playerId, name, setNo, legNo, roundNo,
darts[], score, remaining, kind }`. `kind` = `visit | bust | checkout | bulloff`; `darts` ist im
Freitext-/Summen-Modus leer (nur die Summe ist bekannt).

## Export

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/export/stats.csv?range=&area=` | Aggregierte Spielerstatistik als CSV (Semikolon, UTF-8-BOM) |
| GET | `/export/matches.csv?range=&area=&player=` | Match-Historie als CSV |

CSV wird als Datei-Download ausgeliefert (`Content-Disposition: attachment`). Ein PDF-Export erfolgt
im Frontend über die Druckfunktion des Browsers („Als PDF speichern").

Der **Turnierbaum-Export** (PNG/PDF, inkl. Endstand bei beendetem Turnier) hat **keinen Endpoint**: er
wird rein im Frontend aus den Turnierdaten als SVG gerendert und clientseitig als PNG bzw. PDF
heruntergeladen (`frontend/src/tournamentExport.js`).

## Achievements

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/achievements` | Katalog aller Achievements + welche Spieler sie erreicht haben |

**Antwort:** `{ catalog: [{ id, cat, name, desc, nameEn, descEn, icon }], earners: { [achievementId]: [{ playerId,