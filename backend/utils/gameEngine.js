'use strict';

/**
 * Game-Engine: X01 (501/301/101) inkl. Legs/Sätzen, Busting, Undo, Bot-Zügen,
 * Rundenzählung, Ausbullen und Detail-Statistik-Erfassung.
 */

const { randomUUID } = require('crypto');
const rules = require('./dartRules');
const botAI = require('./botAI');
const playerStore = require('../models/playerStore');
const doubleProfile = require('./doubleProfile');
const achievements = require('./achievements');
const ACH_BY_ID = new Map(achievements.catalog().map((a) => [a.id, a]));

const UNDO_LIMIT = 60;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function resolveFormat({ satzLegMode = 'firstto', sets = 1, legs = 3 } = {}) {
  let legsPerSet;
  let setsToWin;
  let label;
  if (satzLegMode === 'unlimited') {
    setsToWin = 0; // 0 = kein Ziel -> Spiel endet nur manuell
    legsPerSet = 0;
    label = 'Unbegrenzt';
  } else if (satzLegMode === 'bestof') {
    setsToWin = 1;
    legsPerSet = Math.floor(legs / 2) + 1;
    label = `Best of ${legs}`;
  } else {
    setsToWin = sets;
    legsPerSet = legs;
    label = `First to ${sets} ${sets === 1 ? 'Satz' : 'Sätze'} ${legs} Legs`;
  }
  return { satzLegMode, sets, legs, legsPerSet, setsToWin, label };
}

function emptyStats() {
  return {
    doubles: 0,
    triples: 0,
    doubleAttempts: 0,
    s60: 0,
    s100: 0,
    s140: 0,
    s180: 0,
    maxTurn: 0,
    first9Points: 0,
    first9Darts: 0,
    maxCheckout: 0,
    minDartsLeg: null,
    sectors: {},
    doubleStats: {},
  };
}

