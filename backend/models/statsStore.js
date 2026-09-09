'use strict';

const db = require('../db/init');
const playerStore = require('./playerStore');

// Prepared-Statement-Cache: Queries mit dynamischer WHERE-Klausel würden sonst
// bei jedem Aufruf neu kompiliert. Gecacht nach SQL-Text (Statement ist wiederverwendbar).
const stmtCache = new Map();
function q(sql) {
  let st = stmtCache.get(sql);
  if (!st) {
    st = db.prepare(sql);
    stmtCache.set(sql, st);
  }
  return st;
}

const upsertStmt = db.prepare(`
  INSERT INTO game_stats
    (game_id, player_id, is_training, dart_id, mode, won, legs_won, legs_lost, darts, points, doubles,
     triples, double_attempts, checkouts, max_checkout, min_darts_leg, first9_points, first9_darts,
     max_turn, s60, s100, s140, s180, sectors, double_stats, checkout_ranges)
  VALUES
    (@gameId, @playerId, @isTraining, @dartId, @mode, @won, @legsWon, @legsLost, @darts, @points, @doubles,
     @triples, @doubleAttempts, @checkouts, @maxCheckout, @minDartsLeg, @first9Points, @first9Darts,
     @maxTurn, @s60, @s100, @s140, @s180, @sectors, @doubleStats, @checkoutRanges)
  ON CONFLICT(game_id, player_id) DO UPDATE SET
    is_training=excluded.is_training, dart_id=excluded.dart_id, mode=excluded.mode,
    won=excluded.won, legs_won=excluded.legs_won, legs_lost=excluded.legs_lost,
    darts=excluded.darts, points=excluded.points, doubles=excluded.doubles, triples=excluded.triples,
    double_attempts=excluded.double_attempts, checkouts=excluded.checkouts,
    max_checkout=excluded.max_checkout, min_darts_leg=excluded.min_darts_leg,
    first9_points=excluded.first9_points, first9_darts=excluded.first9_darts,
    max_turn=excluded.max_turn, s60=excluded.s60, s100=excluded.s100, s140=excluded.s140,
    s180=excluded.s180, sectors=excluded.sectors, double_stats=excluded.double_stats, checkout_ranges=excluded.checkout_ranges
`);

function mergeSectors(target, src) {
  for (const [k, v] of Object.entries(src || {})) target[k] = (target[k] || 0) + v;
  return target;
}

function mergeDoubleStats(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    const cur = target[k] || (target[k] = { attempts: 0, hits: 0 });
    cur.attempts += v.attempts || 0;
    cur.hits += v.hits || 0;
  }
  return target;
}

function mergeCoRanges(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    const cur = target[k] || (target[k] = { h: 0, a: 0 });
    cur.h += v.h || 0;
    cur.a += v.a || 0;
  }
  return target;
}

const CO_BUCKETS = ['2-40', '41-70', '71-100', '101-170', 'pressure'];
function coRangeOut(cr) {
  const out = {};
  for (const k of CO_BUCKETS) {
    const e = (cr && cr[k]) || { h: 0, a: 0 };
    out[k] = { hits: e.h || 0, attempts: e.a || 0, pct: pct(e.h || 0, e.a || 0) };
  }
  return out;
}

