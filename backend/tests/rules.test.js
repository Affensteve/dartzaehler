'use strict';

const test = require('node:test');
const assert = require('node:assert');
const rules = require('../utils/dartRules');

// Hilfsfunktion: Label -> Punkte + isDouble
function labelPoints(label) {
  if (label === 'Bull') return { points: 50, isDouble: true };
  if (label === '25') return { points: 25, isDouble: false };
  const n = parseInt(label.replace(/^[TD]/, ''), 10);
  if (label[0] === 'T') return { points: 3 * n, isDouble: false };
  if (label[0] === 'D') return { points: 2 * n, isDouble: true };
  return { points: n, isDouble: false };
}

test('dartPoints & isDoubleDart', () => {
  assert.strictEqual(rules.dartPoints({ segment: 20, multiplier: 3 }), 60);
  assert.strictEqual(rules.dartPoints({ segment: 0, multiplier: 1 }), 0);
  assert.strictEqual(rules.dartPoints({ segment: 25, multiplier: 2 }), 50);
  assert.strictEqual(rules.isDoubleDart({ segment: 25, multiplier: 2 }), true);
  assert.strictEqual(rules.isDoubleDart({ segment: 20, multiplier: 1 }), false);
});

test('isValidDart lehnt unmögliche Würfe ab', () => {
  assert.strictEqual(rules.isValidDart({ segment: 25, multiplier: 3 }), false); // T25
  assert.strictEqual(rules.isValidDart({ segment: 0, multiplier: 2 }), false); // D0
  assert.strictEqual(rules.isValidDart({ segment: 21, multiplier: 1 }), false);
  assert.strictEqual(rules.isValidDart({ segment: 20, multiplier: 3 }), true);
  assert.strictEqual(rules.isValidDart({ segment: 25, multiplier: 2 }), true);
});

test('Checkout: findet gültige Double-Out-Finishes und rechnet korrekt', () => {
  let finishable = 0;
  for (let score = 2; score <= 170; score++) {
    const path = rules.findCheckout(score, 'double');
    if (!path) continue;
    finishable++;
    assert.ok(path.length <= 3, `Score ${score}: zu viele Darts`);
    const parts = path.map(labelPoints);
    const sum = parts.reduce((s, p) => s + p.points, 0);
    assert.strictEqual(sum, score, `Score ${score}: Summe ${sum} != ${score} (${path})`);
    assert.ok(parts[parts.length - 1].isDouble, `Score ${score}: endet nicht auf Double (${path})`);
  }
  // Bekannte Bogey-Zahlen dürfen keinen Finish haben
  for (const bogey of [169, 168, 166, 165, 163, 162, 159]) {
    assert.strictEqual(rules.findCheckout(bogey, 'double'), null, `Bogey ${bogey} sollte null sein`);
  }
  assert.ok(finishable > 120, 'Es sollten viele Finishes existieren');
});

test('Checkout: Single-Out finished mit beliebigem letzten Dart', () => {
  for (const score of [1, 2, 7, 40, 60, 99, 110, 170]) {
    const path = rules.findCheckout(score, 'single');
    assert.ok(path, `Single-Out ${score} sollte finishbar sein`);
    const sum = path.map(labelPoints).reduce((s, p) => s + p.points, 0);
    assert.strictEqual(sum, score);
  }
});

test('Checkout: Single-Out bevorzugt einfaches Feld statt Doppel', () => {
  assert.deepStrictEqual(rules.findCheckout(10, 'single'), ['10']); // nicht D5
  assert.deepStrictEqual(rules.findCheckout(18, 'single'), ['18']); // nicht D9
  assert.deepStrictEqual(rules.findCheckout(20, 'single'), ['20']); // nicht D10
  assert.deepStrictEqual(rules.findCheckout(3, 'single'), ['3']);
});

test('applyDartToScore: normaler Score', () => {
  const r = rules.applyDartToScore(501, { segment: 20, multiplier: 3 }, {
    checkIn: 'straight',
    checkoutMode: 'double',
    alreadyOpened: true,
  });
  assert.deepStrictEqual(r, { remaining: 441, bust: false, checkout: false, opened: true });
});