function createGame(config) {
  const {
    mode = 501,
    checkIn = 'straight',
    players = [],
    randomOrder = false,
    tournamentId = null,
    meta = {},
    maxRounds = 20,
  } = config;

  const startScore = rules.START_SCORES[mode] || 501;
  const format = resolveFormat(config);

  let roster = players.map((p) => ({
    id: p.id,
    dbId: p.dbId ?? (Number.isInteger(p.id) ? p.id : null),
    name: p.name,
    type: p.type || 'human',
    botLevel: p.botLevel || null,
    adaptivePush: p.adaptivePush === true,
    adaptiveBase: Number.isFinite(p.adaptiveBase) ? p.adaptiveBase : null,
    checkoutMode: ['single', 'master'].includes(p.checkoutMode) ? p.checkoutMode : 'double',
    dartId: Number.isInteger(p.dartId) ? p.dartId : null,
    score: startScore,
    opened: checkIn !== 'double',
    legsWon: 0,
    setsWon: 0,
    legsWonTotal: 0,
    dartsThrown: 0,
    pointsScored: 0,
    legDarts: 0,
    legPoints: 0,
    visitsThisLeg: 0,
    currentTurn: [],
    lastTurnDarts: [],
    turnPoints: 0,
    lastVisitScore: 0,
    turnStartScore: startScore,
    stats: emptyStats(),
    doubleProfile: null,
    voice: null,
  }));

  for (const p of roster) {
    if (p.dbId == null) continue;
    const dbPlayer = playerStore.get(p.dbId);
    if (!dbPlayer) continue;
    p.voice = dbPlayer.voice || null;
    if (p.checkoutMode === 'double') {
      // Gemessenes Doppel-Profil nur bei aktivierter Personalisierung.
      let prof = dbPlayer.personalizeCheckout ? doubleProfile.getPlayerDoubleProfile(p.dbId) : null;
      // Manuell gewähltes Lieblingsdoppel klar bevorzugen (unabhängig vom Personalisierungs-Schalter).
      // findPersonalizedCheckout prüft selbst, ob die Route mit den Pfeilen erreichbar ist.
      if (dbPlayer.favoriteDouble) {
        prof = prof || {};
        if ((prof[dbPlayer.favoriteDouble] || 0) < 0.99) prof[dbPlayer.favoriteDouble] = 0.99;
      }
      p.doubleProfile = prof;
    }
  }

  // Doppel/Team: jedes Team ist eine Scoring-Einheit mit Mitgliedern; die Mitglieder
  // werfen abwechselnd (memberIdx). Detailstatistik wird je Mitglied geführt.
  if (Array.isArray(config.teams) && config.teams.length >= 2) {
    roster = config.teams.map((team, ti) => {
      const members = (team.members || []).map((mp) => ({
        id: mp.id,
        dbId: mp.dbId ?? (Number.isInteger(mp.id) ? mp.id : null),
        name: mp.name,
        dartId: Number.isInteger(mp.dartId) ? mp.dartId : null,
        checkoutMode: ['single', 'master'].includes(mp.checkoutMode) ? mp.checkoutMode : 'double',
        stats: emptyStats(),
        dartsThrown: 0,
        pointsScored: 0,
        voice: null,
        doubleProfile: null,
      }));
      // teamCheckout: 'double'|'single'|'master' (für alle gleich) oder 'individual' (je Spieler eigener Modus).
      const teamCheckout = ['single', 'master', 'individual'].includes(team.checkoutMode) ? team.checkoutMode : 'double';
      const cMode = teamCheckout === 'individual' ? (members[0] ? members[0].checkoutMode : 'double') : teamCheckout;
      return {
        id: `t${ti}`,
        dbId: null,
        name: team.name && team.name.trim() ? team.name.trim() : members.map((m) => m.name).join(' & '),
        type: 'team',
        botLevel: null,
        color: team.color || null,
        checkoutMode: cMode,
        teamCheckout,
        members,
        memberIdx: 0,
        score: startScore,
        opened: checkIn !== 'double',
        legsWon: 0,
        setsWon: 0,
        legsWonTotal: 0,
        dartsThrown: 0,
        pointsScored: 0,
        legDarts: 0,
        legPoints: 0,
        visitsThisLeg: 0,
        currentTurn: [],
        lastTurnDarts: [],
        turnPoints: 0,
        lastVisitScore: 0,
        turnStartScore: startScore,
        stats: members[0] ? members[0].stats : emptyStats(),
        doubleProfile: null,
      };
    });
    for (const team of roster) {
      for (const m of team.members) {
        if (m.dbId == null) continue;
        const dbPlayer = playerStore.get(m.dbId);
        if (!dbPlayer) continue;
        m.voice = dbPlayer.voice || null;
        const effMode = team.teamCheckout === 'individual' ? m.checkoutMode : team.teamCheckout;
        if (effMode === 'double') {
          let prof = dbPlayer.personalizeCheckout ? doubleProfile.getPlayerDoubleProfile(m.dbId) : null;
          if (dbPlayer.favoriteDouble) {
            prof = prof || {};
            if ((prof[dbPlayer.favoriteDouble] || 0) < 0.99) prof[dbPlayer.favoriteDouble] = 0.99;
          }
          m.doubleProfile = prof;
        }
      }
      if (team.members[0]) team.doubleProfile = team.members[0].doubleProfile;
    }
  }

  if (randomOrder) roster = shuffle(roster);

  const OUT_LABELS = { double: 'Double', single: 'Single', master: 'Master' };
  const effModes = [];
  for (const p of roster) {
    if (p.members && p.teamCheckout === 'individual') for (const m of p.members) effModes.push(m.checkoutMode);
    else effModes.push(p.checkoutMode);
  }
  const distinctOut = [...new Set(effModes)];
  const outLabel =
    (distinctOut.length === 1 ? OUT_LABELS[distinctOut[0]] || 'Double' : distinctOut.map((m) => OUT_LABELS[m] || m).join('/')) +
    ' Out';
  const game = {
    id: randomUUID(),
    mode,
    startScore,
    checkIn,
    format,
    maxRounds: Number.isFinite(maxRounds) ? maxRounds : 20,
    inputMode: ['sum', 'board'].includes(config.inputMode) ? config.inputMode : 'numpad',
    training: config.training === true,
    isTeams: Array.isArray(config.teams) && config.teams.length >= 2,
    checkoutLabel: `${mode}, ${outLabel}, ${format.label}`,
    players: roster,
    currentPlayerIndex: 0,
    legStarterIndex: 0,
    legNumber: 1,
    setNumber: 1,
    roundNumber: 1,
    turnsThisLeg: 0,
    awaitingBullOff: false,
    status: 'playing',
    winnerId: null,
    message: null,
    messagePlayer: null,
    messageSeq: 0,
    tournamentId,
    meta,
    statsRecorded: false,
    undoStack: [],
    visitLog: [],
    matchPoint: {},
  };
  updatePressureFlags(game);
  return game;
}

function snapshot(game) {
  return JSON.stringify({
    players: game.players,
    currentPlayerIndex: game.currentPlayerIndex,
    legStarterIndex: game.legStarterIndex,
    legNumber: game.legNumber,
    setNumber: game.setNumber,
    roundNumber: game.roundNumber,
    turnsThisLeg: game.turnsThisLeg,
    awaitingBullOff: game.awaitingBullOff,
    status: game.status,
    winnerId: game.winnerId,
    message: game.message,
    messagePlayer: game.messagePlayer,
    visitLogLen: game.visitLog.length,
  });
}

function pushUndo(game) {
  game.undoStack.push(snapshot(game));
  if (game.undoStack.length > UNDO_LIMIT) game.undoStack.shift();
}

