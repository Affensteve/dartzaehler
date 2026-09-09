'use strict';

const db = require('../db/init');
const { PERSONALIZATION_MIN_ATTEMPTS } = require('./dartRules');

// Triple-Trefferdaten stammen aus dem Triple-Rundlauf (3 Versuche je Feld) und
// den Scoring-Drills T20/T19 (Versuche = detail.attempts).
const drillsStmt = db.prepare(
  "SELECT mode, detail FROM training_records WHERE player_id = ? AND mode IN ('triplesround','drill20','drill19')"
);

function addStat(acc, key, attempts, hits) {
  const cur = acc[key] || (acc[key] = { attempts: 0, hits: 0 });
  cur.attempts += attempts;
  cur.hits += hits;
}

function poolTriples(id) {
  const pooled = {};
  for (const row of drillsStmt.all(id)) {
    let detail = {};
    try {
      detail = JSON.parse(row.detail || '{}');
    } catch (e) {
      continue;
    }
    if (row.mode === 'triplesround') {
      // Je Feld genau 3 Versuche, Treffer aus hitsByTriple.
      for (const [n, hits] of Object.entries(detail.hitsByTriple || {})) addStat(pooled, `T${n}`, 3, Number(hits) || 0);
    } else {
      // drill20/drill19: { tripleHits: { 20: hits }, attempts: 30 }
      const att = Number(detail.attempts) || 30;
      for (const [n, hits] of Object.entries(detail.tripleHits || {})) addStat(pooled, `T${n}`, att, Number(hits) || 0);
    }
  }
  return pooled;
}

// Trefferquote (0..1) je Triple-Label, nur mit genug Versuchen.
function getPlayerTripleProfile(playerId) {
  const pooled = poolTriples(Number(playerId));
  const profile = {};
  for (const [key, { attempts, hits }] of Object.entries(pooled)) {
    if (attempts >= PERSONALIZATION_MIN_ATTEMPTS) profile[key] = hits / attempts;
  }
  return profile;
}

// Beste Triples zuerst – für Berichte/Profilkarte (niedrigere Anzeige-Schwelle).
const DISPLAY_MIN_ATTEMPTS = 3;
function getPlayerTripleStats(playerId, minAttempts = DISPLAY_MIN_ATTEMPTS) {
  const pooled = poolTriples(Number(playerId));
  return Object.entries(pooled)
    .map(([label, { attempts, hits }]) => ({ label, attempts, hits, rate: attempts ? hits / attempts : 0 }))
    .filter((d) => d.attempts >= minAttempts)
    .sort((a, b) => b.rate - a.rate);
}

module.exports = { getPlayerTripleProfile, getPlayerTripleStats };
