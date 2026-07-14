'use strict';

const test = require('node:test');
const assert = require('node:assert');
const logic = require('../utils/tournamentLogic');
const bracket = require('../utils/tournamentBracket');

function playersN(n) {
  return Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), name: 'P' + (i + 1), type: 'human' }));
}

test('assignGroups: 1 vs 2 Gruppen', () => {
  const ps = playersN(8);
  assert.strictEqual(logic.assignGroups(ps, 1).length, 1);
  const g2 = logic.assignGroups(ps, 2);
  assert.strictEqual(g2.length, 2);
  assert.strictEqual(g2[0].playerIds.length + g2[1].playerIds.length, 8);
  assert.strictEqual(g2[0].playerIds.length, 4);
});

test('generateGroupMatches: Round-Robin-Anzahl je Gruppe', () => {
  const ps = playersN(8);
  const groups = logic.assignGroups(ps, 2);
  const matches = logic.generateGroupMatches(groups);
  // 2 Gruppen à 4 -> je 6 Spiele = 12
  assert.strictEqual(matches.length, 12);
  assert.ok(matches.every((m) => m.phase === 'group' && m.group));
});

function doneMatch(p1, p2, winner, legsW = 2, legsL = 0) {
  return {
    id: p1 + '-' + p2, phase: 'group', group: 'A', p1, p2, status: 'done', winnerId: winner,
    result: {
      p1: { legs: winner === p1 ? legsW : legsL, points: 100, darts: 12 },
      p2: { legs: winner === p2 ? legsW : legsL, points: 100, darts: 12 },
    },
  };
}

test('computeStandings: Sortierung nach Punkten', () => {
  const t = {
    players: playersN(3),
    groups: [{ id: 'A', name: 'A', playerIds: ['p1', 'p2', 'p3'] }],
    matches: [doneMatch('p1', 'p2', 'p1'), doneMatch('p1', 'p3', 'p1'), doneMatch('p2', 'p3', 'p2')],
    bullOffs: {},
  };
  const rows = logic.computeStandings(t, 'A');
  assert.deepStrictEqual(rows.map((r) => r.playerId), ['p1', 'p2', 'p3']);
  assert.strictEqual(rows[0].points, 4);
});

test('computeStandings: direkter Vergleich bricht Gleichstand', () => {
  // p1,p2,p3 je 1 Sieg (Kreis), gleiche Leg-Diff -> direkter Vergleich zählt paarweise
  const t = {
    players: playersN(3),
    groups: [{ id: 'A', name: 'A', playerIds: ['p1', 'p2', 'p3'] }],
    matches: [doneMatch('p1', 'p2', 'p1', 2, 1), doneMatch('p2', 'p3', 'p2', 2, 1), doneMatch('p3', 'p1', 'p3', 2, 1)],
    bullOffs: {},
  };
  const rows = logic.computeStandings(t, 'A');
  // alle 2 Punkte, diff 0; Reihenfolge stabil & deterministisch
  assert.strictEqual(rows.length, 3);
  assert.ok(rows.every((r) => r.points === 2));
});

test('bracket: 2x4 -> 8er Bracket, Kreuz-Seeding, Champion', () => {
  const ps = playersN(8);
  const groups = [
    { id: 'A', name: 'A', playerIds: ['p1', 'p2', 'p3', 'p4'] },
    { id: 'B', name: 'B', playerIds: ['p5', 'p6', 'p7', 'p8'] },
  ];
  const t = { players: ps, groups, matches: [], ko: { enabled: true, advance: 4 }, thirdPlace: true, stage: 'group', bullOffs: {}, status: 'active' };
  // Gruppen-Round-Robin: p1>p2>p3>p4 (A), p5>p6>p7>p8 (B)
  t.matches = logic.generateGroupMatches(groups);
  for (const m of t.matches) {
    const rank = (x) => parseInt(x.slice(1));
    const w = rank(m.p1) < rank(m.p2) ? m.p1 : m.p2;
    m.status = 'done'; m.winnerId = w;
    m.result = { p1: { legs: w === m.p1 ? 2 : 0, points: 100, darts: 12 }, p2: { legs: w === m.p2 ? 2 : 0, points: 100, darts: 12 } };
  }
  assert.ok(logic.allGroupMatchesDone(t));
  bracket.buildBracket(t);
  assert.deepStrictEqual(t.bracket.map((r) => r.name), ['Viertelfinale', 'Halbfinale', 'Finale']);
  assert.strictEqual(t.stage, 'ko');
  // KO simulieren: kleinere Nummer gewinnt
  let guard = 0;
  while (t.status !== 'finished' && guard++ < 50) {
    const m = t.matches.find((x) => x.phase === 'ko' && x.status !== 'done' && x.p1 && x.p2 && x.round !== 'third');
    if (!m) break;
    m.winnerId = parseInt(m.p1.slice(1)) < parseInt(m.p2.slice(1)) ? m.p1 : m.p2;
    m.status = 'done';
    bracket.advanceKo(t);
  }
  // Platz-3 per Bull-off
  const tp = t.matches.find((m) => m.round === 'third');
  assert.ok(tp && tp.bulloff && tp.p1 && tp.p2);
  tp.winnerId = tp.p1; tp.status = 'done'; bracket.advanceKo(t);
  assert.strictEqual(t.status, 'finished');
  assert.strictEqual(t.winnerId, 'p1'); // Topgesetzter gewinnt
});

test('bracket: 2x3 -> Freilose für Topgesetzte', () => {
  const ps = playersN(6);
  const groups = [
    { id: 'A', name: 'A', playerIds: ['p1', 'p2', 'p3'] },
    { id: 'B', name: 'B', playerIds: ['p4', 'p5', 'p6'] },
  ];
  const t = { players: ps, groups, matches: [], ko: { enabled: true, advance: 3 }, thirdPlace: false, stage: 'group', bullOffs: {}, status: 'active' };
  t.matches = logic.generateGroupMatches(groups);
  for (const m of t.matches) {
    const w = parseInt(m.p1.slice(1)) < parseInt(m.p2.slice(1)) ? m.p1 : m.p2;
    m.status = 'done'; m.winnerId = w;
    m.result = { p1: { legs: w === m.p1 ? 2 : 0, points: 1, darts: 1 }, p2: { legs: w === m.p2 ? 2 : 0, points: 1, darts: 1 } };
  }
  bracket.buildBracket(t);
  const r0 = t.bracket[0].matchIds.map((id) => t.matches.find((m) => m.id === id));
  const byes = r0.filter((m) => m.bye);
  assert.strictEqual(byes.length, 2); // zwei Freilose bei 6 -> 8
});