/** Verbucht ein beendetes Spiel in die Detail-Statistik (pro dbId aggregiert). */
function recordGameResult(game) {
  if (game.status !== 'finished') return;
  const totalLegs = game.players.reduce((s, p) => s + (p.legsWonTotal || 0), 0);
  const isTraining = game.training ? 1 : 0;

  // Teams zu einzelnen Mitgliedern expandieren: jedes Mitglied bekommt seine
  // eigenen Kennzahlen (aus seinen Würfen); der Sieg zählt für das ganze Team.
  const contributors = [];
  for (const p of game.players) {
    if (p.members && p.members.length) {
      for (const mm of p.members) {
        contributors.push({
          dbId: mm.dbId ?? null,
          dartId: mm.dartId,
          stats: mm.stats,
          legsWonTotal: p.legsWonTotal,
          dartsThrown: mm.dartsThrown,
          pointsScored: mm.pointsScored,
          won: game.winnerId === p.id,
        });
      }
    } else {
      contributors.push({
        dbId: p.dbId ?? (Number.isInteger(p.id) ? p.id : null),
        dartId: p.dartId,
        stats: p.stats,
        legsWonTotal: p.legsWonTotal,
        dartsThrown: p.dartsThrown,
        pointsScored: p.pointsScored,
        won: game.winnerId === p.id,
      });
    }
  }

  const groups = new Map();
  for (const p of contributors) {
    const id = p.dbId;
    if (!id || !playerStore.get(id)) continue;
    if (!groups.has(id)) {
      groups.set(id, {
        playerId: id,
        dartId: Number.isInteger(p.dartId) ? p.dartId : null,
        won: 0, legsWon: 0, darts: 0, points: 0, doubles: 0, triples: 0, doubleAttempts: 0,
        maxCheckout: 0, minDartsLeg: null, first9Points: 0, first9Darts: 0, maxTurn: 0,
        s60: 0, s100: 0, s140: 0, s180: 0, sectors: {}, doubleStats: {}, checkoutRanges: {},
      });
    }
    const g = groups.get(id);
    const st = p.stats || {};
    if (p.won) g.won = 1;
    g.legsWon += p.legsWonTotal || 0;
    g.darts += p.dartsThrown || 0;
    g.points += p.pointsScored || 0;
    g.doubles += st.doubles || 0;
    g.triples += st.triples || 0;
    g.doubleAttempts += st.doubleAttempts || 0;
    g.first9Points += st.first9Points || 0;
    g.first9Darts += st.first9Darts || 0;
    g.s60 += st.s60 || 0;
    g.s100 += st.s100 || 0;
    g.s140 += st.s140 || 0;
    g.s180 += st.s180 || 0;
    if ((st.maxCheckout || 0) > g.maxCheckout) g.maxCheckout = st.maxCheckout;
    if ((st.maxTurn || 0) > g.maxTurn) g.maxTurn = st.maxTurn;
    if (st.minDartsLeg != null && (g.minDartsLeg == null || st.minDartsLeg < g.minDartsLeg)) {
      g.minDartsLeg = st.minDartsLeg;
    }
    mergeSectors(g.sectors, st.sectors);
    mergeDoubleStats(g.doubleStats, st.doubleStats);
    mergeCoRanges(g.checkoutRanges, st.checkoutRanges);
  }

  for (const g of groups.values()) {
    upsertStmt.run({
      gameId: game.id,
      playerId: g.playerId,
      isTraining,
      dartId: g.dartId,
      mode: game.mode || null,
      won: g.won,
      legsWon: g.legsWon,
      legsLost: Math.max(0, totalLegs - g.legsWon),
      darts: g.darts,
      points: g.points,
      doubles: g.doubles,
      triples: g.triples,
      doubleAttempts: g.doubleAttempts,
      checkouts: game.inputMode === 'sum' ? 0 : g.legsWon,
      maxCheckout: g.maxCheckout,
      minDartsLeg: g.minDartsLeg,
      first9Points: g.first9Points,
      first9Darts: g.first9Darts,
      maxTurn: g.maxTurn,
      s60: g.s60,
      s100: g.s100,
      s140: g.s140,
      s180: g.s180,
      sectors: JSON.stringify(g.sectors),
      doubleStats: JSON.stringify(g.doubleStats),
      checkoutRanges: JSON.stringify(g.checkoutRanges),
    });
  }
}

const RANGE_SINCE = {
  today: "datetime('now','start of day')",
  '7d': "datetime('now','-7 days')",
  '30d': "datetime('now','-30 days')",
  all: null,
};

/** Baut WHERE-Klausel + Parameter für die gewünschten Filter. */
function buildWhere({ range = 'all', training = false, dartId = null, playerId = null }) {
  const conds = ['gs.is_training = @training'];
  const params = { training: training ? 1 : 0 };
  const since = RANGE_SINCE[range];
  if (since) conds.push(`gs.finished_at >= ${since}`);
  if (dartId != null) {
    conds.push('gs.dart_id = @dartId');
    params.dartId = dartId;
  }
  if (playerId != null) {
    conds.push('gs.player_id = @playerId');
    params.playerId = playerId;
  }
  return { where: 'WHERE ' + conds.join(' AND '), params };
}

const pct = (a, b) => (b ? Math.round((a / b) * 10000) / 100 : 0);
const avg3 = (pts, darts) => (darts ? Math.round((pts / darts) * 3 * 100) / 100 : 0);

