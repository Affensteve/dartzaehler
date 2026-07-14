'use strict';

const db = require('../db/init');

const insertStmt = db.prepare('INSERT INTO darts (name, weight_grams) VALUES (?, ?)');
const listStmt = db.prepare('SELECT * FROM darts ORDER BY weight_grams, name COLLATE NOCASE');
const getStmt = db.prepare('SELECT * FROM darts WHERE id = ?');
const updateStmt = db.prepare('UPDATE darts SET name = ?, weight_grams = ? WHERE id = ?');
const deleteStmt = db.prepare('DELETE FROM darts WHERE id = ?');
const countStmt = db.prepare('SELECT COUNT(*) AS c FROM darts');

function rowToDart(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, weightGrams: row.weight_grams, createdAt: row.created_at };
}

function clampWeight(g) {
  const n = Math.round(Number(g));
  if (!Number.isFinite(n)) return 20;
  return Math.min(Math.max(n, 5), 60); // sinnvolle Grenzen in Gramm
}

function create({ name, weightGrams = 20 }) {
  const info = insertStmt.run(String(name).trim().slice(0, 40), clampWeight(weightGrams));
  return rowToDart(getStmt.get(info.lastInsertRowid));
}

function update(id, { name, weightGrams }) {
  const cur = getStmt.get(id);
  if (!cur) return null;
  const newName = name != null ? String(name).trim().slice(0, 40) : cur.name;
  const newW = weightGrams != null ? clampWeight(weightGrams) : cur.weight_grams;
  updateStmt.run(newName, newW, id);
  return rowToDart(getStmt.get(id));
}

/** Löscht einen Pfeil; betroffene Spieler werden auf einen verbleibenden Pfeil umgezogen. */
function remove(id) {
  if (countStmt.get().c <= 1) throw new Error('Mindestens ein Pfeil muss bestehen bleiben.');
  const fallback = db.prepare('SELECT id FROM darts WHERE id != ? ORDER BY id LIMIT 1').get(id);
  if (fallback) db.prepare('UPDATE players SET dart_id = ? WHERE dart_id = ?').run(fallback.id, id);
  return deleteStmt.run(id).changes > 0;
}

function list() {
  return listStmt.all().map(rowToDart);
}

function get(id) {
  return rowToDart(getStmt.get(id));
}

function defaultId() {
  const row = db.prepare('SELECT id FROM darts ORDER BY id LIMIT 1').get();
  return row ? row.id : null;
}

module.exports = { create, update, remove, list, get, defaultId };
