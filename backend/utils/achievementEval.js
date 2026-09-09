'use strict';

// Wertet Achievements für einen Spieler aus und vergibt neu erfüllte.
const statsStore = require('../models/statsStore');
const trainingStore = require('../models/trainingStore');
const playerStore = require('../models/playerStore');
const store = require('../models/achievementStore');
const ratingStore = require('../models/ratingStore');
const partyStore = require('../models/partyStore');
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
  // Doppelquote dieses Matches (min. 8 Versuche für „Doppel-Dominator").
  const dAtt = st.doubleAttempts || 0;
  let dHits = 0;
  for (const k in st.doubleStats || {}) dHits += (st.doubleStats[k] && st.doubleStats[k].hits) || 0;
  const matchDoubleRate = dAtt >= 8 ? dHits / dAtt : 0;
  const pf = game.partyFlags || {};
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
    shanghaiField: st.shanghaiField || null,
    minDartsLeg: st.minDartsLeg,
    legsWon,
    oppLegs: totalLegs - legsWon,
    average: avg,
    mode: game.mode,
    partyMode: game.partyMode || null,
    killerArmed: !!(pf.killerArmed || []).includes(dbId),
    baseballSlam: !!(pf.baseballSlam || []).includes(dbId),
    golfBirdie: !!(pf.golfBirdie || []).includes(dbId),
    golfUnderPar: !!(pf.golfUnderPar || []).includes(dbId),
    clockBlitz: !!(pf.clockBlitz || []).includes(dbId),
    baseballBig: !!(pf.baseballBig || []).includes(dbId),
    // Neue Kennzahlen (Stufe: 25 Achievements)
    whitewashReceived: !won && legsWon === 0 && totalLegs - legsWon >= 2,
    highAvgLoss: !won && avg >= 90,
    bustsInGame: st.busts || 0,
    tonsInRow: (st.tonsInRow || 0) > 0,
    matchDoubleRate,
    comebackDeficit: st.maxDeficit || 0,
    inTournament: !!game.tournamentId,
    s140Plus: (st.s140 || 0) + (st.s180 || 0),
    bedBreakfast: (st.bedBreakfast || 0) > 0,
    threeInBed: (st.threeInBed || 0) > 0,
    nuller: (st.nuller || 0) > 0,
    twoInRow180: (st.twoInRow180 || 0) > 0,
    bullBullFinish: (st.bullBullFinish || 0) > 0,
    madhouse: (st.madhouse || 0) > 0,
    clutchFinish: (st.clutchFinish || 0) > 0,
    twoT20: (st.twoT20 || 0) > 0,
    twoBull: (st.twoBull || 0) > 0,
    threeBull: (st.threeBull || 0) > 0,
    twoT19: (st.twoT19 || 0) > 0,
    tripleFinish: (st.tripleCheckouts || 0) > 0,
    tripleFinishCount: st.tripleCheckouts || 0,
    exactTon: (st.exactTon || 0) > 0,
    sixtyNine: (st.sixtyNine || 0) > 0,
    threeDoubles: (st.threeDoubles || 0) > 0,
    threeTriples: (st.threeTriples || 0) > 0,
    surrenderedByMe: !!(game.surrenderInfo && (game.surrenderInfo.by || []).includes(dbId)),
    wonBySurrender: !!game.surrenderInfo && won && !(game.surrenderInfo.by || []).includes(dbId),
    surrenderedWhileLeading: !!(game.surrenderInfo && (game.surrenderInfo.by || []).includes(dbId) && game.surrenderInfo.myRest < game.surrenderInfo.oppMinRest),
    surrenderedEarly: !!(game.surrenderInfo && (game.surrenderInfo.by || []).includes(dbId) && (game.surrenderInfo.round || 99) <= 1),
    surrenderedNearFinish: !!(game.surrenderInfo && (game.surrenderInfo.by || []).includes(dbId) && game.surrenderInfo.myRest <= 40),
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
  const rating = ratingStore.forPlayer(id);
  const ctx = { agg, training, match, elo: rating.elo, rankedGames: rating.games, partyGames: partyStore.countForPlayer(id), now: new Date(), player: p, playStreak: statsStore.playDayStreak(id), trainStreak: trainingStore.trainDayStreak(id) };
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
