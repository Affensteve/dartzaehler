'use strict';

const db = require('../db/init');
const { PERSONALIZATION_MIN_ATTEMPTS } = require('./dartRules');

const gameStatsStmt = db.prepare('SELECT double_stats AS doubleStats FROM game_stats WHERE player_id = ?');
const doublesStmt = db.prepare("SELECT detail FROM training_records WHERE player_id = ? AND mode IN ('bob27','doublesround','bulltrain')");

function addStat(acc, key, attempts, hits) {
  const cur = acc[key] || (acc[key] = { attempts: 0, hits: 0 });
  cur.attempts += attempts;
  cur.hits += hits;
}

/**
 * Trefferquote je Ziel-Doppel für einen Spieler, gepoolt aus echten Spielen
 * (`game_stats.double_stats`) und Bob's-27-Training (`training_records.detail.hitsByDouble`,
 * 3 Darts je erreichtem Feld). Nur Doppel mit genug Versuchen (PERSONALIZATION_MIN_ATTEMPTS)
 * werden zurückgegeben.
 * @returns {Object<string, number>} z. B. { D16: 0.42, Bull: 0.1 }
 */
function poolDoubles(id) {
  const pooled = {};
  for (const row of gameStatsStmt.all(id)) {
    let stats = {};
    try {
      stats = JSON.parse(row.doubleStats || '{}');
    } catch (e) {
      continue;
    }
    for (const [key, v] of Object.entries(stats)) {
      addStat(pooled, key, v.attempts || 0, v.hits || 0);
    }
  }
  for (const row of doublesStmt.all(id)) {
    let detail = {};
    try {
      detail = JSON.parse(row.detail || '{}');
    } catch (e) {
      continue;
    }
    // Bob's 27 / Doppel-Rundlauf: je Feld 3 Versuche, Treffer aus hitsByDouble.
    for (const [field, hits] of Object.entries(detail.hitsByDouble || {})) {
      const key = field === 'Bull' ? 'Bull' : `D${field}`;
      addStat(pooled, key, 3, Number(hits) || 0);
    }
    // Bull-Training: eigene Versuch-/Treffer-Zählung.
    if (detail.bull && detail.bull.attempts) {
      addStat(pooled, 'Bull', Number(detail.bull.attempts) || 0, Number(detail.bull.hits) || 0);
    }
  }
  return pooled;
}

function getPlayerDoubleProfile(playerId) {
  const pooled = poolDoubles(Number(playerId));
  const profile = {};
  for (const [key, { attempts, hits }] of Object.entries(pooled)) {
    if (attempts >= PERSONALIZATION_MIN_ATTEMPTS) profile[key] = hits / attempts;
  }
  return profile;
}

// Doppel-Trefferquoten je Feld (nur mit genug Versuchen), beste zuerst –
// für die Profilkarte (Lieblings-/Angst-Doppel).
function getPlayerDoubleStats(playerId) {
  const pooled = poolDoubles(Number(playerId));
  return Object.entries(pooled)
    .map(([label, { attempts, hits }]) => ({ label, attempts, hits, rate: attempts ? hits / attempts : 0 }))
    .filter((d) => d.attempts >= PERSONALIZATION_MIN_ATTEMPTS)
    .sort((a, b) => b.rate - a.rate);
}

module.exports = { getPlayerDoubleProfile, getPlayerDoubleStats };
