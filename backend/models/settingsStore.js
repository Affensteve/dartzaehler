'use strict';

const db = require('../db/init');

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const upsertStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);
const allStmt = db.prepare('SELECT key, value FROM settings');

function get(key) {
  const row = getStmt.get(String(key));
  return row ? row.value : null;
}

function set(key, value) {
  upsertStmt.run(String(key), value == null ? null : String(value));
  return { key: String(key), value };
}

function all() {
  const out = {};
  for (const r of allStmt.all()) out[r.key] = r.value;
  return out;
}

module.exports = { get, set, all };
