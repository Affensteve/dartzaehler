'use strict';

const db = require('../db/init');

const upsertStmt = db.prepare(`
  INSERT INTO tournaments (id, state, status, updated_at)
  VALUES (@id, @state, @status, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    state = excluded.state,
    status = excluded.status,
    updated_at = datetime('now')
`);
const getStmt = db.prepare('SELECT * FROM tournaments WHERE id = ?');
const listStmt = db.prepare(
  'SELECT id, status, created_at, updated_at FROM tournaments ORDER BY updated_at DESC LIMIT 100'
);
const deleteStmt = db.prepare('DELETE FROM tournaments WHERE id = ?');

function save(t) {
  upsertStmt.run({ id: t.id, state: JSON.stringify(t), status: t.status });
  return t;
}

function get(id) {
  const row = getStmt.get(id);
  return row ? JSON.parse(row.state) : null;
}

function list() {
  return listStmt.all().map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function remove(id) {
  return deleteStmt.run(id).changes > 0;
}

module.exports = { save, get, list, remove };
