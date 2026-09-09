'use strict';

// Elo-Rangliste, berechnet durch Replay der Match-Historie. Bewusst zustandslos:
// Es gibt keine gespeicherte Rating-Tabelle, sondern die Werte werden aus den
// beendeten Einzelspielen (match_history.players) chronologisch nachgerechnet.
// Vorteil: idempotent, bezieht Alt-Spiele automatisch ein, kein Migrationsrisiko.

const db = require('../db/init');
const elo = require('../utils/elo');

const RANGE_SINCE = {
  today: "datetime('now','start of day')",
  '7d': "datetime('now','-7 days')",
  '30d': "datetime('now','-30 days')",
  all: null,
};

const stmtCache = new Map();
function q(sql) {
  let st = stmtCache.get(sql);
  if (!st) {
    st = db.prepare(sql);
    stmtCache.set(sql, st);
  }
  return st;
}

// Gewertete Einzelspiele (kein Training, genau zwei Einheiten mit dbId, keine Teams)
// in chronologischer Reihenfolge.
function ratedMatches({ leagueId = null, range = 'all' } = {}) {
  const conds = ['is_training = 0'];
  if (leagueId) conds.push('league_id = @leagueId');
  const since = RANGE_SINCE[range];
  if (since) conds.push(`finished_at >= ${since}`);
  const sql = `SELECT finished_at, players FROM match_history WHERE ${conds.join(' AND ')} ORDER BY finished_at ASC, id ASC`;
  const rows = q(sql).all(leagueId ? { leagueId } : {});
  const out = [];
  for (const r of rows) {
    let players;
    try {
      players = JSON.parse(r.players || '[]');
    } catch (e) {
      continue;
    }
    if (!Array.isArray(players) || players.length !== 2) continue;
    if (players.some((p) => p.type === 'team' || p.dbId == null)) continue;
    out.push(players);
  }
  return out;
}

// Baut die Rating-Tabelle (Map dbId -> Datensatz) aus den gewerteten Matches auf.
function computeTable({ leagueId = null, range = 'all' } = {}) {
  const table = new Map();
  const rec = (p) => {
    let e = table.get(p.dbId);
    if (!e) {
      const isBot = p.type === 'bot';
      const base = isBot ? elo.botElo(p.botLevel) : elo.START_ELO;
      e = {
        dbId: p.dbId,
        name: p.name,
        type: p.type,
        botLevel: p.botLevel || null,
        elo: base,
        games: 0,
        wins: 0,
        losses: 0,
        peak: base,
        lastDelta: 0,
      };
      table.set(p.dbId, e);
    } else if (p.name) {
      e.name = p.name;
    }
    return e;
  };

  for (const [pa, pb] of ratedMatches({ leagueId, range })) {
    const aWon = !!pa.won && !pb.won;
    const bWon = !!pb.won && !pa.won;
    if (!aWon && !bWon) continue; // ohne klaren Sieger nicht werten
    const ea = rec(pa);
    const eb = rec(pb);
    const winner = aWon ? pa : pb;
    const loser = aWon ? pb : pa;
    // Margin über Sätze, falls diese entscheiden, sonst über Legs.
    const useSets = (winner.setsWon || 0) !== (loser.setsWon || 0);
    const mf = elo.marginFactor(
      useSets ? winner.setsWon : winner.legsWon,
      useSets ? loser.setsWon : loser.legsWon
    );
    const oldA = ea.elo;
    const oldB = eb.elo;
    const upd = elo.update(oldA, oldB, aWon ? 1 : 0, mf);
    if (pa.type !== 'bot') {
      ea.elo = upd.a;
      ea.lastDelta = upd.a - oldA;
    }
    if (pb.type !== 'bot') {
      eb.elo = upd.b;
      eb.lastDelta = upd.b - oldB;
    }
    ea.games += 1;
    eb.games += 1;
    if (aWon) {
      ea.wins += 1;
      eb.losses += 1;
    } else {
      eb.wins += 1;
      ea.losses += 1;
    }
    ea.peak = Math.max(ea.peak, ea.elo);
    eb.peak = Math.max(eb.peak, eb.elo);
  }
  return table;
}

function roundRec(e) {
  return {
    dbId: e.dbId,
    name: e.name,
    type: e.type,
    botLevel: e.botLevel,
    elo: Math.round(e.elo),
    games: e.games,
    wins: e.wins,
    losses: e.losses,
    peak: Math.round(e.peak),
    lastDelta: Math.round(e.lastDelta),
  };
}

// Rangliste (absteigend nach Elo). Optional gefiltert nach Zeitraum oder Liga.
function leaderboard({ range = 'all', leagueId = null, includeBots = true } = {}) {
  const table = computeTable({ leagueId, range });
  let list = [...table.values()].map(roundRec);
  if (!includeBots) list = list.filter((e) => e.type !== 'bot');
  list.sort((a, b) => b.elo - a.elo || b.wins - a.wins || a.name.localeCompare(b.name));
  return list.map((e, i) => ({ rank: i + 1, ...e }));
}

// Rating-Datensatz eines Spielers (oder Default, wenn noch keine gewerteten Spiele).
function forPlayer(dbId) {
  const id = Number(dbId);
  const table = computeTable({});
  const e = table.get(id);
  return e ? roundRec(e) : { dbId: id, name: null, type: 'human', botLevel: null, elo: elo.START_ELO, games: 0, wins: 0, losses: 0, peak: elo.START_ELO, lastDelta: 0 };
}

// Map dbId -> Elo (für Turnier-Setzung). Menschen ohne Spiele fehlen; Aufrufer
// sollte START_ELO als Default nutzen.
function ratingMap() {
  const table = computeTable({});
  const m = {};
  for (const e of table.values()) m[e.dbId] = Math.round(e.elo);
  return m;
}

module.exports = { leaderboard, forPlayer, ratingMap, computeTable, START_ELO: elo.START_ELO };
