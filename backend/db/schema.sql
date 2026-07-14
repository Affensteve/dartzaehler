-- DartZähler – SQLite Schema

-- App-Einstellungen (key/value), z. B. zuletzt gewählter Trainings-Spieler.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Pfeile (Darts): Name + Gewicht in Gramm.
CREATE TABLE IF NOT EXISTS darts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  weight_grams  INTEGER NOT NULL DEFAULT 20,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL DEFAULT 'human',   -- 'human' | 'bot'
  bot_level     TEXT,                               -- 'easy' | 'medium' | 'hard' (nur bei bots)
  checkout_mode TEXT    NOT NULL DEFAULT 'double',  -- zuletzt genutzter Checkout-Modus
  dart_id       INTEGER,                            -- zugewiesener Pfeil (darts.id)
  personalize_checkout INTEGER NOT NULL DEFAULT 0,  -- Checkout-Vorschlag an eigene Doppelquote anpassen
  voice         TEXT,                               -- bevorzugte Sprachausgabe, z. B. "de-female" | "en-male"
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Trainings-Rekorde (Bestwerte je Spieler und Trainingsmodus).
CREATE TABLE IF NOT EXISTS training_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  mode        TEXT    NOT NULL,
  score       REAL    NOT NULL,
  detail      TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_training_player_mode ON training_records (player_id, mode);

CREATE TABLE IF NOT EXISTS games (
  id            TEXT    PRIMARY KEY,
  state         TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'playing',
  tournament_id TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournaments (
  id          TEXT    PRIMARY KEY,
  state       TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'active',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Aggregierte Statistik pro (gespeichertem) Spieler.
CREATE TABLE IF NOT EXISTS player_stats (
  player_id     INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  games         INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  legs_won      INTEGER NOT NULL DEFAULT 0,
  sets_won      INTEGER NOT NULL DEFAULT 0,
  total_points  INTEGER NOT NULL DEFAULT 0,
  total_darts   INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_games_tournament ON games (tournament_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games (status);

-- Detail-Statistik pro Spiel und Spieler (mit Zeitstempel für Zeitfilter).
CREATE TABLE IF NOT EXISTS game_stats (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id         TEXT    NOT NULL,
  player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  finished_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  is_training     INTEGER NOT NULL DEFAULT 0,          -- 0 = Spiel/Turnier, 1 = Training
  dart_id         INTEGER,                             -- verwendeter Pfeil (darts.id)
  mode            INTEGER,                             -- Spielmodus 501/301/101 (für modus-bezogene Kennzahlen)
  won             INTEGER NOT NULL DEFAULT 0,
  legs_won        INTEGER NOT NULL DEFAULT 0,
  legs_lost       INTEGER NOT NULL DEFAULT 0,
  darts           INTEGER NOT NULL DEFAULT 0,
  points          INTEGER NOT NULL DEFAULT 0,
  doubles         INTEGER NOT NULL DEFAULT 0,
  triples         INTEGER NOT NULL DEFAULT 0,
  double_attempts INTEGER NOT NULL DEFAULT 0,
  checkouts       INTEGER NOT NULL DEFAULT 0,
  max_checkout    INTEGER NOT NULL DEFAULT 0,
  min_darts_leg   INTEGER,
  first9_points   INTEGER NOT NULL DEFAULT 0,
  first9_darts    INTEGER NOT NULL DEFAULT 0,
  max_turn        INTEGER NOT NULL DEFAULT 0,
  s60             INTEGER NOT NULL DEFAULT 0,
  s100            INTEGER NOT NULL DEFAULT 0,
  s140            INTEGER NOT NULL DEFAULT 0,
  s180            INTEGER NOT NULL DEFAULT 0,
  sectors         TEXT    NOT NULL DEFAULT '{}',
  double_stats    TEXT    NOT NULL DEFAULT '{}'      -- Versuche/Treffer je Ziel-Doppel, z. B. {"D16":{"attempts":5,"hits":2}}
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_stats_game_player ON game_stats (game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_player ON game_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_game_stats_finished ON game_stats (finished_at);

-- Match-Historie: abgeschlossene Spiele als Kopf + Aufnahme-für-Aufnahme-Verlauf.
CREATE TABLE IF NOT EXISTS match_history (
  id            TEXT    PRIMARY KEY,                    -- Spiel-ID
  finished_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  is_training   INTEGER NOT NULL DEFAULT 0,
  tournament_id TEXT,
  mode          INTEGER NOT NULL DEFAULT 501,
  format_label  TEXT,
  input_mode    TEXT    NOT NULL DEFAULT 'numpad',
  winner_name   TEXT,
  players       TEXT    NOT NULL DEFAULT '[]',          -- [{dbId,name,type,botLevel,legsWon,setsWon,average,won}]
  format        TEXT,                                   -- { satzLegMode, sets, legs }
  checkout      TEXT                                    -- 'double' | 'single' | 'mixed'
);
CREATE INDEX IF NOT EXISTS idx_match_history_finished ON match_history (finished_at);
CREATE INDEX IF NOT EXISTS idx_match_history_training ON match_history (is_training);

CREATE TABLE IF NOT EXISTS match_visits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     TEXT    NOT NULL REFERENCES match_history(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,
  player_id    INTEGER,                                 -- dbId (kann NULL sein)
  player_name  TEXT,
  set_no       INTEGER NOT NULL DEFAULT 1,
  leg_no       INTEGER NOT NULL DEFAULT 1,
  round_no     INTEGER NOT NULL DEFAULT 1,
  darts        TEXT    NOT NULL DEFAULT '[]',           -- [{segment,multiplier,label}]
  score        INTEGER NOT NULL DEFAULT 0,              -- Punkte dieser Aufnahme
  remaining    INTEGER NOT NULL DEFAULT 0,              -- Restscore nach der Aufnahme
  kind         TEXT    NOT NULL DEFAULT 'visit'         -- 'visit' | 'bust' | 'checkout' | 'bulloff'
);
CREATE INDEX IF NOT EXISTS idx_match_visits_match ON match_visits (match_id, seq);

-- Erreichte Achievements je Spieler.
CREATE TABLE IF NOT EXISTS player_achievements (
  player_id      INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT    NOT NULL,
  earned_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_player_achievements_ach ON player_achievements (achievement_id);