function mapRow(r, sectors, dbl, minByMode, coRanges) {
  const hits = dbl ? dbl.hits : 0;
  const attempts = dbl ? dbl.attempts : 0;
  return {
    playerId: r.playerId,
    name: r.name,
    type: r.type,
    botLevel: r.botLevel || null,
    games: r.games,
    wins: r.wins,
    winPct: pct(r.wins, r.games),
    legsWon: r.legsWon,
    legs: r.legsWon + r.legsLost,
    legsWinPct: pct(r.legsWon, r.legsWon + r.legsLost),
    average: avg3(r.points, r.darts),
    first9Avg: avg3(r.f9p, r.f9d),
    dartsAvg: r.games ? Math.round((r.darts / r.games) * 10) / 10 : 0,
    doublePct: pct(r.doubles, r.darts),
    triplePct: pct(r.triples, r.darts),
    maxTurn: r.maxTurn,
    s60: r.s60,
    s100: r.s100,
    s140: r.s140,
    s180: r.s180,
    maxCheckout: r.maxCheckout,
    minDarts: r.minDarts || 0,
    minDartsByMode: minByMode || {},
    checkoutPct: pct(r.checkouts, r.doubleAttempts),
    // Erweiterte Kennzahlen: Doppelquote je Wurf ("Checkout unter Druck").
    doubleHits: hits,
    doubleTries: attempts,
    doubleRatePct: pct(hits, attempts),
    // Aufnahmen ab 100 (Tons) und Fehlwürfe (Darts, die 0 trafen = Sektor "0").
    tons: (r.s100 || 0) + (r.s140 || 0) + (r.s180 || 0),
    dartsTotal: r.darts || 0,
    misses: sectors ? sectors['0'] || 0 : 0,
    missPct: pct(sectors ? sectors['0'] || 0 : 0, r.darts),
    sectors: sectors || {},
    checkoutRanges: coRangeOut(coRanges),
  };
}

/** Aggregierte Statistik (gruppiert pro Spieler) mit den gegebenen Filtern. */
function query(filters) {
  const { where, params } = buildWhere(filters);
  const rows = q(
      `SELECT gs.player_id AS playerId, p.name AS name, p.type AS type, p.bot_level AS botLevel,
              COUNT(*) AS games, SUM(gs.won) AS wins,
              SUM(gs.legs_won) AS legsWon, SUM(gs.legs_lost) AS legsLost,
              SUM(gs.darts) AS darts, SUM(gs.points) AS points,
              SUM(gs.doubles) AS doubles, SUM(gs.triples) AS triples,
              SUM(gs.double_attempts) AS doubleAttempts, SUM(gs.checkouts) AS checkouts,
              MAX(gs.max_checkout) AS maxCheckout, MIN(gs.min_darts_leg) AS minDarts,
              SUM(gs.first9_points) AS f9p, SUM(gs.first9_darts) AS f9d, MAX(gs.max_turn) AS maxTurn,
              SUM(gs.s60) AS s60, SUM(gs.s100) AS s100, SUM(gs.s140) AS s140, SUM(gs.s180) AS s180
       FROM game_stats gs JOIN players p ON p.id = gs.player_id
       ${where}
       GROUP BY gs.player_id`
    )
    .all(params);

  const secRows = q(`SELECT gs.player_id AS playerId, gs.sectors AS sectors, gs.double_stats AS doubleStats, gs.checkout_ranges AS checkoutRanges FROM game_stats gs ${where}`)
    .all(params);
  const sectorsByPlayer = new Map();
  const doubleByPlayer = new Map();
  const coRangesByPlayer = new Map();
  for (const r of secRows) {
    const cur = sectorsByPlayer.get(r.playerId) || {};
    try {
      mergeSectors(cur, JSON.parse(r.sectors || '{}'));
    } catch (e) {
      /* ignore */
    }
    sectorsByPlayer.set(r.playerId, cur);

    const dbl = doubleByPlayer.get(r.playerId) || { hits: 0, attempts: 0 };
    try {
      for (const v of Object.values(JSON.parse(r.doubleStats || '{}'))) {
        dbl.hits += v.hits || 0;
        dbl.attempts += v.attempts || 0;
      }
    } catch (e) {
      /* ignore */
    }
    doubleByPlayer.set(r.playerId, dbl);

    const cr = coRangesByPlayer.get(r.playerId) || {};
    try {
      mergeCoRanges(cr, JSON.parse(r.checkoutRanges || '{}'));
    } catch (e) {
      /* ignore */
    }
    coRangesByPlayer.set(r.playerId, cr);
  }
  const minRows = q(
      `SELECT gs.player_id AS playerId, gs.mode AS mode, MIN(gs.min_darts_leg) AS md
       FROM game_stats gs ${where} AND gs.min_darts_leg IS NOT NULL AND gs.mode IS NOT NULL
       GROUP BY gs.player_id, gs.mode`
    )
    .all(params);
  const minByPlayer = new Map();
  for (const r of minRows) {
    const m = minByPlayer.get(r.playerId) || {};
    m[r.mode] = r.md;
    minByPlayer.set(r.playerId, m);
  }
  return rows.map((r) =>
    mapRow(r, sectorsByPlayer.get(r.playerId), doubleByPlayer.get(r.playerId), minByPlayer.get(r.playerId), coRangesByPlayer.get(r.playerId))
  );
}

