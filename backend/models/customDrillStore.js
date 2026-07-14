'use strict';

const db = require('../db/init');

const listStmt = db.prepare('SELECT * FROM custom_drills WHERE player_id = ? ORDER BY weekday, name COLLATE NOCASE');
const getStmt = db.prepare('SELECT * FROM custom_drills WHERE id = ?');
const insertStmt = db.prepare(
  'INSERT INTO custom_drills (player_id, name, field, ring, rounds, goal, weekday) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const updateStmt = db.prepare('UPDATE custom_drills SET name = ?, field = ?, ring = ?, rounds = ?, goal = ?, weekday = ? WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM custom_drills WHERE id = ?');

const RINGS = new Set(['single', 'double', 'triple', 'bull']);

function toDrill(r) {
  if (!r) return null;
  return {
    id: r.id,
    playerId: r.player_id,
    name: r.name,
    field: r.field,
    ring: r.ring,
    rounds: r.rounds,
    goal: r.goal,
    weekday: r.weekday, // 0 = kein fester Tag, 1..7 = Mo..So
    createdAt: r.created_at,
  };
}

function sanitize(b, base = {}) {
  const src = { ...base, ...b };
  const ring = RINGS.has(src.ring) ? src.ring : 'triple';
  const field = ring === 'bull' ? 25 : Math.min(20, Math.max(1, parseInt(src.field, 10) || 20));
  const rounds = Math.min(30, Math.max(1, parseInt(src.rounds, 10) || 10));
  const goal = Math.min(rounds * 3, Math.max(0, parseInt(src.goal, 10) || 0));
  const weekday = Math.min(7, Math.max(0, parseInt(src.weekday, 10) || 0));
  const name = String(src.name || '').trim().slice(0, 40) || 'Übung';
  return { name, field, ring, rounds, goal, weekday };
}

function list(playerId) {
  return listStmt.all(Number(playerId)).map(toDrill);
}
function get(id) {
  return toDrill(getStmt.get(Number(id)));
}
function create(playerId, body) {
  const s = sanitize(body);
  const info = insertStmt.run(Number(playerId), s.name, s.field, s.ring, s.rounds, s.goal, s.weekday);
  return toDrill(getStmt.get(info.lastInsertRowid));
}
function update(id, body) {
  const cur = getStmt.get(Number(id));
  if (!cur) return null;
  const s = sanitize(body, toDrill(cur));
  updateStmt.run(s.name, s.field, s.ring, s.rounds, s.goal, s.weekday, Number(id));
  return toDrill(getStmt.get(Number(id)));
}
function remove(id) {
  return deleteStmt.run(Number(id)).changes > 0;
}

module.exports = { list, get, create, update, remove };
