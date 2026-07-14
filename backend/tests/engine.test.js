'use strict';

const test = require('node:test');
const assert = require('node:assert');
const engine = require('../utils/gameEngine');

function newGame(overrides = {}) {
  return engine.createGame({
    mode: 501,
    checkIn: 'straight',
    satzLegMode: 'firstto',
    sets: 1,
    legs: 1,
    players: [
      { id: 'a', name: 'A', type: 'human', checkoutMode: 'double' },
      { id: 'b', name: 'B', type: 'human', checkoutMode: 'double' },
    ],
    ...overrides,
  });
}

const T20 = { segment: 20, multiplier: 3 };
const D20 = { segment: 20, multiplier: 2 };

test('resolveFormat: firstto & bestof', () => {
  assert.deepStrictEqual(
    engine.resolveFormat({ satzLegMode: 'firstto', sets: 1, legs: 3 }),
    { satzLegMode: 'firstto', sets: 1, legs: 3, legsPerSet: 3, setsToWin: 1, label: 'First to 1 Satz 3 Legs' }
  );
  // Best of: nur Legs, Mehrheit gewinnt (ein Satz)
  const bo = engine.resolveFormat({ satzLegMode: 'bestof', legs: 5 });
  assert.strictEqual(bo.setsToWin, 1);
  assert.strictEqual(bo.legsPerSet, 3);
  assert.strictEqual(bo.label, 'Best of 5');
});

test('applyDart: scoren und Turn-Wechsel nach 3 Darts', () => {
  const g = newGame();
  engine.applyDart(g, T20);
  engine.applyDart(g, T20);
  assert.strictEqual(g.players[0].score, 501 - 120);
  assert.strictEqual(g.currentPlayerIndex, 0);
  engine.applyDart(g, T20); // 3. Dart -> Wechsel
  assert.strictEqual(g.players[0].score, 501 - 180);
  assert.strictEqual(g.currentPlayerIndex, 1);
  assert.strictEqual(g.players[0].lastTurnDarts.length, 3);
});

test('applyDart: Bust setzt Visit zurueck', () => {
  const g = newGame();
  g.players[0].score = 50;
  g.players[0].turnStartScore = 50;
  engine.applyDart(g, T20); // 50 - 60 < 0 -> Bust
  assert.strictEqual(g.players[0].score, 50); // zurueckgesetzt
  assert.strictEqual(g.message, 'BUST');
  assert.strictEqual(g.currentPlayerIndex, 1); // Turn vorbei
});

test('applyDart: Checkout gewinnt das Leg/Match', () => {
  const g = newGame(); // firstto 1 Satz 1 Leg -> ein Leg gewinnt
  g.players[0].score = 40;
  g.players[0].turnStartScore = 40;
  engine.applyDart(g, D20); // Checkout
  assert.strictEqual(g.status, 'finished');
  assert.strictEqual(g.winnerId, 'a');
  assert.strictEqual(g.players[0].setsWon, 1); // 1 Leg = 1 Satz = Match
});

test('mehrere Legs pro Satz: erst nach genug Legs Satz/Match', () => {
  const g = newGame({ legs: 2, sets: 1 }); // first to 1 Satz, 2 Legs pro Satz
  g.players[0].score = 40;
  g.players[0].turnStartScore = 40;
  engine.applyDart(g, D20);
  assert.strictEqual(g.status, 'playing');
  assert.strictEqual(g.players[0].legsWon, 1);
  assert.strictEqual(g.legNumber, 2);
  assert.strictEqual(g.players[0].score, 501); // neues Leg zuruckgesetzt

  const idxA = g.players.findIndex((p) => p.id === 'a');
  g.currentPlayerIndex = idxA;
  g.players[idxA].score = 40;
  g.players[idxA].turnStartScore = 40;
  engine.applyDart(g, D20);
  assert.strictEqual(g.status, 'finished');
  assert.strictEqual(g.winnerId, 'a');
});

test('undo macht den letzten Dart rueckgaengig', () => {
  const g = newGame();
  engine.applyDart(g, T20);
  assert.strictEqual(g.players[0].score, 441);
  engine.undo(g);
  assert.strictEqual(g.players[0].score, 501);
  assert.strictEqual(g.players[0].currentTurn.length, 0);
});

