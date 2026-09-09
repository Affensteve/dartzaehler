'use strict';

// Party-Engine (Stufe 4): eigenständige Mehrspieler-Modi mit Server-Spielstate,
// getrennt von der X01-Engine. Modi: Killer, Baseball, Golf sowie die Wettkampf-
// Trainings Shanghai, Around the Clock (Wettlauf) und Halve-it.
// Zug-Modell: jeder aktive Spieler wirft bis zu 3 Darts; danach ist der Nächste dran.
// Bei Rundenende (alle aktiven Spieler durch) erhöht sich roundNumber (Inning/Loch/Runde).

const { randomUUID } = require('crypto');

const KILLER_LIVES = 3;
const BASEBALL_INNINGS = 9;
const GOLF_HOLES = 18;
const SHANGHAI_ROUNDS = 7;
const HALVEIT_SEQ = [15, 16, 17, 18, 19, 20, 25];
const HALVEIT_START = 40;
const UNDO_CAP = 60;

const PARTY_MODES = ['killer', 'baseball', 'golf', 'shanghai', 'clock', 'halveit'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function label(d) {
  if (!d || d.segment === 0) return '–';
  if (d.segment === 25) return d.multiplier === 2 ? 'Bull' : '25';
  return (d.multiplier === 2 ? 'D' : d.multiplier === 3 ? 'T' : '') + d.segment;
}

function createGame(config) {
  const mode = PARTY_MODES.includes(config.partyMode) ? config.partyMode : 'killer';
  const players = (Array.isArray(config.players) ? config.players : []).map((p) => ({
    id: p.id || randomUUID(),
    dbId: Number.isInteger(p.dbId) ? p.dbId : Number.isInteger(p.id) ? p.id : null,
    name: p.name || 'Spieler',
    type: p.type === 'bot' ? 'bot' : 'human',
    // Killer
    target: null,
    armed: false,
    lives: KILLER_LIVES,
    // Baseball
    runs: 0,
    // Golf
    strokes: 0,
    holeStrokes: null,
    holeDone: false,
    // Shanghai / Halve-it
    score: 0,
    hitRound: false,
    // Around the Clock (Wettlauf)
    nextTarget: 1,
    eliminated: false,
  }));
  if (players.length < 2) throw new Error('Ein Party-Spiel benötigt mindestens 2 Spieler.');

  if (mode === 'killer') {
    const nums = shuffle(Array.from({ length: 20 }, (_, i) => i + 1)).slice(0, players.length);
    players.forEach((p, i) => {
      p.target = nums[i];
    });
  }
  if (mode === 'halveit') players.forEach((p) => (p.score = HALVEIT_START));

  return {
    id: randomUUID(),
    partyMode: mode,
    status: 'playing',
    players,
    currentPlayerIndex: 0,
    roundNumber: 1, // Killer: Runde, Baseball: Inning, Golf: Loch
    turnsThisRound: 0,
    turnDarts: [],
    winnerId: null,
    message: null,
    messageSeq: 0,
    partyFlags: { killerArmed: [], baseballSlam: [], golfBirdie: [], golfUnderPar: [], clockBlitz: [], baseballBig: [] },
    undoStack: [],
    createdAt: Date.now(),
  };
}

function current(game) {
  return game.players[game.currentPlayerIndex];
}

function activeCount(game) {
  return game.players.filter((p) => !p.eliminated).length;
}

function pushUndo(game) {
  const snap = JSON.stringify({ ...game, undoStack: [] });
  game.undoStack.push(snap);
  if (game.undoStack.length > UNDO_CAP) game.undoStack.shift();
}

function setMsg(game, msg) {
  game.message = msg;
  game.messageSeq = (game.messageSeq || 0) + 1;
}

function finish(game, winner) {
  game.status = 'finished';
  game.winnerId = winner ? winner.id : null;
  setMsg(game, 'FINISH');
}

// Nächsten aktiven Spieler bestimmen; bei Rundenende Runde erhöhen.
function endTurn(game) {
  game.turnDarts = [];
  game.turnsThisRound += 1;
  const active = activeCount(game);
  let guard = 0;
  do {
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    guard += 1;
  } while (game.players[game.currentPlayerIndex].eliminated && guard <= game.players.length);

  if (game.turnsThisRound >= active) {
    game.turnsThisRound = 0;
    if (game.partyMode === 'halveit') {
      // Wer in der Runde nichts getroffen hat, dessen Punktzahl wird halbiert.
      for (const p of game.players) {
        if (!p.hitRound) p.score = Math.floor(p.score / 2);
        p.hitRound = false;
      }
    }
    game.roundNumber += 1;
    if (game.partyMode === 'golf') {
      for (const p of game.players) {
        p.holeDone = false;
        p.holeStrokes = null;
      }
    }
  }
}

function applyKiller(game, p, seg, mult) {
  const flags = game.partyFlags;
  if (!p.armed) {
    // Eigenes Feld mit einem Doppel scharfschalten.
    if (seg === p.target && mult === 2) {
      p.armed = true;
      if (p.dbId != null && !flags.killerArmed.includes(p.dbId)) flags.killerArmed.push(p.dbId);
      setMsg(game, `${p.name} ist scharf!`);
    }
    return;
  }
  if (seg === p.target) {
    // Eigenes Feld getroffen: Selbstschaden.
    p.lives = Math.max(0, p.lives - mult);
    if (p.lives === 0) p.eliminated = true;
    return;
  }
  // Gegner mit diesem Zielfeld verlieren Leben (Single 1, Double 2, Triple 3).
  for (const v of game.players) {
    if (v === p || v.eliminated) continue;
    if (v.target === seg) {
      v.lives = Math.max(0, v.lives - mult);
      if (v.lives === 0) {
        v.eliminated = true;
        setMsg(game, `${v.name} ausgeschieden!`);
      }
    }
  }
}

function applyBaseball(game, p, seg, mult) {
  const flags = game.partyFlags;
  const inning = game.roundNumber;
  if (seg === inning) {
    p.runs += mult;
    if (mult === 3 && p.dbId != null && !flags.baseballSlam.includes(p.dbId)) flags.baseballSlam.push(p.dbId);
  }
}

function applyGolf(game, p, seg, mult) {
  const flags = game.partyFlags;
  const hole = game.roundNumber;
  if (p.holeDone) return;
  if (seg === hole) {
    const strokeVal = mult === 3 ? 1 : mult === 2 ? 2 : 3;
    p.holeStrokes = strokeVal;
    p.strokes += strokeVal;
    p.holeDone = true;
    if (game.turnDarts.length === 1 && p.dbId != null && !flags.golfBirdie.includes(p.dbId)) {
      flags.golfBirdie.push(p.dbId);
    }
  } else if (game.turnDarts.length >= 3) {
    // Loch in 3 Darts verfehlt: Strafschläge.
    p.holeStrokes = 5;
    p.strokes += 5;
    p.holeDone = true;
  }
}

// Shanghai (Wettkampf): Runde n zielt auf Feld n; Treffer = mult × n. Ein Shanghai
// (Single+Double+Triple des Feldes in einer Aufnahme) gewinnt sofort. Liefert den
// Sieger bei Shanghai, sonst null.
function applyShanghai(game, p, seg) {
  const round = game.roundNumber;
  if (seg === round && round >= 1 && round <= 20) {
    const dartsOnTarget = game.turnDarts.filter((d) => d.segment === round);
    p.score += dartsOnTarget[dartsOnTarget.length - 1].multiplier * round;
    const mults = new Set(dartsOnTarget.map((d) => d.multiplier));
    if (mults.has(1) && mults.has(2) && mults.has(3)) return p; // Shanghai!
  }
  return null;
}

// Around the Clock (Wettlauf): pro Spieler ein Zeiger 1..20; Treffer aufs aktuelle
// Ziel rückt den Zeiger vor. Wer zuerst über 20 kommt, gewinnt (Prüfung im Aufrufer).
function applyClock(game, p, seg) {
  if (seg === p.nextTarget) p.nextTarget += 1;
}

// Halve-it: feste Ziel-Folge je Runde; Treffer bringt Punkte, komplette Fehlrunde
// halbiert den Punktestand (im Rundenwechsel). Bull zählt 25/50.
function applyHalveit(game, p, seg, mult) {
  const target = HALVEIT_SEQ[game.roundNumber - 1];
  if (target == null) return;
  if (seg === target) {
    p.score += target === 25 ? (mult === 2 ? 50 : 25) : target * mult;
    p.hitRound = true;
  }
}

function applyDart(game, dartIn) {
  if (game.status !== 'playing') return game;
  const seg = Number(dartIn && dartIn.segment);
  const mult = Number(dartIn && dartIn.multiplier);
  if (!Number.isInteger(seg) || seg < 0 || seg > 25 || ![1, 2, 3].includes(mult)) {
    throw new Error(`Ungültiger Dart: ${JSON.stringify(dartIn)}`);
  }
  pushUndo(game);
  const p = current(game);
  game.turnDarts.push({ segment: seg, multiplier: mult, label: label({ segment: seg, multiplier: mult }) });

  const mode = game.partyMode;
  let shanghaiWinner = null;
  if (mode === 'killer') applyKiller(game, p, seg, mult);
  else if (mode === 'baseball') applyBaseball(game, p, seg, mult);
  else if (mode === 'golf') applyGolf(game, p, seg, mult);
  else if (mode === 'shanghai') shanghaiWinner = applyShanghai(game, p, seg);
  else if (mode === 'clock') applyClock(game, p, seg);
  else if (mode === 'halveit') applyHalveit(game, p, seg, mult);

  // Sofort-Siege
  if (mode === 'killer' && activeCount(game) <= 1) {
    finish(game, game.players.find((x) => !x.eliminated) || null);
    return game;
  }
  if (mode === 'shanghai' && shanghaiWinner) {
    finish(game, shanghaiWinner);
    return game;
  }
  if (mode === 'clock') {
    const w = game.players.find((x) => x.nextTarget > 20);
    if (w) {
      // Blitzsieg: alle Gegner sind noch bei ≤ 10.
      if (w.dbId != null && game.players.every((x) => x === w || x.nextTarget <= 10)) {
        game.partyFlags.clockBlitz.push(w.dbId);
      }
      finish(game, w);
      return game;
    }
  }

  const turnOver =
    game.turnDarts.length >= 3 || (mode === 'golf' && p.holeDone) || (mode === 'killer' && p.eliminated);
  if (turnOver) {
    endTurn(game);
    if (mode === 'baseball' && game.roundNumber > BASEBALL_INNINGS) {
      for (const pl of game.players) if (pl.runs >= 40 && pl.dbId != null) game.partyFlags.baseballBig.push(pl.dbId);
      finish(game, [...game.players].sort((a, b) => b.runs - a.runs)[0]);
    } else if (mode === 'golf' && game.roundNumber > GOLF_HOLES) {
      for (const pl of game.players) if (pl.strokes <= 30 && pl.dbId != null) game.partyFlags.golfUnderPar.push(pl.dbId);
      finish(game, [...game.players].sort((a, b) => a.strokes - b.strokes)[0]);
    } else if (mode === 'shanghai' && game.roundNumber > SHANGHAI_ROUNDS) {
      finish(game, [...game.players].sort((a, b) => b.score - a.score)[0]);
    } else if (mode === 'halveit' && game.roundNumber > HALVEIT_SEQ.length) {
      finish(game, [...game.players].sort((a, b) => b.score - a.score)[0]);
    }
  }
  return game;
}

function undo(game) {
  if (!game.undoStack || !game.undoStack.length) return game;
  const snap = JSON.parse(game.undoStack.pop());
  const stack = game.undoStack;
  Object.keys(game).forEach((k) => delete game[k]);
  Object.assign(game, snap);
  game.undoStack = stack;
  return game;
}

// Ziel-Anzeige je Modus für einen Spieler bzw. die Runde.
function targetInfo(game, p) {
  const m = game.partyMode;
  if (m === 'killer') return p.target;
  if (m === 'clock') return p.nextTarget <= 20 ? p.nextTarget : 'fertig';
  if (m === 'halveit') return HALVEIT_SEQ[game.roundNumber - 1] || null;
  return game.roundNumber; // Baseball: Inning, Golf: Loch, Shanghai: Runde
}

function toClient(game) {
  return {
    id: game.id,
    partyMode: game.partyMode,
    status: game.status,
    currentPlayerIndex: game.currentPlayerIndex,
    roundNumber: game.roundNumber,
    roundMax:
      game.partyMode === 'baseball'
        ? BASEBALL_INNINGS
        : game.partyMode === 'golf'
        ? GOLF_HOLES
        : game.partyMode === 'shanghai'
        ? SHANGHAI_ROUNDS
        : game.partyMode === 'halveit'
        ? HALVEIT_SEQ.length
        : null,
    winnerId: game.winnerId,
    message: game.message,
    messageSeq: game.messageSeq,
    turnDarts: game.turnDarts,
    players: game.players.map((p) => ({
      id: p.id,
      dbId: p.dbId,
      name: p.name,
      type: p.type,
      eliminated: p.eliminated,
      target: game.partyMode === 'killer' ? p.target : targetInfo(game, p),
      lives: p.lives,
      runs: p.runs,
      strokes: p.strokes,
      holeStrokes: p.holeStrokes,
      holeDone: p.holeDone,
      score: p.score,
      nextTarget: p.nextTarget,
    })),
  };
}

module.exports = { createGame, applyDart, undo, toClient, current, PARTY_MODES, KILLER_LIVES, BASEBALL_INNINGS, GOLF_HOLES, SHANGHAI_ROUNDS, HALVEIT_SEQ, HALVEIT_START };