function list(range = 'all', { training = false } = {}) {
  return query({ range, training });
}

// Aktuelle Siegesserie (aufeinanderfolgende Siege, neueste zuerst), nur echte Spiele.
function winStreak(playerId) {
  const rows = q('SELECT won FROM game_stats WHERE player_id = ? AND is_training = 0 ORDER BY finished_at DESC')
    .all(Number(playerId));
  let nWins = 0;
  for (const r of rows) {
    if (r.won) nWins += 1;
    else break;
  }
  return nWins;
}

// Niederlagen-Serien (aktuell, maximal, und ob die letzte Serie ≥5 mit einem Sieg gebrochen wurde).
function lossStats(playerId) {
  const rows = q('SELECT won FROM game_stats WHERE player_id = ? AND is_training = 0 ORDER BY finished_at DESC').all(Number(playerId));
  let cur = 0;
  for (const r of rows) {
    if (!r.won) cur += 1;
    else break;
  }
  let max = 0;
  let run = 0;
  for (const r of rows) {
    if (!r.won) {
      run += 1;
      if (run > max) max = run;
    } else {
      run = 0;
    }
  }
  const broke5 = rows.length >= 6 && rows[0].won === 1 && rows.slice(1, 6).every((r) => !r.won);
  return { cur, max, broke5 };
}
function bigFishCount(playerId) {
  return q('SELECT COUNT(*) AS c FROM game_stats WHERE player_id = ? AND is_training = 0 AND max_checkout >= 170').get(Number(playerId)).c;
}
function checkoutsTotal(playerId) {
  return q('SELECT COALESCE(SUM(checkouts),0) AS c FROM game_stats WHERE player_id = ? AND is_training = 0').get(Number(playerId)).c;
}
// Serie aufeinanderfolgender Matches mit 90+ Average (neueste zuerst).
function avg90Streak(playerId) {
  const rows = q('SELECT points, darts FROM game_stats WHERE player_id = ? AND is_training = 0 ORDER BY finished_at DESC').all(Number(playerId));
  let n = 0;
  for (const r of rows) {
    const a = r.darts ? (r.points / r.darts) * 3 : 0;
    if (a >= 90) n += 1;
    else break;
  }
  return n;
}

function get(playerId, range = 'all', { training = false, dartId = null } = {}) {
  const id = Number(playerId);
  const found = query({ range, training, dartId, playerId: id })[0];
  if (found) {
    found.winStreak = winStreak(id);
    found.losses = Math.max(0, (found.games || 0) - (found.wins || 0));
    const ls = lossStats(id);
    found.lossStreak = ls.cur;
    found.lossStreakMax = ls.max;
    found.brokeLoss5 = ls.broke5;
    found.bigFishCount = bigFishCount(id);
    found.checkoutsTotal = checkoutsTotal(id);
    found.avg90Streak = avg90Streak(id);
    return found;
  }
  const p = playerStore.get(id);
  if (!p) return null;
  return {
    playerId: p.id, name: p.name, type: p.type, botLevel: p.botLevel,
    games: 0, wins: 0, winPct: 0, legsWon: 0, legs: 0, legsWinPct: 0,
    average: 0, first9Avg: 0, dartsAvg: 0, doublePct: 0, triplePct: 0, maxTurn: 0,
    s60: 0, s100: 0, s140: 0, s180: 0, maxCheckout: 0, minDarts: 0, checkoutPct: 0,
    doubleHits: 0, doubleTries: 0, doubleRatePct: 0, tons: 0, dartsTotal: 0, winStreak: 0, misses: 0, missPct: 0, minDartsByMode: {}, sectors: {},
  };
}

function weekLabel(bucket) {
  if (!bucket) return '';
  const [y, w] = bucket.split('-');
  return `KW ${Number(w)}/${y}`;
}

