'use strict';

const db = require('../db/init');

const stmtCache = new Map();
function q(sql) {
  let st = stmtCache.get(sql);
  if (!st) { st = db.prepare(sql); stmtCache.set(sql, st); }
  return st;
}

// Bessere Richtung je Modus: 'high' = höher besser, 'low' = weniger besser.
const MODE_BETTER = {
  clock: 'low', // wenige Darts
  cricket: 'low', // wenige Darts
  bob27: 'high',
  countup: 'high',
  shanghai: 'high',
  halveit: 'high',
  checkout: 'high',
  checkoutdrill: 'high',
  doublesround: 'high',
  bulltrain: 'high',
  drill20: 'high',
  drill19: 'high',
  drill100: 'high',
  drill140: 'high',
};

const insertStmt = db.prepare('INSERT INTO training_records (player_id, mode, score, detail) VALUES (?, ?, ?, ?)');

function record({ playerId, mode, score, detail }) {
  if (!Number.isInteger(playerId) || !mode || !Number.isFinite(Number(score))) {
    throw new Error('Ungültiger Trainingseintrag.');
  }
  insertStmt.run(playerId, String(mode), Number(score), detail ? JSON.stringify(detail) : null);
  return { ok: true };
}

/** Bestwert je Modus für einen Spieler. */
function playerBests(playerId) {
  const rows = q('SELECT mode, score FROM training_records WHERE player_id = ?').all(Number(playerId));
  const best = {};
  for (const r of rows) {
    const dir = MODE_BETTER[r.mode] || 'high';
    if (best[r.mode] == null) best[r.mode] = r.score;
    else if (dir === 'high') best[r.mode] = Math.max(best[r.mode], r.score);
    else best[r.mode] = Math.min(best[r.mode], r.score);
  }
  return best;
}

const RANGE_SINCE = {
  today: "datetime('now','start of day')",
  '7d': "datetime('now','-7 days')",
  '30d': "datetime('now','-30 days')",
  all: null,
};

function mergeDetail(acc, d) {
  for (const [k, v] of Object.entries(d || {})) {
    if (typeof v === 'number') acc[k] = (acc[k] || 0) + v;
    else if (v && typeof v === 'object') {
      acc[k] = acc[k] || {};
      for (const [kk, vv] of Object.entries(v)) if (typeof vv === 'number') acc[k][kk] = (acc[k][kk] || 0) + vv;
    }
  }
  return acc;
}

/** Aggregierte Trainings-Statistik je Modus für einen Spieler (mit Zeitfilter). */
function playerStats(playerId, range = 'all') {
  const since = RANGE_SINCE[range];
  const where = since ? `AND created_at >= ${since}` : '';
  const rows = q(`SELECT mode, score, detail FROM training_records WHERE player_id = ? ${where}`).all(Number(playerId));
  const byMode = {};
  for (const r of rows) {
    const m = byMode[r.mode] || (byMode[r.mode] = { mode: r.mode, sessions: 0, sumScore: 0, best: null, detail: {} });
    m.sessions += 1;
    m.sumScore += r.score;
    const dir = MODE_BETTER[r.mode] || 'high';
    m.best = m.best == null ? r.score : dir === 'high' ? Math.max(m.best, r.score) : Math.min(m.best, r.score);
    let d = {};
    try {
      d = JSON.parse(r.detail || '{}');
    } catch (e) {
      /* ignore */
    }
    mergeDetail(m.detail, d);
  }
  for (const k of Object.keys(byMode)) {
    byMode[k].avgScore = Math.round((byMode[k].sumScore / byMode[k].sessions) * 10) / 10;
    delete byMode[k].sumScore;
  }
  return byMode;
}


function trainDayStreak(playerId) {
  const rows = q('SELECT DISTINCT date(created_at) AS d FROM training_records WHERE player_id = ? ORDER BY d DESC').all(Number(playerId));
  const dates = rows.map((r) => r.d);
  if (!dates.length) return 0;
  const set = new Set(dates);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let cur;
  if (set.has(fmt(new Date()))) cur = new Date();
  else {
    const [y, m, dd] = dates[0].split('-').map(Number);
    cur = new Date(y, m - 1, dd);
  }
  let streak = 0;
  while (set.has(fmt(cur))) {
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

module.exports = { record, playerBests, playerStats, trainDayStreak, MODE_BETTER };