// Verlinkt bei Team-Spielern die aktive Stats-/Doppelprofil-Referenz auf das
// aktuell werfende Mitglied. Nötig nach jedem Laden/Undo (JSON kopiert Referenzen).
function relinkTeam(p) {
  if (p && p.members && p.members.length) {
    const m = p.members[p.memberIdx % p.members.length];
    p.stats = m.stats;
    p.doubleProfile = m.doubleProfile;
    if (p.teamCheckout === 'individual') {
      p.checkoutMode = ['single', 'master'].includes(m.checkoutMode) ? m.checkoutMode : 'double';
    }
  }
}
function relinkAll(game) {
  for (const p of game.players) relinkTeam(p);
}
function activeThrower(p) {
  return p && p.members && p.members.length ? p.members[p.memberIdx % p.members.length] : p;
}

function beginTurn(player) {
  player.currentTurn = [];
  player.turnPoints = 0;
  player.turnStartScore = player.score;
  relinkTeam(player);
}

// --- Statistik-Helfer ---
function sectorKey(d) {
  if (!d || d.segment === 0) return '0';
  if (d.multiplier === 2) return 'D' + d.segment;
  if (d.multiplier === 3) return 'T' + d.segment;
  return String(d.segment);
}
function isOnDouble(rem) {
  return (rem >= 2 && rem <= 40 && rem % 2 === 0) || rem === 50;
}
// Steht ein Spieler vor dem kommenden Leg am Matchdart (ein Leg vom Matchgewinn entfernt)?
function onMatchPoint(game, p) {
  const f = game.format;
  if (!f.setsToWin || f.setsToWin <= 0 || !f.legsPerSet) return false;
  return p.setsWon === f.setsToWin - 1 && p.legsWon === f.legsPerSet - 1;
}
// Shanghai in einer Aufnahme: Single, Double und Triple derselben Zahl (1–20).
function detectShanghai(p) {
  const bySeg = {};
  for (const d of p.currentTurn) {
    if (d.segment >= 1 && d.segment <= 20) {
      (bySeg[d.segment] = bySeg[d.segment] || new Set()).add(d.multiplier);
    }
  }
  for (const seg in bySeg) {
    const m = bySeg[seg];
    if (m.has(1) && m.has(2) && m.has(3)) {
      p.stats.shanghai = (p.stats.shanghai || 0) + 1;
      break;
    }
  }
}
// Hängt eine abgeschlossene Aufnahme an den Match-Verlauf (für die Historie/Wiederansicht).
// Obergrenze für den mitpersistierten Aufnahme-Verlauf. Reale best-of-Spiele
// bleiben weit darunter; greift v. a. bei „Unbegrenzt"-/Marathon-Sessions, um die
// pro Wurf serialisierte Zustandsgröße zu begrenzen. seq ist ein monotoner Zähler,
// bleibt also auch nach dem Abschneiden alter Einträge eindeutig und geordnet.
const VISIT_LOG_MAX = 500;
function logVisit(game, p, darts, score, remaining, kind) {
  if (!Array.isArray(game.visitLog)) game.visitLog = [];
  if (game.visitSeq == null) game.visitSeq = game.visitLog.length;
  game.visitSeq += 1;
  const thrower = activeThrower(p);
  game.visitLog.push({
    seq: game.visitSeq,
    playerId: thrower.dbId ?? null,
    name: thrower.name,
    setNo: game.setNumber,
    legNo: game.legNumber,
    roundNo: game.roundNumber,
    darts: (darts || []).map((d) => ({ segment: d.segment, multiplier: d.multiplier, label: rules.dartLabel(d) })),
    score,
    remaining,
    kind,
  });
  if (game.visitLog.length > VISIT_LOG_MAX) game.visitLog.shift();
}
// Merkt sich je Team/Leg, welche Mitglieder geworfen haben und wer ein 180er warf
// (für die Team-Achievements „gemeinsames 180er-Leg" und „Partner-Checkout").
function markTeamVisit(p, score) {
  if (!p.members || !p.members.length) return;
  const mi = p.memberIdx % p.members.length;
  p._legThrowers = p._legThrowers || {};
  p._legThrowers[mi] = true;
  if (score >= 180) {
    p._leg180 = p._leg180 || {};
    p._leg180[mi] = true;
  }
}

// Checkout-Erfolg je Rest-Bereich + „unter Druck" (Entscheidungs-Leg) erfassen.
function coBucket(rest) {
  if (rest <= 40) return '2-40';
  if (rest <= 70) return '41-70';
  if (rest <= 100) return '71-100';
  return '101-170';
}
function noteFinishAttempt(p, made) {
  const rest = p.turnStartScore;
  if (!(rest >= 2 && rest <= 170)) return;
  if (!rules.findCheckout(rest, p.checkoutMode, 3)) return; // war kein finishbarer Rest
  const cr = p.stats.checkoutRanges || (p.stats.checkoutRanges = {});
  const bump = (key) => {
    const e = cr[key] || (cr[key] = { h: 0, a: 0 });
    e.a += 1;
    if (made) e.h += 1;
  };
  bump(coBucket(rest));
  if (p.pressureLeg) bump('pressure');
}