test('Bot spielt einen vollstaendigen Visit', () => {
  const g = engine.createGame({
    mode: 501,
    satzLegMode: 'firstto',
    sets: 1,
    legs: 1,
    players: [
      { id: 'a', name: 'Bot', type: 'bot', botLevel: 'hard', checkoutMode: 'double' },
      { id: 'b', name: 'B', type: 'human', checkoutMode: 'double' },
    ],
  });
  const before = g.players[0].score;
  engine.playBotTurn(g);
  assert.ok(g.players[0].dartsThrown >= 1);
  assert.ok(g.players[0].score <= before);
});

test('toClient enthaelt Checkout-Vorschlag und Averages', () => {
  const g = newGame();
  g.players[0].score = 40;
  const view = engine.toClient(g);
  assert.ok(Array.isArray(view.checkoutSuggestion.route));
  assert.strictEqual(view.checkoutSuggestion.personalized, false);
  assert.strictEqual(typeof view.players[0].average, 'number');
  assert.strictEqual(view.players[0].isActive, true);
});

test('Rundenzaehler steigt nach kompletter Runde', () => {
  const g = newGame({ maxRounds: 0 });
  assert.strictEqual(g.roundNumber, 1);
  // Spieler A: 3 Darts
  engine.applyDart(g, { segment: 1, multiplier: 1 });
  engine.applyDart(g, { segment: 1, multiplier: 1 });
  engine.applyDart(g, { segment: 1, multiplier: 1 });
  assert.strictEqual(g.roundNumber, 1); // erst B ist dran
  // Spieler B: 3 Darts -> Runde 1 komplett
  engine.applyDart(g, { segment: 1, multiplier: 1 });
  engine.applyDart(g, { segment: 1, multiplier: 1 });
  engine.applyDart(g, { segment: 1, multiplier: 1 });
  assert.strictEqual(g.roundNumber, 2);
});

test('Bust setzt messagePlayer auf den ueberwerfenden Spieler', () => {
  const g = newGame({ maxRounds: 0 });
  g.players[0].score = 50;
  g.players[0].turnStartScore = 50;
  engine.applyDart(g, { segment: 20, multiplier: 3 }); // Bust
  assert.strictEqual(g.message, 'BUST');
  assert.strictEqual(g.messagePlayer, 'A');
});

test('Ausbullen: Rundenlimit loest awaitingBullOff aus, resolveBullOff entscheidet', () => {
  const g = newGame({ maxRounds: 1, legs: 1, sets: 1 }); // 1 Runde Limit
  // Beide Spieler werfen je 3 Fehlwuerfe -> nach Runde 1 Ausbullen
  for (let i = 0; i < 6; i++) engine.applyDart(g, { segment: 0, multiplier: 1 });
  assert.strictEqual(g.awaitingBullOff, true);
  assert.strictEqual(g.status, 'playing');
  // Weitere Darts werden ignoriert, solange Ausbullen aussteht
  engine.applyDart(g, { segment: 20, multiplier: 3 });
  assert.strictEqual(g.players[0].score, 501);
  // Gewinner per Ausbullen bestimmen
  engine.resolveBullOff(g, 'a');
  assert.strictEqual(g.status, 'finished');
  assert.strictEqual(g.winnerId, 'a');
  assert.strictEqual(g.players[0].legsWonTotal, 1);
});

// --- Freitext-Summen-Eingabe ---
test('applyVisitSum: reguläre Aufnahme zählt 3 Pfeile + Punkte (für Ø)', () => {
  const g = newGame({ inputMode: 'sum' });
  engine.applyVisitSum(g, 140);
  const v = engine.toClient(g);
  const a = v.players.find((p) => p.name === 'A');
  assert.strictEqual(v.inputMode, 'sum');
  assert.strictEqual(a.score, 361);
  assert.strictEqual(a.lastVisitScore, 140);
  assert.strictEqual(a.dartsThrown, 3); // 3 Pfeile je Aufnahme angenommen
  assert.strictEqual(a.average, 140); // 140 / 3 * 3
  assert.strictEqual(v.currentPlayerIndex, 1); // Turn gewechselt
});

test('applyVisitSum: ungültige Summen werden abgelehnt', () => {
  const g = newGame();
  for (const bad of [181, 200, -1, 163, 166, 169, 172, 173, 175, 176, 178, 179, 90.5]) {
    assert.throws(() => engine.applyVisitSum(g, bad), /Ungültige Aufnahme-Summe/);
  }
});

