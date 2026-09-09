'use strict';

const db = require('../db/init');

// Prepared-Statement-Cache (dynamische WHERE-Klauseln sonst je Aufruf neu kompiliert).
const stmtCache = new Map();
function q(sql) {
  let st = stmtCache.get(sql);
  if (!st) { st = db.prepare(sql); stmtCache.set(sql, st); }
  return st;
}

const insertHead = db.prepare(`
  INSERT INTO match_history (id, is_training, tournament_id, league_id, mode, format_label, input_mode, winner_name, players, format, checkout)
  VALUES (@id, @isTraining, @tournamentId, @leagueId, @mode, @formatLabel, @inputMode, @winnerName, @players, @format, @checkout)
`);
const insertVisit = db.prepare(`
  INSERT INTO match_visits (match_id, seq, player_id, player_name, set_no, leg_no, round_no, darts, score, remaining, kind)
  VALUES (@matchId, @seq, @playerId, @playerName, @setNo, @legNo, @roundNo, @darts, @score, @remaining, @kind)
`);
const deleteHead = db.prepare('DELETE FROM match_history WHERE id = ?');

const avg3 = (pts, darts) => (darts ? Math.round((pts / darts) * 3 * 100) / 100 : 0);

/** Schreibt ein beendetes Spiel als Kopf + Aufnahme-Verlauf in die Historie (idempotent). */
const recordMatch = db.transaction((game) => {
  if (game.status !== 'finished') return;
  deleteHead.run(game.id); // vorhandene Historie (Cascade löscht Visits) ersetzen

  const players = game.players.map((p) => ({
    dbId: p.dbId ?? null,
    name: p.name,
    type: p.type,
    botLevel: p.botLevel || null,
    legsWon: p.legsWonTotal || 0,
    setsWon: p.setsWon || 0,
    average: avg3(p.pointsScored || 0, p.dartsThrown || 0),
    won: game.winnerId === p.id,
  }));
  const winner = players.find((p) => p.won);
  const fmt = game.format ? { satzLegMode: game.format.satzLegMode, sets: game.format.sets, legs: game.format.legs } : null;
  const anySingle = game.players.some((p) => p.checkoutMode === 'single');
  const anyDouble = game.players.some((p) => p.checkoutMode !== 'single');
  const checkout = anySingle && anyDouble ? 'mixed' : anySingle ? 'single' : 'double';

  insertHead.run({
    id: game.id,
    isTraining: game.training ? 1 : 0,
    tournamentId: game.tournamentId || null,
    leagueId: game.leagueId || null,
    mode: game.mode || 501,
    formatLabel: game.format ? game.format.label : null,
    inputMode: game.inputMode || 'numpad',
    winnerName: winner ? winner.name : null,
    players: JSON.stringify(players),
    format: fmt ? JSON.stringify(fmt) : null,
    checkout,
  });

  const log = Array.isArray(game.visitLog) ? game.visitLog : [];
  for (const v of log) {
    insertVisit.run({
      matchId: game.id,
      seq: v.seq,
      playerId: Number.isInteger(v.playerId) ? v.playerId : null,
      playerName: v.name || null,
      setNo: v.setNo || 1,
      legNo: v.legNo || 1,
      roundNo: v.roundNo || 1,
      darts: JSON.stringify(v.darts || []),
      score: v.score || 0,
      remaining: v.remaining || 0,
      kind: v.kind || 'visit',
    });
  }
});

const RANGE_SINCE = {
  today: "datetime('now','start of day')",
  '7d': "datetime('now','-7 days')",
  '30d': "datetime('now','-30 days')",
  all: null,
};

function parseHead(r) {
  let players = [];
  try {
    players = JSON.parse(r.players || '[]');
  } catch (e) {
    /* ignore */
  }
  let format = null;
  try {
    format = r.format ? JSON.parse(r.format) : null;
  } catch (e) {
    /* ignore */
  }
  return {
    id: r.id,
    finishedAt: r.finished_at,
    isTraining: !!r.is_training,
    tournamentId: r.tournament_id,
    mode: r.mode,
    formatLabel: r.format_label,
    format,
    checkout: r.checkout || null,
    inputMode: r.input_mode,
    winnerName: r.winner_name,
    players,
  };
}

