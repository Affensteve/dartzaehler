'use strict';

/**
 * KO-/Bracket-Logik: Setzung (Kreuz-Seeding über Gruppen), Bracket-Aufbau mit
 * Freilosen auf die nächste 2er-Potenz, Weiterreichen der Sieger, optionaler
 * Platz-3-Entscheid per Bull-off und Finale-Erkennung.
 */

const { randomUUID } = require('crypto');
const logic = require('./tournamentLogic');

/** Standard-Setzreihenfolge für eine Bracket-Größe (Potenz von 2). */
function seedOrder(size) {
  let pols = [1, 2];
  while (pols.length < size) {
    const n = pols.length * 2 + 1;
    const out = [];
    for (const p of pols) {
      out.push(p);
      out.push(n - p);
    }
    pols = out;
  }
  return pols;
}

function roundKey(nMatches) {
  const players = nMatches * 2;
  if (players === 2) return 'final';
  if (players === 4) return 'semi';
  if (players === 8) return 'quarter';
  if (players === 16) return 'last16';
  if (players === 32) return 'last32';
  return 'roundOf:' + players;
}

function roundName(nMatches) {
  const players = nMatches * 2;
  if (players === 2) return 'Finale';
  if (players === 4) return 'Halbfinale';
  if (players === 8) return 'Viertelfinale';
  if (players === 16) return 'Achtelfinale';
  if (players === 32) return 'Sechzehntelfinale';
  return `Runde der ${players}`;
}

function mkKo(round, matchIndex, p1 = null, p2 = null) {
  return {
    id: randomUUID(),
    phase: 'ko',
    round,
    matchIndex,
    p1,
    p2,
    p1From: null,
    p2From: null,
    gameId: null,
    status: 'pending',
    winnerId: null,
    result: null,
    bulloff: false,
    bye: false,
  };
}

/** Ermittelt die gesetzte Qualifikanten-Liste (best-first, gruppen-alternierend). */
function seededQualifiers(t) {
  const perGroup = (t.groups || []).map((g) => {
    const rows = logic.computeStandings(t, g.id);
    const adv = t.ko && t.ko.advance > 0 ? Math.min(t.ko.advance, rows.length) : rows.length;
    return rows.slice(0, adv).map((r) => r.playerId);
  });
  const maxRank = Math.max(0, ...perGroup.map((q) => q.length));
  const seeds = [];
  for (let r = 0; r < maxRank; r++) {
    for (const q of perGroup) if (q[r]) seeds.push(q[r]);
  }
  return seeds;
}

/** Baut die komplette KO-Runde(n) auf und schaltet in die KO-Phase. */
function buildBracket(t) {
  const seeds = seededQualifiers(t);
  const N = seeds.length;
  if (N < 2) return t;

  let size = 1;
  while (size < N) size *= 2;
  const order = seedOrder(size);
  const slots = order.map((seed) => (seed - 1 < N ? seeds[seed - 1] : null)); // null = Freilos

  const roundsCount = Math.log2(size);
  const bracket = [];
  const added = [];

  // Runde 0
  const first = [];
  for (let i = 0; i < size / 2; i++) first.push(mkKo(0, i, slots[2 * i], slots[2 * i + 1]));
  added.push(...first);
  bracket.push({ round: 0, name: roundName(first.length), key: roundKey(first.length), matchIds: first.map((m) => m.id) });

  // Folgerunden (leer, werden durch Sieger gefüllt)
  let prev = size / 2;
  for (let r = 1; r < roundsCount; r++) {
    const cnt = prev / 2;
    const arr = [];
    for (let i = 0; i < cnt; i++) arr.push(mkKo(r, i, null, null));
    added.push(...arr);
    bracket.push({ round: r, name: roundName(cnt), key: roundKey(cnt), matchIds: arr.map((m) => m.id) });
    prev = cnt;
  }

  t.matches.push(...added);
  t.bracket = bracket;
  t.stage = 'ko';

  // Platz-3-Match (per Bull-off), wenn gewünscht und es Halbfinals gibt.
  if (t.thirdPlace && roundsCount >= 2) {
    const tp = mkKo('third', 0, null, null);
    tp.round = 'third';
    tp.bulloff = true;
    tp.p1From = 'Verlierer Halbfinale 1';
    tp.p2From = 'Verlierer Halbfinale 2';
    t.matches.push(tp);
    t.thirdPlaceId = tp.id;
  }

  advanceKo(t); // Freilose sofort auflösen
  return t;
}

function findMatch(t, id) {
  return t.matches.find((m) => m.id === id);
}

/** Reicht Sieger weiter, löst Freilose, füllt Platz-3 und erkennt das Turnierende. */
function advanceKo(t) {
  if (!t.bracket) return t;

  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < t.bracket.length; r++) {
      for (const mid of t.bracket[r].matchIds) {
        const m = findMatch(t, mid);
        if (!m) continue;

        // Freilos in Runde 0 auflösen
        if (r === 0 && m.status !== 'done') {
          const oneNull = (m.p1 == null) !== (m.p2 == null);
          if (oneNull) {
            m.winnerId = m.p1 || m.p2;
            m.status = 'done';
            m.bye = true;
            changed = true;
          }
        }

        // Sieger in die nächste Runde reichen
        if (m.status === 'done' && m.winnerId && r + 1 < t.bracket.length) {
          const parent = findMatch(t, t.bracket[r + 1].matchIds[Math.floor(m.matchIndex / 2)]);
          const key = m.matchIndex % 2 === 0 ? 'p1' : 'p2';
          if (parent && parent[key] == null && parent.winnerId == null) {
            parent[key] = m.winnerId;
            parent[`${key}From`] = null;
            changed = true;
          }
        }
      }
    }
  }

  // Platz-3: Halbfinal-Verlierer eintragen
  if (t.thirdPlaceId && t.bracket.length >= 2) {
    const tp = findMatch(t, t.thirdPlaceId);
    const semis = t.bracket[t.bracket.length - 2].matchIds.map((id) => findMatch(t, id));
    if (tp && semis.length === 2 && semis.every((s) => s && s.status === 'done')) {
      const loser = (s) => (s.winnerId === s.p1 ? s.p2 : s.p1);
      if (tp.p1 == null) {
        tp.p1 = loser(semis[0]);
        tp.p1From = null;
      }
      if (tp.p2 == null) {
        tp.p2 = loser(semis[1]);
        tp.p2From = null;
      }
    }
  }

  // Turnierende: Finale fertig und (kein Platz-3 oder Platz-3 fertig)
  const finalRound = t.bracket[t.bracket.length - 1];
  const finalMatch = finalRound && findMatch(t, finalRound.matchIds[0]);
  const tp = t.thirdPlaceId ? findMatch(t, t.thirdPlaceId) : null;
  if (finalMatch && finalMatch.status === 'done' && (!tp || tp.status === 'done')) {
    t.status = 'finished';
    t.winnerId = finalMatch.winnerId;
  }
  return t;
}

/** Ist dieses KO-Match das Finale? */
function isFinal(t, m) {
  return m.phase === 'ko' && m.round === t.bracket.length - 1;
}

/** Liefert den Format-Schlüssel (group|ko|final) für ein Match. */
function phaseKey(t, m) {
  if (!m.phase || m.phase === 'group') return 'group';
  if (m.round === 'third') return 'ko';
  return isFinal(t, m) ? 'final' : 'ko';
}

module.exports = { seedOrder, buildBracket, advanceKo, isFinal, phaseKey, roundName, roundKey };
