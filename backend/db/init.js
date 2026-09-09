'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.resolve(__dirname, '..', 'data', 'dartzaehler.db');

// Datenverzeichnis sicherstellen
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
// WAL-sicher: kein fsync pro Commit (nur beim Checkpoint). Auf dem Pi/SD-Karte
// drastisch schnellere Schreibvorgänge; Risiko bei Stromausfall max. die letzte
// Aufnahme – keine Korruption.
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Schema einspielen
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migration für bestehende Datenbanken: Spalte checkout_mode ergänzen, falls sie fehlt.
try {
  db.exec("ALTER TABLE players ADD COLUMN checkout_mode TEXT NOT NULL DEFAULT 'double'");
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}
// Migration: Spalte dart_id für die Pfeil-Zuordnung ergänzen.
try {
  db.exec('ALTER TABLE players ADD COLUMN dart_id INTEGER');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: game_stats um Trainings-Flag und Pfeil-Zuordnung ergänzen.
try {
  db.exec('ALTER TABLE game_stats ADD COLUMN is_training INTEGER NOT NULL DEFAULT 0');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}
try {
  db.exec('ALTER TABLE game_stats ADD COLUMN dart_id INTEGER');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: personalisierte Checkout-Empfehlung (Spieler-Schalter + Doppel-Statistik).
try {
  db.exec('ALTER TABLE players ADD COLUMN personalize_checkout INTEGER NOT NULL DEFAULT 0');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}
try {
  db.exec("ALTER TABLE game_stats ADD COLUMN double_stats TEXT NOT NULL DEFAULT '{}'");
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: Checkout-Erfolg je Rest-Bereich + „unter Druck" (JSON).
try {
  db.exec("ALTER TABLE game_stats ADD COLUMN checkout_ranges TEXT NOT NULL DEFAULT '{}'");
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: Spielmodus (501/301/101) je Statistikzeile – für modus-bezogene Kennzahlen (Min-Darts).
try {
  db.exec('ALTER TABLE game_stats ADD COLUMN mode INTEGER');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: bevorzugte Sprachausgabe je Spieler.
try {
  db.exec('ALTER TABLE players ADD COLUMN voice TEXT');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: erweiterte Spielerprofile (Foto, Farbe, Spitzname, Händigkeit,
// Lieblingsdoppel, Geburtstag, Verein/Team, Notizen).
for (const col of [
  'photo TEXT',
  'color TEXT',
  'nickname TEXT',
  'handedness TEXT',
  'favorite_double TEXT',
  'birthday TEXT',
  'club TEXT',
  'notes TEXT',
]) {
  try {
    db.exec(`ALTER TABLE players ADD COLUMN ${col}`);
  } catch (e) {
    /* Spalte existiert bereits – ignorieren */
  }
}


// Migration: Match-Historie um strukturiertes Format + Checkout ergänzen.
try {
  db.exec('ALTER TABLE match_history ADD COLUMN format TEXT');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}
try {
  db.exec('ALTER TABLE match_history ADD COLUMN checkout TEXT');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: leichte Metadaten je Spiel (für die Spieleliste, ohne den vollen State zu parsen).
try {
  db.exec('ALTER TABLE games ADD COLUMN meta TEXT');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Migration: Eigentümer eines Pfeil-Satzes (z. B. Gast bringt eigene Pfeile mit).
try {
  db.exec('ALTER TABLE darts ADD COLUMN owner TEXT');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}

// Standard-Pfeil sicherstellen (Default 20 g) und allen Spielern ohne Pfeil zuweisen.
const dartCount = db.prepare('SELECT COUNT(*) AS c FROM darts').get().c;
if (dartCount === 0) {
  db.prepare("INSERT INTO darts (name, weight_grams) VALUES ('Standard', 20)").run();
}
const defaultDart = db.prepare('SELECT id FROM darts ORDER BY id LIMIT 1').get();
if (defaultDart) {
  db.prepare('UPDATE players SET dart_id = ? WHERE dart_id IS NULL').run(defaultDart.id);
}

// Eigene Trainingsübungen (Trainings-Builder): Ziel, Rundenzahl, Zielwert, Wochentag.
db.exec(`CREATE TABLE IF NOT EXISTS custom_drills (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  field      INTEGER NOT NULL,
  ring       TEXT    NOT NULL,
  rounds     INTEGER NOT NULL DEFAULT 10,
  goal       INTEGER NOT NULL DEFAULT 0,
  weekday    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_custom_drills_player ON custom_drills (player_id)');

// Gespeicherte feste Doppel/Teams (Schnellauswahl im Setup): Name, Farbe, Mitglieder.
db.exec(`CREATE TABLE IF NOT EXISTS saved_teams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  color      TEXT,
  members    TEXT    NOT NULL,
  created_at TEXT    DEFAULT (datetime('now'))
)`);

// Ligen/Saisons (Stufe 7): benannte Wettbewerbe mit Mitgliedern; die Tabelle wird
// aus der Match-Historie (Spiele mit passender league_id) berechnet.
db.exec(`CREATE TABLE IF NOT EXISTS leagues (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'active',   -- 'active' | 'finished'
  config     TEXT    NOT NULL DEFAULT '{}',        -- { mode, winPoints, ... }
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS league_members (
  league_id TEXT    NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (league_id, player_id)
)`);

// Party-Spiele (Stufe 4): eigener Spielstate, getrennt von X01-Spielen.
db.exec(`CREATE TABLE IF NOT EXISTS party_games (
  id         TEXT    PRIMARY KEY,
  state      TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'playing',
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
)`);

// Migration: Match-Historie einer Liga/Saison zuordnen.
try {
  db.exec('ALTER TABLE match_history ADD COLUMN league_id TEXT');
} catch (e) {
  /* Spalte existiert bereits – ignorieren */
}
db.exec('CREATE INDEX IF NOT EXISTS idx_match_history_league ON match_history (league_id)');

console.log(`[db] SQLite bereit: ${DB_PATH}`);

module.exports = db;