// Erkennt Aufnahme-Kuriositäten & Serien für Achievements (schreibt in p.stats,
// bei Teams via relink ins aktive Mitglied).
function noteVisitQuirks(p) {
  const st = p.stats;
  const total = p.turnPoints;
  const darts = p.currentTurn || [];
  if (total === 180) {
    st.streak180 = (st.streak180 || 0) + 1;
    if (st.streak180 >= 2) st.twoInRow180 = 1;
  } else {
    st.streak180 = 0;
  }
  if (total === 26) st.bedBreakfast = 1; // „Bed & Breakfast" (Aufnahme = 26)
  if (total === 0 && darts.length >= 3) st.nuller = 1; // 3 Darts, kein Punkt
  if (darts.length >= 3 && darts.every((d) => d.segment > 0 && d.segment === darts[0].segment)) st.threeInBed = 1;
}

// Verbucht eine abgeschlossene Aufnahme (Visit) in die Spieler-Statistik.
function recordVisit(p, visitDarts) {
  p.visitsThisLeg += 1;
  const score = p.turnPoints;
  const st = p.stats;
  if (score === 180) st.s180 += 1;
  else if (score >= 140) st.s140 += 1;
  else if (score >= 100) st.s100 += 1;
  else if (score >= 60) st.s60 += 1;
  if (score > st.maxTurn) st.maxTurn = score;
  if (p.visitsThisLeg <= 3) {
    st.first9Points += score;
    st.first9Darts += visitDarts;
  }
  markTeamVisit(p, score);
}

function endTurn(game, { recordStats = true } = {}) {
  const p = game.players[game.currentPlayerIndex];
  if (recordStats) {
    recordVisit(p, p.currentTurn.length);
    p.lastTurnDarts = p.currentTurn.slice();
  } else {
    // Freitext-Summe: keine Wurf-Details -> keine Einzelwürfe darstellbar
    p.lastTurnDarts = [];
  }
  noteFinishAttempt(p, false);
  p.lastVisitScore = p.turnPoints;
  p.currentTurn = [];
  p.turnPoints = 0;

  // Team: nach abgeschlossener Aufnahme rotiert der Werfer innerhalb des Teams.
  if (p.members && p.members.length) p.memberIdx = (p.memberIdx + 1) % p.members.length;

  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  game.turnsThisLeg += 1;
  game.roundNumber = Math.floor(game.turnsThisLeg / game.players.length) + 1;
  beginTurn(game.players[game.currentPlayerIndex]);

  if (
    game.maxRounds > 0 &&
    game.turnsThisLeg >= game.maxRounds * game.players.length &&
    game.status === 'playing'
  ) {
    game.awaitingBullOff = true;
    game.message = 'BULLOFF';
    game.messagePlayer = null;
    game.messageSeq = (game.messageSeq || 0) + 1;
  }
}

// Setzt je Scoring-Einheit das Druck-Flag: gewinnt sie DIESES Leg, gewinnt sie den
// aktuellen Satz (und damit ggf. das Match) -> Entscheidungs-Leg.
function updatePressureFlags(game) {
  const lps = game.format.legsPerSet;
  for (const p of game.players) p.pressureLeg = lps > 0 && p.legsWon === lps - 1;
}

function startNewLeg(game) {
  game.legNumber += 1;
  for (const p of game.players) {
    p.score = game.startScore;
    p.opened = game.checkIn !== 'double';
    p.currentTurn = [];
    p.lastTurnDarts = [];
    p.turnPoints = 0;
    p.lastVisitScore = 0;
    p.turnStartScore = game.startScore;
    p.legDarts = 0;
    p.legPoints = 0;
    p.visitsThisLeg = 0;
  }
  for (const p of game.players) {
    if (p.members) {
      p._legThrowers = {};
      p._leg180 = {};
    }
  }
  game.legStarterIndex = (game.legStarterIndex + 1) % game.players.length;
  game.currentPlayerIndex = game.legStarterIndex;
  game.roundNumber = 1;
  game.turnsThisLeg = 0;
  game.awaitingBullOff = false;
  updatePressureFlags(game);
}

