'use strict';

const test = require('node:test');
const assert = require('node:assert');
const engine = require('../utils/partyEngine');

function P(n) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, dbId: i + 1, name: 'P' + (i + 1), type: 'human' }));
}
const D = (segment, multiplier) => ({ segment, multiplier });

test('killer: arm mit Doppel, dann Gegner ausschalten -> Sieger', () => {
  const g = engine.createGame({ partyMode: 'killer', players: P(2) });
  // Ziele deterministisch setzen
  g.players[0].target = 20;
  g.players[1].target = 19;
  // P1 armt sich (Doppel 20)
  engine.applyDart(g, D(20, 2));
  assert.strictEqual(g.players[0].armed, true);
  assert.ok(g.partyFlags.killerArmed.includes(1));
  // P1 nimmt P2 alle 3 Leben (Triple 19)
  engine.applyDart(g, D(19, 3));
  assert.strictEqual(g.players[1].lives, 0);
  assert.strictEqual(g.status, 'finished');
  assert.strictEqual(g.winnerId, g.players[0].id);
});

test('killer: unbewaffnet nimmt keine Leben', () => {
  const g = engine.createGame({ partyMode: 'killer', players: P(2) });
  g.players[0].target = 20;
  g.players[1].target = 19;
  engine.applyDart(g, D(19, 3)); // P1 nicht armiert
  assert.strictEqual(g.players[1].lives, engine.KILLER_LIVES);
});

test('baseball: Runs nur auf Inning-Feld, 9 Innings -> Sieger', () => {
  const g = engine.createGame({ partyMode: 'baseball', players: P(2) });
  // Inning 1: P1 wirft 3x Triple 1 (9 runs), P2 nichts
  for (let i = 0; i < 3; i++) engine.applyDart(g, D(1, 3));
  assert.strictEqual(g.players[0].runs, 9);
  assert.ok(g.partyFlags.baseballSlam.includes(1));
  for (let i = 0; i < 3; i++) engine.applyDart(g, D(5, 1)); // P2 daneben (nicht Inning 1)
  assert.strictEqual(g.players[1].runs, 0);
  assert.strictEqual(g.roundNumber, 2); // Inning 2
  // Restliche Innings ausspielen (beide 0)
  for (let inn = 2; inn <= 9; inn++) {
    for (let i = 0; i < 3; i++) engine.applyDart(g, D(0, 1));
    for (let i = 0; i < 3; i++) engine.applyDart(g, D(0, 1));
  }
  assert.strictEqual(g.status, 'finished');
  assert.strictEqual(g.winnerId, g.players[0].id);
});

test('golf: Loch mit Triple = 1 Schlag/Birdie beim ersten Dart', () => {
  const g = engine.createGame({ partyMode: 'golf', players: P(2) });
  engine.applyDart(g, D(1, 3)); // P1 Loch 1 mit Triple -> 1 Schlag, Birdie
  assert.strictEqual(g.players[0].strokes, 1);
  assert.ok(g.partyFlags.golfBirdie.includes(1));
  // Zug wechselt sofort zu P2
  assert.strictEqual(g.currentPlayerIndex, 1);
});

test('golf: Loch in 3 Darts verfehlt -> Strafschläge', () => {
  const g = engine.createGame({ partyMode: 'golf', players: P(2) });
  engine.applyDart(g, D(5, 1));
  engine.applyDart(g, D(5, 1));
  engine.applyDart(g, D(5, 1));
  assert.strictEqual(g.players[0].strokes, 5);
});

test('shanghai: Single+Double+Triple des Feldes -> Sofortsieg', () => {
  const g = engine.createGame({ partyMode: 'shanghai', players: P(2) });
  engine.applyDart(g, D(1, 1)); // Runde 1, Feld 1
  engine.applyDart(g, D(1, 2));
  engine.applyDart(g, D(1, 3));
  assert.strictEqual(g.players[0].score, 1 + 2 + 3);
  assert.strictEqual(g.status, 'finished');
  assert.strictEqual(g.winnerId, g.players[0].id);
});

test('clock: wer zuerst die 20 schafft, gewinnt', () => {
  const g = engine.createGame({ partyMode: 'clock', players: P(2) });
  g.players[0].nextTarget = 20;
  engine.applyDart(g, D(20, 1));
  assert.strictEqual(g.status, 'finished');
  assert.strictEqual(g.winnerId, g.players[0].id);
});

test('halve-it: Fehlrunde halbiert den Punktestand', () => {
  const g = engine.createGame({ partyMode: 'halveit', players: P(2) });
  assert.strictEqual(g.players[0].score, engine.HALVEIT_START);
  // Runde 1 Ziel 15: P1 trifft, P2 verfehlt komplett
  engine.applyDart(g, D(15, 1));
  engine.applyDart(g, D(0, 1));
  engine.applyDart(g, D(0, 1));
  engine.applyDart(g, D(0, 1));
  engine.applyDart(g, D(0, 1));
  engine.applyDart(g, D(0, 1));
  assert.strictEqual(g.players[0].score, engine.HALVEIT_START + 15);
  assert.strictEqual(g.players[1].score, Math.floor(engine.HALVEIT_START / 2));
  assert.strictEqual(g.roundNumber, 2);
});

test('undo macht letzten Dart rückgängig', () => {
  const g = engine.createGame({ partyMode: 'baseball', players: P(2) });
  engine.applyDart(g, D(1, 3));
  assert.strictEqual(g.players[0].runs, 3);
  engine.undo(g);
  assert.strictEqual(g.players[0].runs, 0);
  assert.strictEqual(g.turnDarts.length, 0);
});
