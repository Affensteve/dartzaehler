'use strict';

const test = require('node:test');
const assert = require('node:assert');
const elo = require('../utils/elo');

test('expected: gleiche Ratings => 0.5', () => {
  assert.ok(Math.abs(elo.expected(1000, 1000) - 0.5) < 1e-9);
  assert.ok(elo.expected(1200, 1000) > 0.5);
  assert.ok(elo.expected(1000, 1200) < 0.5);
});

test('marginFactor: knapp ~1, Whitewash bis ~1.75', () => {
  assert.strictEqual(elo.marginFactor(0, 0), 1);
  assert.ok(Math.abs(elo.marginFactor(3, 2) - 1.15) < 1e-9);
  assert.ok(elo.marginFactor(3, 0) > 1.7 && elo.marginFactor(3, 0) <= 1.75);
});

test('update: Sieger gewinnt, Verlierer verliert, symmetrisch', () => {
  const u = elo.update(1000, 1000, 1, 1);
  assert.ok(Math.abs(u.a - 1000 - 16) < 1e-9); // K=32, (1-0.5) => 16
  assert.ok(Math.abs(u.b - 1000 + 16) < 1e-9);
  assert.ok(Math.abs(u.a - 1000 + (u.b - 1000)) < 1e-9); // nullsummen
});

test('update: Underdog-Sieg bringt mehr Punkte', () => {
  const strong = elo.update(1300, 1000, 0, 1); // Favorit verliert -> großer Verlust
  const weak = elo.update(1000, 1300, 1, 1); // Underdog gewinnt -> großer Gewinn
  assert.ok(weak.a - 1000 > 16);
  assert.ok(strong.a - 1300 < -16);
});

test('botElo: feste Werte je Level', () => {
  assert.ok(elo.botElo('easy') < elo.botElo('medium'));
  assert.ok(elo.botElo('medium') < elo.botElo('hard'));
  assert.strictEqual(elo.botElo('unknown'), 1000);
});