function handleLegWin(game, winner, { viaCheckout = true, recordStats = true } = {}) {
  const throwerName = activeThrower(winner) ? activeThrower(winner).name : winner.name;
  const throwerStatsRef = activeThrower(winner) ? activeThrower(winner).stats : winner.stats;
  const coScore = winner.turnPoints;
  if (viaCheckout && recordStats) {
    // Finish-Aufnahme + Checkout-Kennzahlen verbuchen
    recordVisit(winner, winner.currentTurn.length);
    const co = winner.turnPoints;
    if (co > winner.stats.maxCheckout) winner.stats.maxCheckout = co;
    if (winner.stats.minDartsLeg == null || winner.legDarts < winner.stats.minDartsLeg) {
      winner.stats.minDartsLeg = winner.legDarts;
    }
    winner.lastTurnDarts = winner.currentTurn.slice();
    winner.currentTurn = [];
  } else if (viaCheckout) {
    // Freitext-Checkout: keine Wurf-Statistik erfassen
    winner.lastTurnDarts = [];
    winner.currentTurn = [];
  }
  if (viaCheckout) noteFinishAttempt(winner, true);
  winner.lastVisitScore = winner.turnPoints;
  if (winner.members && winner.members.length) winner.memberIdx = (winner.memberIdx + 1) % winner.members.length;
  winner.legsWon += 1;
  winner.legsWonTotal += 1;
  game.message = viaCheckout ? 'CHECKOUT' : 'BULLOFF_WIN';
  game.messagePlayer = throwerName;
  game.messageSeq = (game.messageSeq || 0) + 1;
  game.awaitingBullOff = false;

  // Checkout-Serie: aufeinanderfolgende per Finish gewonnene Legs.
  if (viaCheckout) {
    winner.stats.coStreak = (winner.stats.coStreak || 0) + 1;
    if (winner.stats.coStreak > (winner.stats.coStreakMax || 0)) winner.stats.coStreakMax = winner.stats.coStreak;
  } else {
    winner.stats.coStreak = 0;
  }
  for (const p of game.players) if (p !== winner) p.stats.coStreak = 0;

  // Team-Achievements dieses Legs (vor dem Leg-Reset auswerten).
  for (const tp of game.players) {
    if (!tp.members || tp.members.length < 2) continue;
    tp.teamAch = tp.teamAch || {};
    const l180 = tp._leg180 || {};
    if (tp.members.every((_, i) => l180[i])) tp.teamAch.oneEightyLeg = true;
  }
  if (viaCheckout && winner.members && winner.members.length >= 2) {
    const throwers = winner._legThrowers || {};
    if (Object.keys(throwers).length >= 2) {
      winner.teamAch = winner.teamAch || {};
      winner.teamAch.partnerCo = true;
      winner.teamAch.partnerCoCount = (winner.teamAch.partnerCoCount || 0) + 1;
    }
  }

  game.matchPoint = game.matchPoint || {};

  // Unbegrenzt (legsPerSet === 0): kein Satz-/Spielende -> immer neues Leg.
  if (game.format.legsPerSet > 0 && winner.legsWon >= game.format.legsPerSet) {
    // Zu-Null-Satz (nur sinnvoll ab 2 Legs pro Satz).
    if (game.format.legsPerSet >= 2 && game.players.every((p) => p === winner || p.legsWon === 0)) {
      winner.stats.cleanSet = (winner.stats.cleanSet || 0) + 1;
    }
    winner.setsWon += 1;
    for (const p of game.players) p.legsWon = 0;

    if (game.format.setsToWin > 0 && winner.setsWon >= game.format.setsToWin) {
      // Comeback: war zuvor ein Gegner bereits am Matchdart?
      if (game.players.some((p) => p !== winner && game.matchPoint[p.id])) {
        winner.stats.comeback = (winner.stats.comeback || 0) + 1;
      }
      if (viaCheckout && coScore >= 100) throwerStatsRef.clutchFinish = 1; // Match mit 100+-Checkout beendet
      game.status = 'finished';
      game.winnerId = winner.id;
      return;
    }
    game.setNumber += 1;
  }

  // Matchdart-Status fürs kommende Leg merken (für das Comeback-Achievement).
  for (const p of game.players) {
    if (onMatchPoint(game, p)) game.matchPoint[p.id] = true;
  }
  startNewLeg(game);
}

