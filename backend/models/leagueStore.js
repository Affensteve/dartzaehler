'use strict';

// Ligen/Saisons: benannte Wettbewerbe mit Mitgliedern. Die Tabelle wird aus der
// Match-Historie berechnet (Spiele mit passender league_id), analog zum Elo-Rating.

const { randomUUID } = require('crypto');
const db = require('../db/init');
const ratingStore = require('./ratingStore');

const insLeague = db.prepare('INSERT INTO leagues (id, name, status, config) VALUES (@id, @name, @status, @config)');
const insMember = db.prepare('INSERT OR IGNORE INTO league_members (league_id, player_id) VALUES (?, ?)');
const delMember = db.prepare('DELETE FROM league_members WHERE league_id = ? AND player_id = ?');
const getLeague = db.prepare('SELECT * FROM leagues WHERE id = ?');
const listLeagues = db.prepare('SELECT * FROM leagues ORDER BY created_at DESC');
const memberRows = db.prepare(
  `SELECT p.id AS dbId, p.name AS name FROM league_members lm JOIN players p ON p.id = lm.player_id WHERE lm.league_id = ? ORDER BY p.name`
);
const setStatusStmt = db.prepare('UPDATE leagues SET status = ? WHERE id = ?');
const delLeague = db.prepare('DELETE FROM leagues WHERE id = ?');
const matchRows = db.prepare(
  'SELECT players FROM match_history WHERE league_id = ? AND is_training = 0 ORDER BY finished_at ASC, id ASC'
);

function parseConfig(r) {
  let config = {};
  try {
    config = JSON.parse(r.config || '{}');
  } catch (e) {
    /* ignore */
  }
  return config;
}

function create({ name, memberIds = [], config = {} } = {}) {
  const nm = (name && String(name).trim()) || 'Liga';
  const id = randomUUID();
  const tx = db.transaction(() => {
    insLeague.run({ id, name: nm.slice(0, 60), status: 'active', config: JSON.stringify(config || {}) });
    for (const pid of memberIds) if (Number.isInteger(pid)) insMember.run(id, pid);
  });
  tx();
  return get(id);
}

function list() {
  return listLeagues.all().map((r) => {
    const members = memberRows.all(r.id);
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      config: parseConfig(r),
      createdAt: r.created_at,
      memberCount: members.length,
    };
  });
}

// Berechnet die Tabelle aus der Historie: Punkte (Sieg=winPoints, sonst 0),
// Spiele, Siege/Niederlagen, Legs für/gegen; ergänzt das Liga-Elo je Spieler.
function standings(id) {
  const league = getLeague.get(id);
  if (!league) return null;
  const config = parseConfig(league);
  const winPoints = Number.isFinite(config.winPoints) ? config.winPoints : 3;
  const members = memberRows.all(id);
  const rows = new Map();
  for (const m of members) {
    rows.set(m.dbId, {
      dbId: m.dbId,
      name: m.name,
      played: 0,
      won: 0,
      lost: 0,
      legsFor: 0,
      legsAgainst: 0,
      points: 0,
    });
  }
  for (const r of matchRows.all(id)) {
    let players;
    try {
      players = JSON.parse(r.players || '[]');
    } catch (e) {
      continue;
    }
    if (!Array.isArray(players) || players.length !== 2) continue;
    const [pa, pb] = players;
    if (pa.dbId == null || pb.dbId == null) continue;
    const ra = rows.get(pa.dbId);
    const rb = rows.get(pb.dbId);
    if (!ra || !rb) continue; // nur Spiele unter aktuellen Mitgliedern werten
    const aWon = !!pa.won && !pb.won;
    const bWon = !!pb.won && !pa.won;
    if (!aWon && !bWon) continue;
    ra.played += 1;
    rb.played += 1;
    ra.legsFor += pa.legsWon || 0;
    ra.legsAgainst += pb.legsWon || 0;
    rb.legsFor += pb.legsWon || 0;
    rb.legsAgainst += pa.legsWon || 0;
    if (aWon) {
      ra.won += 1;
      ra.points += winPoints;
      rb.lost += 1;
    } else {
      rb.won += 1;
      rb.points += winPoints;
      ra.lost += 1;
    }
  }
  // Liga-Elo ergänzen.
  const eloMap = {};
  for (const e of ratingStore.leaderboard({ leagueId: id })) eloMap[e.dbId] = e.elo;
  const table = [...rows.values()].map((r) => ({
    ...r,
    legDiff: r.legsFor - r.legsAgainst,
    elo: eloMap[r.dbId] != null ? eloMap[r.dbId] : ratingStore.START_ELO,
  }));
  table.sort(
    (a, b) => b.points - a.points || b.legDiff - a.legDiff || b.elo - a.elo || a.name.localeCompare(b.name)
  );
  return {
    id: league.id,
    name: league.name,
    status: league.status,
    config,
    createdAt: league.created_at,
    members,
    standings: table.map((r, i) => ({ pos: i + 1, ...r })),
  };
}

function get(id) {
  return standings(id);
}

function addMember(id, playerId) {
  if (!getLeague.get(id)) return null;
  if (Number.isInteger(playerId)) insMember.run(id, playerId);
  return get(id);
}

function removeMember(id, playerId) {
  delMember.run(id, playerId);
  return get(id);
}

function setStatus(id, status) {
  if (!['active', 'finished'].includes(status)) return null;
  setStatusStmt.run(status, id);
  return get(id);
}

function remove(id) {
  return delLeague.run(id).changes > 0;
}

module.exports = { create, list, get, standings, addMember, removeMember, setStatus, remove };
