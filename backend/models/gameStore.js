'use strict';

const db = require('../db/init');
const playerStore = require('./playerStore');

const upsertStmt = db.prepare(`
  INSERT INTO games (id, state, status, tournament_id, meta, updated_at)
  VALUES (@id, @state, @status, @tournamentId, @meta, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    state = excluded.state,
    status = excluded.status,
    meta = excluded.meta,
    updated_at = datetime('now')
`);
const getStmt = db.prepare('SELECT * FROM games WHERE id = ?');
const listStmt = db.prepare(
  'SELECT id, meta, status, tournament_id, created_at, updated_at FROM games ORDER BY updated_at DESC LIMIT 100'
);
const backfillSelect = db.prepare('SELECT id, state FROM games WHERE meta IS NULL');
const backfillUpdate = db.prepare('UPDATE games SET meta = ? WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM games WHERE id = ?');

// Undo-Historie bleibt nur im Arbeitsspeicher (gameId -> Array<snapshot-JSON>).
// Sie wird NICHT in SQLite persistiert: sonst würde bei jedem Wurf die komplette
// Historie serialisiert/geschrieben – auf dem Pi der Performance-Killer.
const undoCache = new Map();

// Ergänzt Felder, die in älteren gespeicherten Spielen fehlen könnten,
// damit Spiele aus früheren Versionen weiter korrekt funktionieren.
function normalize(game) {
  if (!game) return game;
  if (game.roundNumber == null) game.roundNumber = 1;
  if (game.turnsThisLeg == null) game.turnsThisLeg = 0;
  if (game.awaitingBullOff == null) game.awaitingBullOff = false;
  if (game.maxRounds == null) game.maxRounds = 20;
  if (!('messagePlayer' in game)) game.messagePlayer = null;
  if (game.statsRecorded == null) game.statsRecorded = false;
  if (game.inputMode == null) game.inputMode = 'numpad';
  if (game.training == null) game.training = false;
  if (!Array.isArray(game.visitLog)) game.visitLog = [];
  if (game.visitSeq == null) game.visitSeq = game.visitLog.length;
  if (!game.matchPoint || typeof game.matchPoint !== 'object') game.matchPoint = {};
  if (game.messageSeq == null) game.messageSeq = 0;
  if (!game.achievementsEarned || typeof game.achievementsEarned !== 'object') game.achievementsEarned = {};
  if (Array.isArray(game.players)) {
    for (const p of game.players) {
      if (p.legsWonTotal == null) p.legsWonTotal = p.legsWon || 0;
      if (p.legDarts == null) p.legDarts = 0;
      if (p.legPoints == null) p.legPoints = 0;
      if (p.lastVisitScore == null) p.lastVisitScore = 0;
      if (p.dartId === undefined) p.dartId = null;
      if (p.dbId === undefined) p.dbId = Number.isInteger(p.id) ? p.id : null;
    }
  }
  return game;
}

// Leichte Zusammenfassung für die Spieleliste – Namen werden erst beim Lesen
// frisch aufgelöst, hier nur dbId + Fallback-Name gespeichert.
function buildMeta(game) {
  const pls = Array.isArray(game.players) ? game.players : [];
  const modeSet = new Set(pls.map((p) => p.checkoutMode || 'double'));
  return {
    mode: game.mode ?? null,
    label: game.checkoutLabel || null,
    format: game.format
      ? { satzLegMode: game.format.satzLegMode, sets: game.format.sets, legs: game.format.legs }
      : null,
    checkout: modeSet.size > 1 ? 'mixed' : [...modeSet][0] || 'double',
    players: pls.map((p) => ({ dbId: Number.isInteger(p.dbId) ? p.dbId : null, name: p.name })),
  };
}

// Einmaliger Backfill für Spiele aus älteren Versionen (ohne meta-Spalte).
(function backfillMeta() {
  try {
    for (const r of backfillSelect.all()) {
      try {
        backfillUpdate.run(JSON.stringify(buildMeta(JSON.parse(r.state))), r.id);
      } catch (e) {
        /* defektes state überspringen */
      }
    }
  } catch (e) {
    /* meta-Spalte evtl. noch nicht vorhanden – ignorieren */
  }
})();

function save(game) {
  // Undo-Stack im Speicher-Cache halten und aus dem persistierten Zustand auslassen.
  undoCache.set(game.id, game.undoStack || []);
  const persist = { ...game, undoStack: [] };
  upsertStmt.run({
    id: game.id,
    state: JSON.stringify(persist),
    status: game.status,
    tournamentId: game.tournamentId || null,
    meta: JSON.stringify(buildMeta(game)),
  });
  return game;
}

function get(id) {
  const row = getStmt.get(id);
  if (!row) return null;
  const game = normalize(JSON.parse(row.state));
  // Undo-Historie aus dem Speicher-Cache anhängen (überlebt einen Neustart nicht – bewusst).
  game.undoStack = undoCache.get(id) || [];
  return game;
}

function list() {
  return listStmt.all().map((r) => {
    let players = [];
    let label = null;
    let mode = null;
    let format = null;
    let checkout = 'double';
    try {
      const m = JSON.parse(r.meta || '{}');
      mode = m.mode ?? null;
      label = m.label || null;
      format = m.format || null;
      checkout = m.checkout || 'double';
      players = (m.players || []).map((p) =>
        Number.isInteger(p.dbId) ? playerStore.displayName(p.dbId, p.name) : p.name
      );
    } catch (e) {
      /* defekte meta ignorieren */
    }
    return {
      id: r.id,
      status: r.status,
      tournamentId: r.tournament_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      players,
      label,
      mode,
      format,
      checkout,
    };
  });
}

function remove(id) {
  undoCache.delete(id);
  return deleteStmt.run(id).changes > 0;
}

module.exports = { save, get, list, remove };