function applyDart(game, dart) {
  if (game.status !== 'playing' || game.awaitingBullOff) return game;
  if (!rules.isValidDart(dart)) {
    throw new Error(`Ungültiger Dart: ${JSON.stringify(dart)}`);
  }
  relinkAll(game);

  pushUndo(game);
  game.message = null;
  game.messagePlayer = null;

  const p = game.players[game.currentPlayerIndex];
  const m = p.members ? activeThrower(p) : null;
  const scoreBefore = p.score;

  // Checkout-Versuch (Dart auf ein finishendes Doppel)?
  if (p.checkoutMode === 'double' && isOnDouble(scoreBefore)) {
    p.stats.doubleAttempts += 1;
    const targetDouble = scoreBefore === 50 ? 'Bull' : 'D' + scoreBefore / 2;
    const ds = p.stats.doubleStats[targetDouble] || (p.stats.doubleStats[targetDouble] = { attempts: 0, hits: 0 });
    ds.attempts += 1;
    if (rules.dartLabel(dart) === targetDouble) ds.hits += 1;
  }

  p.currentTurn.push(dart);
  p.dartsThrown += 1;
  if (m) m.dartsThrown += 1;
  p.legDarts += 1;

  // Sektor + Doppel/Triple
  const key = sectorKey(dart);
  p.stats.sectors[key] = (p.stats.sectors[key] || 0) + 1;
  if (dart.multiplier === 2) p.stats.doubles += 1;
  else if (dart.multiplier === 3) p.stats.triples += 1;

  const res = rules.applyDartToScore(p.score, dart, {
    checkIn: game.checkIn,
    checkoutMode: p.checkoutMode,
    alreadyOpened: p.opened,
  });
  if (res.opened) p.opened = true;

  if (res.bust) {
    p.pointsScored -= p.turnPoints;
    if (m) m.pointsScored -= p.turnPoints;
    p.legPoints -= p.turnPoints;
    p.score = p.turnStartScore;
    p.turnPoints = 0;
    game.message = 'BUST';
    game.messagePlayer = activeThrower(p).name;
    game.messageSeq = (game.messageSeq || 0) + 1;
    logVisit(game, p, p.currentTurn, 0, p.score, 'bust');
    endTurn(game);
    return game;
  }

  const scored = scoreBefore - res.remaining;
  p.score = res.remaining;
  p.turnPoints += scored;
  p.pointsScored += scored;
  if (m) m.pointsScored += scored;
  p.legPoints += scored;

  if (res.checkout) {
    if (rules.dartLabel(dart) === 'Bull') p.stats.bullCheckouts = (p.stats.bullCheckouts || 0) + 1;
    if (p.currentTurn.filter((d) => d.segment === 25).length >= 2) p.stats.bullBullFinish = 1;
    if (rules.dartLabel(dart) === 'D1') p.stats.madhouse = 1; // Finish auf Doppel 1
    detectShanghai(p);
    logVisit(game, p, p.currentTurn, p.turnPoints, 0, 'checkout');
    handleLegWin(game, p, { viaCheckout: true });
    return game;
  }

  if (p.currentTurn.length >= 3) {
    detectShanghai(p);
    noteVisitQuirks(p);
    logVisit(game, p, p.currentTurn, p.turnPoints, p.score, 'visit');
    endTurn(game);
  }
  return game;
}

// Mit drei Darts nicht erreichbare Aufnahme-Summen (Freitext-Validierung).
const IMPOSSIBLE_SUMS = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

/**
 * Trägt eine komplette Aufnahme als Summe ein (Freitext-Modus).
 * Für den Ø wird je Aufnahme mit 3 Pfeilen gerechnet; beim Checkout wird die
 * tatsächliche Pfeilzahl (1–3) übergeben. Wurf-DETAILS (Doppel/Triple/Sektor/
 * 60+…180/Checkout-Quote) werden NICHT erfasst – aus einer Summe nicht ableitbar.
 */
function applyVisitSum(game, sum, checkoutDarts) {
  if (game.status !== 'playing' || game.awaitingBullOff) return game;
  if (!Number.isInteger(sum) || sum < 0 || sum > 180 || IMPOSSIBLE_SUMS.has(sum)) {
    throw new Error(`Ungültige Aufnahme-Summe: ${sum}`);
  }

  relinkAll(game);
  pushUndo(game);
  game.message = null;
  game.messagePlayer = null;

  const p = game.players[game.currentPlayerIndex];
  const m = p.members ? activeThrower(p) : null;
  const scoreBefore = p.score;

  // Double-In lässt sich per Summe nicht prüfen -> jede Aufnahme > 0 eröffnet.
  if (game.checkIn === 'double' && !p.opened && sum > 0) p.opened = true;

  const remaining = scoreBefore - sum;

  // Checkout: Doppel nicht verifizierbar -> akzeptiert. Pfeilzahl (1–3) fürs Ø.
  if (remaining === 0) {
    const darts = Math.min(Math.max(parseInt(checkoutDarts, 10) || 3, 1), 3);
    p.dartsThrown += darts;
    if (m) m.dartsThrown += darts;
    p.legDarts += darts;
    p.pointsScored += sum;
    if (m) m.pointsScored += sum;
    p.legPoints += sum;
    p.turnPoints = sum;
    markTeamVisit(p, sum);
    logVisit(game, p, [], sum, 0, 'checkout');
    handleLegWin(game, p, { viaCheckout: true, recordStats: false });
    return game;
  }

  // Bust: überworfen oder (Double-Out) Rest = 1. Pfeile zählen trotzdem (3 angenommen).
  if (remaining < 0 || (p.checkoutMode === 'double' && remaining === 1)) {
    p.dartsThrown += 3;
    if (m) m.dartsThrown += 3;
    p.legDarts += 3;
    p.score = scoreBefore;
    p.turnPoints = 0;
    game.message = 'BUST';
    game.messagePlayer = activeThrower(p).name;
    game.messageSeq = (game.messageSeq || 0) + 1;
    logVisit(game, p, [], 0, scoreBefore, 'bust');
    endTurn(game, { recordStats: false });
    return game;
  }

  // Reguläre Aufnahme: 3 Pfeile annehmen; Punkte fürs Ø erfassen, keine Detailstatistik.
  if (sum === 180) {
    p.stats.streak180 = (p.stats.streak180 || 0) + 1;
    if (p.stats.streak180 >= 2) p.stats.twoInRow180 = 1;
  } else {
    p.stats.streak180 = 0;
  }
  if (sum === 26) p.stats.bedBreakfast = 1;
  if (sum === 0) p.stats.nuller = 1;
  p.dartsThrown += 3;
  if (m) m.dartsThrown += 3;
  p.legDarts += 3;
  p.pointsScored += sum;
  if (m) m.pointsScored += sum;
  p.legPoints += sum;
  p.score = remaining;
  p.turnPoints = sum;
  markTeamVisit(p, sum);
  logVisit(game, p, [], sum, remaining, 'visit');
  endTurn(game, { recordStats: false });
  return game;
}