test('applyDartToScore: Double-Out Checkout gültig', () => {
  const r = rules.applyDartToScore(40, { segment: 20, multiplier: 2 }, {
    checkIn: 'straight',
    checkoutMode: 'double',
    alreadyOpened: true,
  });
  assert.strictEqual(r.checkout, true);
  assert.strictEqual(r.remaining, 0);
});

test('applyDartToScore: Checkout auf 0 ohne Double ist Bust (Double-Out)', () => {
  const r = rules.applyDartToScore(40, { segment: 20, multiplier: 1 }, {
    checkIn: 'straight',
    checkoutMode: 'double',
    alreadyOpened: true,
  });
  // 40 - 20 = 20, kein Bust, einfach weiter
  assert.strictEqual(r.bust, false);
  assert.strictEqual(r.remaining, 20);

  // 2 -> Single 2 = 0 aber kein Double -> Bust
  const r2 = rules.applyDartToScore(2, { segment: 2, multiplier: 1 }, {
    checkIn: 'straight',
    checkoutMode: 'double',
    alreadyOpened: true,
  });
  assert.strictEqual(r2.bust, true);
  assert.strictEqual(r2.remaining, 2);
});

test('applyDartToScore: Rest 1 bei Double-Out ist Bust', () => {
  const r = rules.applyDartToScore(21, { segment: 20, multiplier: 1 }, {
    checkIn: 'straight',
    checkoutMode: 'double',
    alreadyOpened: true,
  });
  assert.strictEqual(r.bust, true);
});

test('applyDartToScore: Single-Out darf auf 0 mit Single', () => {
  const r = rules.applyDartToScore(20, { segment: 20, multiplier: 1 }, {
    checkIn: 'straight',
    checkoutMode: 'single',
    alreadyOpened: true,
  });
  assert.strictEqual(r.checkout, true);
});

test('applyDartToScore: Double-In eröffnet erst mit Double', () => {
  const noOpen = rules.applyDartToScore(501, { segment: 20, multiplier: 1 }, {
    checkIn: 'double',
    checkoutMode: 'double',
    alreadyOpened: false,
  });
  assert.strictEqual(noOpen.opened, false);
  assert.strictEqual(noOpen.remaining, 501); // zählt nicht

  const open = rules.applyDartToScore(501, { segment: 20, multiplier: 2 }, {
    checkIn: 'double',
    checkoutMode: 'double',
    alreadyOpened: false,
  });
  assert.strictEqual(open.opened, true);
  assert.strictEqual(open.remaining, 461);
});

test('Master-Out: Finish auf Triple und Doppel, Bust bei Single/Rest 1', () => {
  const M = (rem, d) =>
    rules.applyDartToScore(rem, d, { checkIn: 'straight', checkoutMode: 'master', alreadyOpened: true });
  assert.strictEqual(M(60, { segment: 20, multiplier: 3 }).checkout, true); // T20 finisht
  assert.strictEqual(M(40, { segment: 20, multiplier: 2 }).checkout, true); // D20 finisht
  assert.strictEqual(M(50, { segment: 25, multiplier: 2 }).checkout, true); // Bull finisht
  assert.strictEqual(M(20, { segment: 20, multiplier: 1 }).bust, true); // Single finisht nicht
  assert.strictEqual(M(2, { segment: 1, multiplier: 1 }).bust, true); // Rest 1 = Bust
});

test('Master-Out: Checkout-Tabelle & algorithmischer Rest', () => {
  assert.deepStrictEqual(rules.findCheckout(180, 'master', 3), ['T20', 'T20', 'T20']);
  assert.deepStrictEqual(rules.findCheckout(120, 'master', 3), ['T20', 'T20']);
  assert.deepStrictEqual(rules.findCheckout(110, 'master', 3), ['Bull', 'T20']);
  assert.deepStrictEqual(rules.findCheckout(100, 'master', 3), ['T20', 'D20']);
  assert.deepStrictEqual(rules.findCheckout(45, 'master', 3), ['T15']); // < 46: algorithmisch
  assert.strictEqual(rules.findCheckout(100, 'master', 1), null); // nur 1 Pfeil -> nicht finishbar
});
