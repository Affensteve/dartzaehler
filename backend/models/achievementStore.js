'use strict';

const db = require('../db/init');

const awardStmt = db.prepare('INSERT OR IGNORE INTO player_achievements (player_id, achievement_id) VALUES (?, ?)');
const earnedStmt = db.prepare('SELECT achievement_id FROM player_achievements WHERE player_id = ?');
const allStmt = db.prepare(
  `SELECT pa.achievement_id AS id, pa.player_id AS playerId, p.name AS name, p.type AS type, pa.earned_at AS earnedAt
   FROM player_achievements pa JOIN players p ON p.id = pa.player_id
   ORDER BY pa.earned_at`
);

function award(playerId, achievementId) {
  return awardStmt.run(playerId, achievementId).changes > 0;
}
function earnedIds(playerId) {
  return new Set(earnedStmt.all(Number(playerId)).map((r) => r.achievement_id));
}
// Erspielte Abzeichen eines Spielers mit Zeitstempel, neueste zuerst.
const earnedForPlayerStmt = db.prepare(
  'SELECT achievement_id AS id, earned_at AS earnedAt FROM player_achievements WHERE player_id = ? ORDER BY earned_at DESC'
);
function earnedForPlayer(playerId) {
  return earnedForPlayerStmt.all(Number(playerId));
}
// Map achievement_id -> [{ playerId, name, type, earnedAt }]
function earners() {
  const m = {};
  for (const r of allStmt.all()) {
    (m[r.id] = m[r.id] || []).push({ playerId: r.playerId, name: r.name, type: r.type, earnedAt: r.earnedAt });
  }
  return m;
}

module.exports = { award, earnedIds, earners, earnedForPlayer };