function undo(game) {
  if (game.undoStack.length === 0) return game;
  const snap = JSON.parse(game.undoStack.pop());
  const len = snap.visitLogLen;
  delete snap.visitLogLen;
  Object.assign(game, snap);
  if (typeof len === 'number' && Array.isArray(game.visitLog)) game.visitLog.length = len;
  return game;
}

function resolveBullOff(game, winnerId) {
  if (!game.awaitingBullOff || game.status !== 'playing') return game;
  relinkAll(game);
  const winner = game.players.find((p) => p.id === winnerId);
  if (!winner) throw new Error('Unbekannter Spieler für Ausbullen.');
  pushUndo(game);
  logVisit(game, winner, [], 0, winner.score, 'bulloff');
  handleLegWin(game, winner, { viaCheckout: false });
  return game;
}

function playBotTurn(game) {
  const startIdx = game.currentPlayerIndex;
  const bot = game.players[startIdx];
  if (!bot || bot.type !== 'bot' || game.status !== 'playing' || game.awaitingBullOff) return game;

  let guard = 0;
  while (
    game.status === 'playing' &&
    !game.awaitingBullOff &&
    game.currentPlayerIndex === startIdx &&
    guard < 3
  ) {
    const p = game.players[startIdx];
    let targetAvg;
    if (p.botLevel === 'adaptive') {
      const humanAvgs = game.players
        .filter((q) => q.type !== 'bot' && q.dartsThrown > 0)
        .map(matchAverage);
      const live = humanAvgs.length
        ? Math.max(...humanAvgs)
        : Number.isFinite(p.adaptiveBase)
        ? p.adaptiveBase
        : 50;
      const push = p.adaptivePush ? 6 : 0;
      targetAvg = Math.max(20, Math.min(95, live + push));
    }
    const dart = botAI.chooseDart({
      score: p.score,
      checkoutMode: p.checkoutMode,
      checkIn: game.checkIn,
      opened: p.opened,
      dartsThrownThisTurn: p.currentTurn.length,
      level: p.botLevel,
      targetAvg,
    });
    applyDart(game, dart);
    guard += 1;
  }
  return game;
}

function matchAverage(p) {
  if (!p.dartsThrown) return 0;
  return Math.round((p.pointsScored / p.dartsThrown) * 3 * 100) / 100;
}

/**
 * Beendet ein Unbegrenzt-Spiel manuell und wertet es: Sieger ist, wer die
 * meisten Legs gewonnen hat (bei Gleichstand der höhere Ø). Danach wird das
 * Ergebnis wie ein normal beendetes Spiel in die Statistik übernommen.
 */
function endUnlimited(game) {
  if (game.status !== 'playing' || game.format.satzLegMode !== 'unlimited') return game;
  pushUndo(game);
  let winner = null;
  for (const p of game.players) {
    if (
      !winner ||
      p.legsWonTotal > winner.legsWonTotal ||
      (p.legsWonTotal === winner.legsWonTotal && matchAverage(p) > matchAverage(winner))
    ) {
      winner = p;
    }
  }
  game.awaitingBullOff = false;
  game.status = 'finished';
  game.winnerId = winner ? winner.id : null;
  game.message = null;
  game.messagePlayer = null;
  return game;
}

