'use strict';

const db = require('../db/init');

const listStmt = db.prepare('SELECT * FROM saved_teams ORDER BY name COLLATE NOCASE');
const getStmt = db.prepare('SELECT * FROM saved_teams WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO saved_teams (name, color, members) VALUES (?, ?, ?)');
const deleteStmt = db.prepare('DELETE FROM saved_teams WHERE id = ?');

function toTeam(r) {
  if (!r) return null;
  let members = [];
  try {
    members = JSON.parse(r.members || '[]');
  } catch (e) {
    /* ignore */
  }
  return { id: r.id, name: r.name, color: r.color || null, members, createdAt: r.created_at };
}

function list() {
  return listStmt.all().map(toTeam);
}
function create({ name, color, members }) {
  const nm = String(name || '').trim().slice(0, 40) || 'Team';
  const col = color ? String(color).slice(0, 20) : null;
  const mem = (Array.isArray(members) ? members : [])
    .filter((m) => m && m.name)
    .map((m) => ({ id: Number.isInteger(m.id) ? m.id : null, name: String(m.name).slice(0, 40) }));
  const info = insertStmt.run(nm, col, JSON.stringify(mem));
  return toTeam(getStmt.get(info.lastInsertRowid));
}
function remove(id) {
  return deleteStmt.run(Number(id)).changes > 0;
}

module.exports = { list, create, remove };