/** Liste abgeschlossener Spiele (Kopf-Daten) mit Filtern. */
function list({ range = 'all', training = null, playerId = null, limit = 200 } = {}) {
  const conds = [];
  const params = {};
  const since = RANGE_SINCE[range];
  if (since) conds.push(`finished_at >= ${since}`);
  if (training != null) {
    conds.push('is_training = @training');
    params.training = training ? 1 : 0;
  }
  let rows;
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  rows = q(`SELECT * FROM match_history ${where} ORDER BY finished_at DESC LIMIT @limit`).all({ ...params, limit });
  let out = rows.map(parseHead);
  if (playerId != null) {
    const pid = Number(playerId);
    out = out.filter((m) => m.players.some((p) => p.dbId === pid));
  }
  return out;
}

/** Ein Spiel mit vollem Aufnahme-Verlauf. */
function get(id) {
  const head = q('SELECT * FROM match_history WHERE id = ?').get(id);
  if (!head) return null;
  const visits = q('SELECT * FROM match_visits WHERE match_id = ? ORDER BY seq')
    .all(id)
    .map((v) => {
      let darts = [];
      try {
        darts = JSON.parse(v.darts || '[]');
      } catch (e) {
        /* ignore */
      }
      return {
        seq: v.seq,
        playerId: v.player_id,
        name: v.player_name,
        setNo: v.set_no,
        legNo: v.leg_no,
        roundNo: v.round_no,
        darts,
        score: v.score,
        remaining: v.remaining,
        kind: v.kind,
      };
    });
  return { ...parseHead(head), visits };
}

function remove(id) {
  return deleteHead.run(id).changes > 0;
}

// Direkter Vergleich (Head-to-Head) zweier Spieler aus der Match-Historie.
function headToHead(aId, bId) {
  const a = Number(aId);
  const b = Number(bId);
  const rows = q('SELECT players FROM match_history WHERE is_training = 0').all();
  const acc = (id) => ({ id, wins: 0, legs: 0, avgSum: 0, avgN: 0 });
  const ra = acc(a);
  const rb = acc(b);
  let matches = 0;
  for (const r of rows) {
    let pl = [];
    try {
      pl = JSON.parse(r.players || '[]');
    } catch (e) {
      continue;
    }
    const pa = pl.find((x) => x.dbId === a);
    const pb = pl.find((x) => x.dbId === b);
    if (!pa || !pb) continue;
    matches += 1;
    if (pa.won) ra.wins += 1;
    if (pb.won) rb.wins += 1;
    ra.legs += pa.legsWon || 0;
    rb.legs += pb.legsWon || 0;
    if (pa.average) { ra.avgSum += pa.average; ra.avgN += 1; }
    if (pb.average) { rb.avgSum += pb.average; rb.avgN += 1; }
  }
  const out = (x) => ({ wins: x.wins, legs: x.legs, avg: x.avgN ? Math.round((x.avgSum / x.avgN) * 100) / 100 : 0 });
  return { matches, a: out(ra), b: out(rb) };
}

// Ermittelt rückwirkend das Feld, auf dem ein Spieler ein Shanghai (Single+Double+Triple
// derselben Zahl in einer Aufnahme) geworfen hat – für die Anzeige „Shanghai (5)" bei
// bereits erspielten Abzeichen. Liefert das früheste gefundene Feld (1–20) oder null.
const visitDartsForPlayer = db.prepare('SELECT darts FROM match_visits WHERE player_id = ? ORDER BY id ASC');
function shanghaiFieldForPlayer(dbId) {
  if (!Number.isInteger(dbId)) return null;
  for (const row of visitDartsForPlayer.all(dbId)) {
    let darts;
    try {
      darts = JSON.parse(row.darts || '[]');
    } catch (e) {
      continue;
    }
    const bySeg = {};
    for (const d of darts) {
      if (d && d.segment >= 1 && d.segment <= 20) {
        (bySeg[d.segment] = bySeg[d.segment] || new Set()).add(d.multiplier);
      }
    }
    for (const seg in bySeg) {
      const m = bySeg[seg];
      if (m.has(1) && m.has(2) && m.has(3)) return Number(seg);
    }
  }
  return null;
}

module.exports = { recordMatch, list, get, remove, headToHead, shanghaiFieldForPlayer };