/**
 * Fortschritts-Timeline: je Kalenderwoche aggregierte Kennzahlen (Ø, Erste-9-Ø,
 * Checkout-%, 180er, max. Aufnahme) für einen Spieler – optional je Pfeil/Bereich.
 */
function timeline(playerId, { training = false, dartId = null, range = 'all' } = {}) {
  const conds = ['gs.player_id = @playerId', 'gs.is_training = @training'];
  const params = { playerId: Number(playerId), training: training ? 1 : 0 };
  const since = RANGE_SINCE[range];
  if (since) conds.push(`gs.finished_at >= ${since}`);
  if (dartId != null) {
    conds.push('gs.dart_id = @dartId');
    params.dartId = dartId;
  }
  const where = 'WHERE ' + conds.join(' AND ');
  const rows = q(
      `SELECT strftime('%Y-%W', gs.finished_at) AS bucket, MIN(gs.finished_at) AS firstAt,
              COUNT(*) AS games, SUM(gs.won) AS wins,
              SUM(gs.points) AS points, SUM(gs.darts) AS darts,
              SUM(gs.first9_points) AS f9p, SUM(gs.first9_darts) AS f9d,
              SUM(gs.checkouts) AS checkouts, SUM(gs.double_attempts) AS doubleAttempts,
              SUM(gs.s180) AS s180, MAX(gs.max_turn) AS maxTurn
       FROM game_stats gs ${where}
       GROUP BY bucket ORDER BY bucket`
    )
    .all(params);
  return rows.map((r) => ({
    bucket: r.bucket,
    label: weekLabel(r.bucket),
    firstAt: r.firstAt,
    games: r.games,
    wins: r.wins,
    average: avg3(r.points, r.darts),
    first9Avg: avg3(r.f9p, r.f9d),
    checkoutPct: pct(r.checkouts, r.doubleAttempts),
    s180: r.s180,
    maxTurn: r.maxTurn,
  }));
}

/** Welche Pfeile hat der Spieler im gewählten Bereich benutzt (für den Filter)? */
function playerDarts(playerId, { training = false } = {}) {
  const rows = q(
      `SELECT gs.dart_id AS dartId, d.name AS name, d.weight_grams AS weightGrams, COUNT(*) AS games
       FROM game_stats gs LEFT JOIN darts d ON d.id = gs.dart_id
       WHERE gs.player_id = @playerId AND gs.is_training = @training
       GROUP BY gs.dart_id
       ORDER BY games DESC`
    )
    .all({ playerId: Number(playerId), training: training ? 1 : 0 });
  return rows.map((r) => ({
    dartId: r.dartId,
    name: r.dartId == null ? 'Ohne Pfeil' : r.name || 'Pfeil',
    weightGrams: r.weightGrams != null ? r.weightGrams : null,
    games: r.games,
  }));
}

