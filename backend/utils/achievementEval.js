'use strict';

// Wertet Achievements für einen Spieler aus und vergibt neu erfüllte.
const statsStore = require('../models/statsStore');
const trainingStore = require('../models/trainingStore');
const playerStore = require('../models/playerStore');
const store = require('../models/achievementStore');
const { satisfiedIds } = require('./achievements');

// Findet zu einer dbId die Scoring-Einheit (Einzelspieler oder Team) und – bei Teams –
// das Mitglied, dessen Kennzahlen ausgewertet werden.
function findEntry(game, dbId) {
  for (const p of game.players) {
    if ((p.dbId ?? null) === dbId) return { team: null, member: p, scoreEntity: p };
    if (p.members) {
      const m = p.members.find((mm) => (mm.dbId ?? null) === dbId);
      if (m) return { team: p, member: m, scoreEntity: p };
    }
  }
  return null;
}

function matchStatsFor(game, dbId) {
  const found = findEntry(game, dbId);
  if (!found) return null;
  const { team, member, scoreEntity } = found;
  const st = member.stats || {};
  const totalLegs = game.players.reduce((s, x) => s + (x.legsWonTotal || 0), 0);
  const legsWon = scoreEntity.legsWonTotal || 0;
  const avg = member.dartsThrown ? Math.round((member.pointsScored / member.dartsThrown) * 3 * 100) / 100 : 0;
  const won = game.winnerId === scoreEntity.id;
  const teamAch = (team && team.teamAch) || {};
  const teamWhitewash =
    !!team && won && legsWon >= 2 && game.players.every((x) => x === team || (x.legsWonTotal || 0) === 0);
  return {
    won,
    oneEighties: st.s180 || 0,
    maxTurn: st.maxTurn || 0,
    maxCheckout: st.maxCheckout || 0,
    bullFinish: (st.bullCheckouts || 0) > 0,
    cleanSet: (st.cleanSet || 0) > 0,
    comeback: (st.comeback || 0) > 0,
    coStreakMax: st.coStreakMax || 0,
    shanghai: st.shanghai || 0,
    minDartsLeg: st.minDartsLeg,
    legsWon,
    oppLegs: totalLegs - legsWon,
    average: avg,
    mode: game.mode,
    s140Plus: (st.s140 || 0) + (st.s180 || 0),
    bedBreakfast: (st.bedBreakfast || 0) > 0,
    threeInBed: (st.threeInBed || 0) > 0,
    nuller: (st.nuller || 0) > 0,
    twoInRow180: (st.twoInRow180 || 0) > 0,
    bullBullFinish: (st.bullBullFinish || 0) > 0,
    madhouse: (st.madhouse || 0) > 0,
    clutchFinish: (st.clutchFinish || 0) > 0,
    // Team-Kontext
    isTeam: !!team,
    teamWin: !!team && won,
    teamWhitewash,
    team180Leg: !!teamAch.oneEightyLeg,
    teamPartnerCo: !!teamAch.partnerCo,
    teamPartnerCoCount: teamAch.partnerCoCount || 0,
  };
}

// Wertet für einen Spieler aus; game optional (bei Training null). -> neue IDs
function evaluate(dbId, { game = null } = {}) {
  const id = Number(dbId);
  const p = playerStore.get(id);
  if (!p || p.type !== 'human') return [];
  const agg = statsStore.get(id, 'all', { training: false }) || {};
  const training = trainingStore.playerStats(id, 'all') || {};
  const match = game ? matchStatsFor(game, id) : null;
  const ctx = { agg, training, match, now: new Date(), player: p, playStreak: statsStore.playDayStreak(id), trainStreak: trainingStore.trainDayStreak(id) };
  const earned = store.earnedIds(id);
  const now = [];
  for (const aid of satisfiedIds(ctx)) {
    if (!earned.has(aid) && store.award(id, aid)) now.push(aid);
  }
  return now;
}

// Alle menschlichen Spieler eines beendeten Spiels auswerten.
function evaluateGame(game) {
  const seen = new Set();
  const result = {};
  const ids = [];
  for (const pl of game.players) {
    if (pl.members) for (const m of pl.members) ids.push(m.dbId ?? null);
    else ids.push(pl.dbId ?? null);
  }
  for (const dbId of ids) {
    if (dbId == null || seen.has(dbId)) continue;
    seen.add(dbId);
    const now = evaluate(dbId, { game });
    if (now.length) result[dbId] = now;
  }
  return result;
}

module.exports = { evaluate, evaluateGame };
