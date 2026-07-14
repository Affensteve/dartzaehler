'use strict';

const db = require('../db/init');

const insertStmt = db.prepare(
  'INSERT INTO players (name, type, bot_level, checkout_mode, dart_id, personalize_checkout, voice) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const listStmt = db.prepare('SELECT * FROM players ORDER BY name COLLATE NOCASE');
const getStmt = db.prepare('SELECT * FROM players WHERE id = ?');
const setCheckoutStmt = db.prepare('UPDATE players SET checkout_mode = ? WHERE id = ?');
const setDartStmt = db.prepare('UPDATE players SET dart_id = ? WHERE id = ?');
const setPersonalizeStmt = db.prepare('UPDATE players SET personalize_checkout = ? WHERE id = ?');
const setVoiceStmt = db.prepare('UPDATE players SET voice = ? WHERE id = ?');
const renameStmt = db.prepare('UPDATE players SET name = ? WHERE id = ?');
const findBotStmt = db.prepare(
  "SELECT * FROM players WHERE type='bot' AND name=? AND IFNULL(bot_level,'')=IFNULL(?, '') LIMIT 1"
);

function defaultDartId() {
  const row = db.prepare('SELECT id FROM darts ORDER BY id LIMIT 1').get();
  return row ? row.id : null;
}

function rowToPlayer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    botLevel: row.bot_level || null,
    checkoutMode: row.checkout_mode || 'double',
    dartId: row.dart_id != null ? row.dart_id : null,
    personalizeCheckout: !!row.personalize_checkout,
    voice: row.voice || null,
    photo: row.photo || null,
    color: row.color || null,
    nickname: row.nickname || null,
    handedness: row.handedness || null,
    favoriteDouble: row.favorite_double || null,
    birthday: row.birthday || null,
    club: row.club || null,
    notes: row.notes || null,
    createdAt: row.created_at,
  };
}

function create({ name, type = 'human', botLevel = null, checkoutMode = 'double', dartId = null, personalizeCheckout = false, voice = null }) {
  const mode = ['single', 'master'].includes(checkoutMode) ? checkoutMode : 'double';
  const dart = Number.isInteger(dartId) ? dartId : defaultDartId();
  const v = VOICES.includes(voice) ? voice : null;
  const info = insertStmt.run(name, type, type === 'bot' ? botLevel : null, mode, dart, personalizeCheckout ? 1 : 0, v);
  return rowToPlayer(getStmt.get(info.lastInsertRowid));
}

function rename(id, name) {
  renameStmt.run(String(name).trim().slice(0, 40), id);
  return rowToPlayer(getStmt.get(id));
}

function setCheckoutMode(id, checkoutMode) {
  const mode = ['single', 'master'].includes(checkoutMode) ? checkoutMode : 'double';
  setCheckoutStmt.run(mode, id);
}

function setDart(id, dartId) {
  if (Number.isInteger(dartId)) setDartStmt.run(dartId, id);
}

function setPersonalizeCheckout(id, enabled) {
  setPersonalizeStmt.run(enabled ? 1 : 0, id);
}

const VOICES = ['de-female', 'de-male', 'en-female', 'en-male'];
function setVoice(id, voice) {
  setVoiceStmt.run(VOICES.includes(voice) ? voice : null, id);
}

function ensureBot(name, botLevel) {
  const row = findBotStmt.get(name, botLevel || null);
  if (row) return rowToPlayer(row);
  return create({ name, type: 'bot', botLevel: botLevel || 'medium' });
}

function displayName(id, fallback) {
  const p = getStmt.get(id);
  return p ? p.name : fallback;
}

// Erlaubte Lieblingsdoppel-Labels (müssen zu dartRules.DOUBLE_FINISHERS passen).
const FAVORITE_DOUBLES = new Set([...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'Bull']);
const HANDEDNESS = new Set(['right', 'left']);

// Aktualisiert nur die übergebenen Profilfelder (partielles Update).
function setProfile(id, patch = {}) {
  const map = {
    photo: 'photo',
    color: 'color',
    nickname: 'nickname',
    handedness: 'handedness',
    favoriteDouble: 'favorite_double',
    birthday: 'birthday',
    club: 'club',
    notes: 'notes',
  };
  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(map)) {
    if (!(key in patch)) continue;
    let v = patch[key];
    if (v === '' ) v = null;
    if (key === 'favoriteDouble' && v != null && !FAVORITE_DOUBLES.has(v)) continue;
    if (key === 'handedness' && v != null && !HANDEDNESS.has(v)) continue;
    if (key === 'nickname' && v != null) v = String(v).slice(0, 40);
    if (key === 'club' && v != null) v = String(v).slice(0, 60);
    if (key === 'notes' && v != null) v = String(v).slice(0, 1000);
    if (key === 'color' && v != null) v = String(v).slice(0, 20);
    if (key === 'photo' && v != null) v = String(v); // Data-URI (client-seitig verkleinert)
    sets.push(`${col} = ?`);
    vals.push(v);
  }
  if (!sets.length) return get(id);
  vals.push(id);
  db.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return get(id);
}

function list() {
  return listStmt.all().map(rowToPlayer);
}

function get(id) {
  return rowToPlayer(getStmt.get(id));
}

module.exports = { create, list, get, setCheckoutMode, setDart, setPersonalizeCheckout, setVoice, setProfile, rename, displayName, ensureBot, FAVORITE_DOUBLES };