/** Sektor-Trefferzahlen je Pfeil (für gestapelte Balken „Alle Pfeile"). */
function playerSectorsByDart(playerId, { training = false, range = 'all' } = {}) {
  const { where, params } = buildWhere({ range, training, playerId: Number(playerId) });
  const rows = q(`SELECT gs.dart_id AS dartId, gs.sectors AS sectors, gs.points AS points, gs.darts AS darts FROM game_stats gs ${where}`)
    .all(params);
  const byDart = new Map();
  const ptsByDart = new Map();
  for (const r of rows) {
    const cur = byDart.get(r.dartId) || {};
    try {
      mergeSectors(cur, JSON.parse(r.sectors || '{}'));
    } catch (e) {
      /* ignore */
    }
    byDart.set(r.dartId, cur);
    const pd = ptsByDart.get(r.dartId) || { points: 0, darts: 0 };
    pd.points += r.points || 0;
    pd.darts += r.darts || 0;
    ptsByDart.set(r.dartId, pd);
  }
  // Alle Pfeile einmalig laden (statt je Dart eine Einzel-Query).
  const dartMap = new Map();
  for (const d of q('SELECT id, name, weight_grams AS w FROM darts').all()) {
    dartMap.set(d.id, d);
  }
  const out = [];
  for (const [dartId, sectors] of byDart) {
    let name = 'Ohne Pfeil';
    let weightGrams = null;
    if (dartId != null) {
      const d = dartMap.get(dartId);
      if (d) {
        name = d.name;
        weightGrams = d.w;
      }
    }
    const total = Object.values(sectors).reduce((a, b) => a + b, 0);
    const pd = ptsByDart.get(dartId) || { points: 0, darts: 0 };
    out.push({ dartId, name, weightGrams, sectors, total, average: avg3(pd.points, pd.darts) });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

const { randomUUID } = require('crypto');

/** Verbucht ein Scoring-Training (z. B. Count-up) als Trainings-Zeile in game_stats. */
function recordTrainingScoring({ playerId, dartId = null, points = 0, darts = 0, s60 = 0, s100 = 0, s140 = 0, s180 = 0, maxTurn = 0 }) {
  const id = Number(playerId);
  if (!id || !playerStore.get(id)) return;
  upsertStmt.run({
    gameId: 'train-' + randomUUID(),
    playerId: id,
    isTraining: 1,
    dartId: Number.isInteger(dartId) ? dartId : null,
    mode: null,
    won: 0,
    legsWon: 0,
    legsLost: 0,
    darts: Math.max(0, Math.round(darts)),
    points: Math.max(0, Math.round(points)),
    doubles: 0,
    triples: 0,
    doubleAttempts: 0,
    checkouts: 0,
    maxCheckout: 0,
    minDartsLeg: null,
    first9Points: 0,
    first9Darts: 0,
    maxTurn: Math.max(0, Math.round(maxTurn)),
    s60, s100, s140, s180,
    sectors: '{}',
    doubleStats: '{}',
  });
}


// Aufeinanderfolgende Tage (bis heute bzw. jüngstem Datum) aus 'YYYY-MM-DD'-Liste.
function streakFromDates(dates) {
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

// Anzahl aufeinanderfolgender Tage mit mindestens einem echten (Nicht-Training-)Spiel.
function playDayStreak(playerId) {
  const rows = q(
    "SELECT DISTINCT date(finished_at) AS d FROM game_stats WHERE player_id = ? AND is_training = 0 AND finished_at IS NOT NULL ORDER BY d DESC"
  ).all(Number(playerId));
  return streakFromDates(rows.map((r) => r.d));
}

// Empfohlener Pfeil je (menschlichem) Spieler: der Pfeil mit dem höchsten Average.
// Pfeile mit mind. 2 Spielen werden bevorzugt, um Einzel-Ausreißer zu vermeiden.
function dartRecommendations() {
  const rows = q(`
    SELECT gs.player_id AS pid, p.name AS pname, gs.dart_id AS did, d.name AS dname,
           COUNT(*) AS games, SUM(gs.points) AS pts, SUM(gs.darts) AS drt
    FROM game_stats gs
    JOIN players p ON p.id = gs.player_id
    LEFT JOIN darts d ON d.id = gs.dart_id
    WHERE gs.is_training = 0 AND p.type = 'human' AND gs.dart_id IS NOT NULL
    GROUP BY gs.player_id, gs.dart_id
  `).all();
  const byPlayer = new Map();
  for (const r of rows) {
    const rec = { dartId: r.did, dartName: r.dname || `Pfeil ${r.did}`, games: r.games, average: avg3(r.pts, r.drt) };
    const cur = byPlayer.get(r.pid) || { playerId: r.pid, name: r.pname, darts: [] };
    cur.darts.push(rec);
    byPlayer.set(r.pid, cur);
  }
  const out = [];
  for (const p of byPlayer.values()) {
    const eligible = p.darts.filter((x) => x.games >= 2);
    const pool = (eligible.length ? eligible : p.darts).slice().sort((a, b) => b.average - a.average);
    const best = pool[0];
    out.push({ playerId: p.playerId, name: p.name, dartId: best.dartId, dartName: best.dartName, average: best.average, games: best.games });
  }
  return out.sort((a, b) => b.average - a.average);
}

// Spieler, die einen bestimmten Pfeil gespielt haben, mit ihrem Average damit.
function playersForDart(dartId) {
  const rows = q(`
    SELECT gs.player_id AS pid, p.name AS pname, COUNT(*) AS games, SUM(gs.points) AS pts, SUM(gs.darts) AS drt
    FROM game_stats gs
    JOIN players p ON p.id = gs.player_id
    WHERE gs.is_training = 0 AND gs.dart_id = ?
    GROUP BY gs.player_id
  `).all(Number(dartId));
  return rows
    .map((r) => ({ playerId: r.pid, name: r.pname, games: r.games, average: avg3(r.pts, r.drt) }))
    .sort((a, b) => b.average - a.average);
}

module.exports = { recordGameResult, recordTrainingScoring, list, get, timeline, playerDarts, playerSectorsByDart, playDayStreak, dartRecommendations, playersForDart };
