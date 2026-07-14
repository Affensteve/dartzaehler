'use strict';

/**
 * Geteilte Turnier-Ansicht: synchronisiert Match-Ergebnisse aus den Spielen
 * (Gruppen- und KO-Phase), baut die Client-Ansicht und pusht Änderungen per SSE.
 */

const gameStore = require('../models/gameStore');
const tournamentStore = require('../models/tournamentStore');
const tlogic = require('./tournamentLogic');
const bracket = require('./tournamentBracket');
const playerStore = require('../models/playerStore');
const gameEvents = require('./gameEvents');

function matchStat(gp) {
  const darts = gp.dartsThrown || 0;
  return {
    sets: gp.setsWon || 0,
    legs: gp.legsWonTotal || 0,
    points: gp.pointsScored || 0,
    darts,
    avg: darts ? Math.round((gp.pointsScored / darts) * 3 * 100) / 100 : 0,
  };
}

/** Zieht Ergebnisse abgeschlossener Spiele in Gruppen- und KO-Matches. */
function syncResults(t) {
  let changed = false;
  let koDone = false;
  for (const m of t.matches) {
    if (m.status !== 'playing' || !m.gameId) continue;
    const game = gameStore.get(m.gameId);
    if (!game || game.status !== 'finished') continue;
    const gp1 = game.players.find((p) => p.id === m.p1);
    const gp2 = game.players.find((p) => p.id === m.p2);
    m.status = 'done';
    m.winnerId = game.winnerId;
    m.result = { p1: gp1 ? matchStat(gp1) : null, p2: gp2 ? matchStat(gp2) : null };
    changed = true;
    if (m.phase === 'ko') koDone = true;
  }
  if (koDone) bracket.advanceKo(t);

  // Turnierende: ohne KO endet es, wenn alle Gruppenspiele fertig sind.
  if (t.stage !== 'ko' && !(t.ko && t.ko.enabled)) {
    if (tlogic.allGroupMatchesDone(t) && t.status !== 'finished') {
      t.status = 'finished';
      changed = true;
    }
  }
  if (changed) tournamentStore.save(t);
  return t;
}

/** Live-Daten (aktuelle Legs/Score) eines laufenden Matches. */
function liveOf(m) {
  if (m.status !== 'playing' || !m.gameId) return null;
  const g = gameStore.get(m.gameId);
  if (!g || g.status !== 'playing') return null;
  const gp1 = g.players.find((p) => p.id === m.p1);
  const gp2 = g.players.find((p) => p.id === m.p2);
  const currentId = g.players[g.currentPlayerIndex] && g.players[g.currentPlayerIndex].id;
  return {
    p1Score: gp1 ? gp1.score : null,
    p2Score: gp2 ? gp2.score : null,
    p1Legs: gp1 ? gp1.legsWon : 0,
    p2Legs: gp2 ? gp2.legsWon : 0,
    p1Sets: gp1 ? gp1.setsWon : 0,
    p2Sets: gp2 ? gp2.setsWon : 0,
    currentId,
  };
}

function matchView(t, m) {
  const nameOr = (id, from) => (id ? tlogic.playerName(t, id) : from || 'offen');
  return {
    id: m.id,
    phase: m.phase || 'group',
    group: m.group || null,
    round: m.round,
    p1: m.p1,
    p2: m.p2,
    p1Name: nameOr(m.p1, m.p1From),
    p2Name: nameOr(m.p2, m.p2From),
    status: m.status,
    gameId: m.gameId,
    winnerId: m.winnerId,
    winnerName: m.winnerId ? tlogic.playerName(t, m.winnerId) : null,
    result: m.result,
    live: liveOf(m),
    bulloff: Boolean(m.bulloff),
    bye: Boolean(m.bye),
  };
}

/** Turnier-Bestwerte aus den gespielten Spielen (Ø immer; Finish/180 nur Numpad). */
function bestValues(t) {
  let bestAvg = null;
  let bestFinish = null;
  const s180 = new Map(); // key -> Anzahl 180er
  const misses = new Map(); // key -> Anzahl Fehlwürfe (Sektor 0)
  const nameById = new Map();
  for (const m of t.matches) {
    if (!m.gameId) continue;
    const g = gameStore.get(m.gameId);
    if (!g) continue;
    for (const p of g.players) {
      const key = p.dbId != null ? 'db' + p.dbId : p.id;
      nameById.set(key, p.name);
      const avg = p.dartsThrown ? (p.pointsScored / p.dartsThrown) * 3 : 0;
      if (avg > 0 && (!bestAvg || avg > bestAvg.value)) bestAvg = { name: p.name, value: Math.round(avg * 100) / 100 };
      const st = p.stats || {};
      if ((st.maxCheckout || 0) > 0 && (!bestFinish || st.maxCheckout > bestFinish.value)) {
        bestFinish = { name: p.name, value: st.maxCheckout };
      }
      if (st.s180) s180.set(key, (s180.get(key) || 0) + st.s180);
      const miss = (st.sectors && st.sectors['0']) || 0;
      if (miss) misses.set(key, (misses.get(key) || 0) + miss);
    }
  }
  let most180 = null;
  for (const [key, cnt] of s180) if (cnt > 0 && (!most180 || cnt > most180.value)) most180 = { name: nameById.get(key), value: cnt };
  // Fallback: wurde kein 180er geworfen, zeige den Spieler mit den meisten Fehlwürfen (Sektor 0).
  let mostMisses = null;
  if (!most180) {
    for (const [key, cnt] of misses) if (cnt > 0 && (!mostMisses || cnt > mostMisses.value)) mostMisses = { name: nameById.get(key), value: cnt };
  }
  return { bestAvg, bestFinish, most180, mostMisses };
}