test('applyVisitSum: Bust bei Überwurf lässt Score unverändert', () => {
  const g = engine.createGame({
    mode: 101, checkIn: 'straight', satzLegMode: 'bestof', legs: 1,
    players: [
      { id: 'a', name: 'A', type: 'human', checkoutMode: 'double' },
      { id: 'b', name: 'B', type: 'human', checkoutMode: 'double' },
    ],
  });
  engine.applyVisitSum(g, 61); // A -> 40
  engine.applyVisitSum(g, 0); // B
  engine.applyVisitSum(g, 50); // A: 40-50 < 0 -> Bust
  const v = engine.toClient(g);
  assert.strictEqual(v.message, 'BUST');
  assert.strictEqual(v.players.find((p) => p.name === 'A').score, 40);
});

test('applyVisitSum: Double-Out Rest 1 ist Bust, Rest 0 gewinnt Leg/Spiel', () => {
  const g = engine.createGame({
    mode: 101, checkIn: 'straight', satzLegMode: 'bestof', legs: 1,
    players: [
      { id: 'a', name: 'A', type: 'human', checkoutMode: 'double' },
      { id: 'b', name: 'B', type: 'human', checkoutMode: 'double' },
    ],
  });
  engine.applyVisitSum(g, 61); // A -> 40
  engine.applyVisitSum(g, 0); // B
  engine.applyVisitSum(g, 39); // A: Rest 1 -> Bust
  assert.strictEqual(engine.toClient(g).message, 'BUST');
  engine.applyVisitSum(g, 0); // B
  engine.applyVisitSum(g, 40); // A: Rest 0 -> Checkout
  const v = engine.toClient(g);
  assert.strictEqual(v.status, 'finished');
  assert.strictEqual(v.winnerId, 'a');
});


test('applyVisitSum: Checkout mit übergebener Pfeilzahl fließt in den Ø', () => {
  const g = engine.createGame({
    mode: 101, checkIn: 'straight', satzLegMode: 'bestof', legs: 1, inputMode: 'sum',
    players: [
      { id: 'a', name: 'A', type: 'human', checkoutMode: 'double' },
      { id: 'b', name: 'B', type: 'human', checkoutMode: 'double' },
    ],
  });
  engine.applyVisitSum(g, 60); // A -> 41 (3 Pfeile)
  engine.applyVisitSum(g, 0); // B (3 Pfeile)
  engine.applyVisitSum(g, 41, 2); // A checkout mit 2 Pfeilen
  const v = engine.toClient(g);
  const a = v.players.find((p) => p.name === 'A');
  assert.strictEqual(v.status, 'finished');
  assert.strictEqual(v.winnerId, 'a');
  assert.strictEqual(a.dartsThrown, 5); // 3 + 2
  assert.strictEqual(a.average, 60.6); // 101 / 5 * 3
});

// --- Format "Unbegrenzt" ---
test('resolveFormat: unlimited hat kein Ziel', () => {
  const f = engine.resolveFormat({ satzLegMode: 'unlimited' });
  assert.strictEqual(f.legsPerSet, 0);
  assert.strictEqual(f.setsToWin, 0);
  assert.strictEqual(f.label, 'Unbegrenzt');
});

test('Unbegrenzt: Spiel endet nicht automatisch, endUnlimited wertet Leg-Führenden', () => {
  const g = engine.createGame({
    mode: 101, checkIn: 'straight', satzLegMode: 'unlimited',
    players: [
      { id: 'a', name: 'A', type: 'human', checkoutMode: 'double' },
      { id: 'b', name: 'B', type: 'human', checkoutMode: 'double' },
    ],
  });
  const T = (s, m) => ({ segment: s, multiplier: m });
  // Leg 1: A checkt 101 (T20, 9, D16)
  engine.applyDart(g, T(20, 3)); engine.applyDart(g, T(9, 1)); engine.applyDart(g, T(16, 2));
  assert.strictEqual(engine.toClient(g).status, 'playing'); // kein Auto-Ende
  // Leg 2: B (Legstarter gewechselt) checkt
  engine.applyDart(g, T(20, 3)); engine.applyDart(g, T(9, 1)); engine.applyDart(g, T(16, 2));
  // Leg 3: A checkt -> A führt 2:1
  engine.applyDart(g, T(20, 3)); engine.applyDart(g, T(9, 1)); engine.applyDart(g, T(16, 2));
  assert.strictEqual(engine.toClient(g).status, 'playing');
  engine.endUnlimited(g);
  const v = engine.toClient(g);
  assert.strictEqual(v.status, 'finished');
  assert.strictEqual(v.winnerId, 'a');
});
