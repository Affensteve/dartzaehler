'use strict';

const db = require('../db/init');

const upsert = db.prepare(`
  INSERT INTO party_games (id, state, status, updated_at)
  VALUES (@id, @state, @status, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET state = excluded.state, status = excluded.status, updated_at = datetime('now')
`);
const getStmt = db.prepare('SELECT state FROM party_games WHERE id = ?');
const listStmt = db.prepare("SELECT id, status, created_at, updated_at FROM party_games WHERE status = 'playing' ORDER BY updated_at DESC LIMIT 50");
const delStmt = db.prepare('DELETE FROM party_games WHERE id = ?');

// Undo-Historie nur im Speicher halten (nicht pro Wurf serialisieren).
const undoCache = new Map();

function save(game) {
  undoCache.set(game.id, game.undoStack || []);
  const persist = { ...game, undoStack: [] };
  upsert.run({ id: game.id, state: JSON.stringify(persist), status: game.status });
  return game;
}

function get(id) {
  const row = getStmt.get(id);
  if (!row) return null;
  const game = JSON.parse(row.state);
  game.undoStack = undoCache.get(id) || [];
  return game;
}

function list() {
  return listStmt.all().map((r) => ({ id: r.id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at }));
}

function remove(id) {
  undoCache.delete(id);
  return delStmt.run(id).changes > 0;
}

const allStates = db.prepare('SELECT state FROM party_games');
// Anzahl der Party-Spiele, an denen ein Spieler (dbId) teilgenommen hat.
function countForPlayer(dbId) {
  if (!Number.isInteger(dbId)) return 0;
  let n = 0;
  for (const r of allStates.all()) {
    try {
      const g = JSON.parse(r.state);
      if (Array.isArray(g.players) && g.players.some((p) => p.dbId === dbId)) n += 1;
    } catch (e) {
      /* ignore */
    }
  }
  return n;
}

module.exports = { save, get, list, remove, countForPlayer };