/** Baut die Client-Ansicht eines Turniers. */
function buildClient(t) {
  // Anzeigenamen frisch auflösen (nicht persistiert).
  t = {
    ...t,
    players: t.players.map((p) => ({
      ...p,
      name: Number.isInteger(p.dbId) ? playerStore.displayName(p.dbId, p.name) : p.name,
    })),
  };
  const groupsSrc = t.groups && t.groups.length ? t.groups : [{ id: 'A', name: 'Gruppe A', playerIds: t.players.map((p) => p.id) }];

  // Live-Legs je Match für die Tabelle (verändert sich nach jedem Leg).
  const liveByMatch = {};
  for (const m of t.matches) {
    const lv = liveOf(m);
    if (lv) liveByMatch[m.id] = lv;
  }

  const groups = groupsSrc.map((g) => ({
    id: g.id,
    name: g.name,
    standings: tlogic.computeStandings(t, groupsSrc.length === 1 ? null : g.id, liveByMatch),
    matches: t.matches.filter((m) => (m.phase === undefined || m.phase === 'group') && (groupsSrc.length === 1 || m.group === g.id)).map((m) => matchView(t, m)),
  }));

  // Bracket-Ansicht
  let bracketView = null;
  let thirdPlace = null;
  if (t.bracket) {
    bracketView = t.bracket.map((r) => ({
      round: r.round,
      name: r.name,
      key: r.key || bracket.roundKey(r.matchIds.length),
      matches: r.matchIds.map((id) => matchView(t, t.matches.find((m) => m.id === id))),
    }));
    if (t.thirdPlaceId) {
      const tp = t.matches.find((m) => m.id === t.thirdPlaceId);
      if (tp) thirdPlace = matchView(t, tp);
    }
  }

  // Champion + Podium
  let champion = null;
  let podium = [];
  if (t.status === 'finished') {
    if (t.bracket) {
      const finalRound = t.bracket[t.bracket.length - 1];
      const finalM = finalRound && t.matches.find((m) => m.id === finalRound.matchIds[0]);
      if (finalM && finalM.winnerId) {
        const second = finalM.winnerId === finalM.p1 ? finalM.p2 : finalM.p1;
        champion = { playerId: finalM.winnerId, name: tlogic.playerName(t, finalM.winnerId) };
        podium = [champion, second ? { playerId: second, name: tlogic.playerName(t, second) } : null];
        if (t.thirdPlaceId) {
          const tp = t.matches.find((m) => m.id === t.thirdPlaceId);
          if (tp && tp.winnerId) podium.push({ playerId: tp.winnerId, name: tlogic.playerName(t, tp.winnerId) });
        }
      }
    } else {
      // Liga (kein KO): Bestplatzierter über alle Gruppen
      const all = groups.flatMap((g) => g.standings);
      all.sort((a, b) => b.points - a.points || b.diff - a.diff || b.avg - a.avg);
      champion = all[0] ? { playerId: all[0].playerId, name: all[0].name } : null;
      podium = all.slice(0, 3).map((r) => ({ playerId: r.playerId, name: r.name }));
    }
  }

  const pendingBullOffs = tlogic.pendingGroupTieBreaks(t);
  const koReady =
    t.ko && t.ko.enabled && t.stage === 'group' && tlogic.allGroupMatchesDone(t) && pendingBullOffs.length === 0;

  return {
    id: t.id,
    name: t.name,
    status: t.status,
    mode: t.mode,
    checkIn: t.checkIn,
    inputMode: t.inputMode || 'numpad',
    format: t.format,
    formats: t.formats || null,
    maxRounds: t.maxRounds,
    groupCount: t.groupCount || 1,
    ko: t.ko || { enabled: false, advance: 0 },
    thirdPlace: Boolean(t.thirdPlace),
    stage: t.stage || 'group',
    players: t.players,
    groups,
    bracket: bracketView,
    thirdPlaceMatch: thirdPlace,
    pendingBullOffs,
    koReady,
    champion,
    podium: podium.filter(Boolean),
    bestValues: t.status === 'finished' ? bestValues(t) : null,
    nextMatches: tlogic.nextMatches(t),
  };
}

/** Synchronisiert und pusht den aktuellen Turnierstand an alle SSE-Abonnenten. */
function publishUpdate(tournamentId) {
  let t = tournamentStore.get(tournamentId);
  if (!t) return;
  t = syncResults(t);
  gameEvents.publish(tournamentId, 'state', buildClient(t));
}

module.exports = { matchStat, syncResults, buildClient, publishUpdate };