function toClient(game) {
  relinkAll(game);
  const players = game.players.map((p, idx) => {
    const active = idx === game.currentPlayerIndex && game.status === 'playing' && !game.awaitingBullOff;
    const memIdx = p.members && p.members.length ? p.memberIdx % p.members.length : 0;
    const members = p.members
      ? p.members.map((mm, mi) => ({
          dbId: mm.dbId ?? null,
          name: mm.name,
          checkoutMode: mm.checkoutMode || 'double',
          average: matchAverage(mm),
          active: active && mi === memIdx,
        }))
      : null;
    return {
      id: p.id,
      dbId: p.dbId ?? null,
      name: p.name,
      type: p.type,
      botLevel: p.botLevel,
      checkoutMode: p.checkoutMode,
      voice: (members ? p.members[memIdx].voice : p.voice) ?? null,
      isTeam: !!p.members,
      teamColor: p.color || null,
      teamCheckout: p.teamCheckout || null,
      members,
      activeMember: p.members ? p.members[memIdx].name : null,
      score: p.score,
      opened: p.opened,
      legsWon: p.legsWon,
      setsWon: p.setsWon,
      dartsThrown: p.legDarts,
      average: matchAverage(p),
      currentTurn: p.currentTurn.map((d) => ({ ...d, label: rules.dartLabel(d) })),
      lastTurnDarts: p.lastTurnDarts.map((d) => ({ ...d, label: rules.dartLabel(d) })),
      turnScore: p.turnPoints,
      lastVisitScore: p.lastVisitScore || 0,
      isActive: active,
    };
  });

  const current = game.players[game.currentPlayerIndex];
  // Nur Routen vorschlagen, die mit den im aktuellen Zug verbleibenden Pfeilen erreichbar sind.
  const dartsRemaining = current ? Math.max(1, 3 - current.currentTurn.length) : 3;
  const checkout =
    current && game.status === 'playing' && !game.awaitingBullOff
      ? current.doubleProfile
        ? rules.findPersonalizedCheckout(current.score, current.checkoutMode, current.doubleProfile, dartsRemaining)
        : (() => {
            const route = rules.findCheckout(current.score, current.checkoutMode, dartsRemaining);
            return route ? { route, personalized: false } : null;
          })()
      : null;
  // Master-Out: immer auch die klassische Doppel-Route als Alternative anbieten.
  if (checkout && current && current.checkoutMode === 'master') {
    const altDouble = rules.findCheckout(current.score, 'double', dartsRemaining);
    if (altDouble && altDouble.join(' ') !== checkout.route.join(' ')) checkout.altRoute = altDouble;
  }

  // Infobox für die Anzeigetafel bei 3+ Spielern.
  let castInfo = null;
  if (game.players.length >= 3) {
    let gameTop = { score: 0, name: null };
    let mostMiss = { count: 0, name: null };
    for (const p of game.players) {
      const mt = (p.stats && p.stats.maxTurn) || 0;
      if (mt > gameTop.score) gameTop = { score: mt, name: p.name };
      const miss = (p.stats && p.stats.sectors && p.stats.sectors['0']) || 0;
      if (miss > mostMiss.count) mostMiss = { count: miss, name: p.name };
    }
    let roundTop = { score: 0, name: null };
    const vlog = Array.isArray(game.visitLog) ? game.visitLog : [];
    for (const v of vlog) {
      if (
        v.setNo === game.setNumber &&
        v.legNo === game.legNumber &&
        v.roundNo === game.roundNumber &&
        (v.score || 0) > roundTop.score
      ) {
        roundTop = { score: v.score, name: v.name };
      }
    }
    castInfo = { roundTop, gameTop, mostMiss };
  }

  return {
    id: game.id,
    mode: game.mode,
    startScore: game.startScore,
    checkIn: game.checkIn,
    format: game.format,
    maxRounds: game.maxRounds,
    inputMode: game.inputMode || 'numpad',
    checkoutLabel: game.checkoutLabel,
    players,
    currentPlayerIndex: game.currentPlayerIndex,
    legNumber: game.legNumber,
    setNumber: game.setNumber,
    roundNumber: game.roundNumber,
    awaitingBullOff: game.awaitingBullOff,
    status: game.status,
    winnerId: game.winnerId,
    message: game.message,
    messagePlayer: game.messagePlayer,
    messageSeq: game.messageSeq || 0,
    tournamentId: game.tournamentId,
    meta: game.meta || {},
    checkoutSuggestion: checkout,
    dartsRemaining,
    castInfo,
    achievementsEarned: Object.entries(game.achievementsEarned || {})
      .map(([dbId, ids]) => {
        let pl = game.players.find((p) => String(p.dbId) === String(dbId));
        let playerName = pl ? pl.name : '';
        if (!pl) {
          for (const tp of game.players) {
            if (!tp.members) continue;
            const mm = tp.members.find((x) => String(x.dbId) === String(dbId));
            if (mm) { playerName = mm.name; break; }
          }
        }
        return {
          playerId: Number(dbId),
          playerName,
          items: (ids || []).map((aid) => {
            const a = ACH_BY_ID.get(aid);
            return { id: aid, name: a ? a.name : aid, nameEn: a ? a.nameEn : aid, icon: a ? a.icon : '🎯' };
          }),
        };
      })
      .filter((e) => e.items.length > 0),
    canUndo: game.undoStack.length > 0,
  };
}

module.exports = {
  createGame,
  applyDart,
  applyVisitSum,
  endUnlimited,
  undo,
  resolveBullOff,
  playBotTurn,
  toClient,
  resolveFormat,
  threeDartAverage: matchAverage,
};
