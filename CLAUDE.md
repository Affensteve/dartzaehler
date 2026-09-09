# DartZähler – Projekt-Leitfaden (für KI-Sessions & Mitwirkende)

Offline-fähiger Darts-Scorer fürs lokale Netzwerk, gehostet auf einem Raspberry Pi.
Handy = Numpad/Eingabe, Monitor = Cast-Anzeigetafel. Kein Internet/Cloud nötig,
vollständig zweisprachig (DE/EN).

## Stack & Layout
- **Backend** `backend/` – Express + better-sqlite3 (WAL). Start: `npm start` (Port 3000).
  - `utils/gameEngine.js` – X01-Engine (Legs/Sätze, Bust, Undo, Bots, toClient-View).
  - `utils/dartRules.js` – Checkout-Tabellen, `findCheckout`, `findPersonalizedCheckout`.
  - `utils/botAI.js` – Bot-Profile (easy/easyplus/medium/hard/adaptive), Ø ~30/40/55/80.
  - `utils/achievements.js` – Katalog (ACHIEVEMENTS + EN + ICONS + PROGRESS), `catalog()/satisfiedIds()/progressFor()`.
  - `utils/achievementEval.js` – `matchStatsFor()` liefert die Match-Flags für die Achievement-Checks.
  - `utils/doubleProfile.js` / `utils/tripleProfile.js` – gemessene Doppel-/Triple-Quoten.
  - `models/*Store.js` – SQLite-Zugriffe. `db/init.js` = Schema + ALTER-Migrationen.
  - `routes/*.js` – REST unter `/api`. Spiel-Aktionen: `/games/:id/{throw,turn,visit,finish,surrender,bulloff,undo}`.
  - **Team-Turniere (Stufe 5)**: Turnier-Teilnehmer sind generische Einheiten (Einzelspieler ODER Team mit `type:'team'`+`members`); `tournamentLogic`/`bracket`/`view` arbeiten rein über Einheit-`id`. Match-Start baut bei Teams `engine.createGame({teams:[…]})`; die Team-Einheit erhält im Spiel die **Turnier-Einheit-ID** (`id: team.id || t${ti}` in gameEngine), damit `tview.syncResults` (`game.players.id === match.pX`) für Teams greift. Frontend: Einzel/Doppel-Tabs im `TournamentSetupPage` (`body.teams`).
  - **Party (Stufe 4)**: Startknoten „Party" (`pages/PartyPage.jsx`, Route `/party`). X01 601/701 + Gotcha laufen über die bestehende X01-Engine (601/701 in `dartRules.START_SCORES`/`validators.MODES`; Gotcha = Single-Out). **Killer/Baseball/Golf**: eigene Server-Engine `utils/partyEngine.js` (+ `models/partyStore.js`, Tabelle `party_games`, Routen `/api/party`, SSE via gameEvents, Frontend `pages/PartyGamePage.jsx` mit `BoardInput`, Route `/party/game/:id`). Zug-Modell: 3 Darts/Spieler, `roundNumber` = Runde/Inning/Loch. Auch **Shanghai/Clock/Halve-it** laufen über `partyEngine`. Party-Cast-Vollbild: `pages/PartyCastPage.jsx`, Route `/party/cast/:id`. `game.partyFlags` (killerArmed/baseballSlam/golfBirdie) + `partyMode` fließen in `matchStatsFor` → 18 Party-Achievements (Kategorie `Party`). Party-Spiele liegen in `party_games` (getrennt von X01, tauchen NICHT in der Home-„läuft"-Liste auf). Tests: `tests/party.test.js`.
  - **Ranglisten/Ligen (Stufe 7)**: `utils/elo.js` (Elo-Mathe, feste Bot-Ratings), `models/ratingStore.js` (Elo **zustandslos aus `match_history` per Replay**, Leaderboard/ratingMap/forPlayer), `models/leagueStore.js` (Ligen/Saisons + Tabelle aus `match_history.league_id`), Routen `/api/ratings` + `/api/leagues`. `game.leagueId` → `match_history.league_id`. Turnier-Setzung via `body.seedByElo`. Elo-Achievements (`elo-1100/1250`, `ranked-10`) über `ctx.elo/rankedGames` in achievementEval.
- **Frontend** `frontend/` – React 18 + MUI 5 + Vite 5. Custom i18n in `src/i18n.js` (DICT.de/DICT.en, `t/useT/useLang`).
  - Wichtige Dateien: `pages/GamePage.jsx`, `pages/CastPage.jsx`, `pages/PlayerStatsPage.jsx`,
    `components/PlayerCard.jsx`, `components/DartboardHeatmap.jsx`, `hooks/useGame.js`,
    `sound.js` (Geräte-Ton/Optionen), `commentary.js`, `statsReport.js` (PDF, SVG→Canvas→JPEG→PDF).

## Konventionen
- **i18n**: Jeder neue UI-Text braucht einen Key in **DICT.de UND DICT.en** (`src/i18n.js`).
- **Achievements**: Eintrag in `ACHIEVEMENTS` + Key in `EN` + Icon in `ICONS`; kumulative Ziele zusätzlich in `PROGRESS`. Kategorien: Siege, Scoring, Checkout, Meilensteine, Kurios, Training, Team (i18n `ach.cat.*`).
- **Ton/Anzeige-Optionen** sind Geräte-Settings in `sound.js` (localStorage), z. B. `checkoutCall`, `avatarsInGame`, `batchScoring`.
- **Checkout-Personalisierung**: Route-Auswahl nutzt strenge Schwelle `PERSONALIZATION_MIN_ATTEMPTS=15`; die **Anzeige** der besten Doppel/Triple nutzt Schwelle 3.
- **Zeitstempel**: SQLite `datetime('now')` speichert **UTC**. Im Frontend als UTC parsen und lokal `TT.MM.JJJJ HH:MM` ausgeben (siehe `fmtDateTime` in PlayerStatsPage).
- **Scoring-Eingabe**: Bei Rest > 170 werden Darts optimistisch lokal gesammelt und gebündelt via `/turn` gesendet (Flush-Schwelle = `3 - bereits am Server liegende Darts`); im Checkout (≤170) sofort je Dart.

## Verifikation (immer vor "fertig")
- Backend-Syntax: `node --check <datei>`  ·  Tests: `node --experimental-sqlite --test` (im backend/).
- Frontend-Build: `npm --prefix frontend run build`.
- Nach jeder Datei-Änderung **NUL-Scan**: `tr -cd '\000' < datei | wc -c` (muss 0 sein) und Zeilenzahl prüfen.

## WICHTIGE Gotchas (Zeit/Token-Fresser)
- **Editor-Tool schneidet Dateien gelegentlich ab / fügt NUL-Bytes ein** (mehrfach passiert: gameEngine.js, CastPage.jsx, PlayerCard.jsx, commentary.js, i18n.js). → Größere/mehrfache Änderungen **per `python3`/`bash`-Heredoc** schreiben, danach `node --check` + Zeilenzahl + NUL-Scan. Bei Truncation: aus `git show HEAD:<pfad>` wiederherstellen und Änderungen erneut per Skript anwenden.
- **In String-Anker (Python-Replace) keine Apostrophe** in einfach-gequoteten JS-Strings (z. B. "St. Patrick's") – bricht die Syntax.
- **ICONS/EN in achievements.js** wurden teils als `\uXXXX`-Escapes gespeichert – beim Anker beachten (nicht das rohe Emoji suchen).
- Reihenfolge bei mehrstufigem Python-Replace: Asserts vor dem Schreiben; sonst Teil-Writes.
