'use strict';

/**
 * Turnier-Logik: Gruppen-Aufteilung, Round-Robin je Gruppe und Standings mit
 * Tie-Break-Kette (Punkte → Leg-Differenz → direkter Vergleich → Ø → Bull-off).
 */

const { randomUUID } = require('crypto');

const GROUP_NAMES = ['A', 'B', 'C', 'D'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Teilt die Spieler zufällig auf `groupCount` Gruppen auf (Reihum-Verteilung). */
function assignGroups(players, groupCount = 1) {
  const count = groupCount === 2 ? 2 : 1;
  const groups = [];
  for (let i = 0; i < count; i++) {
    groups.push({ id: GROUP_NAMES[i], name: `Gruppe ${GROUP_NAMES[i]}`, playerIds: [] });
  }
  shuffle(players).forEach((p, i) => groups[i % count].playerIds.push(p.id));
  return groups;
}

/** Round-Robin-Paarungen innerhalb jeder Gruppe (Phase "group"). */
function generateGroupMatches(groups) {
  const matches = [];
  for (const g of groups) {
    const ids = g.playerIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        matches.push({
          id: randomUUID(),
          phase: 'group',
          group: g.id,
          p1: ids[i],
          p2: ids[j],
          gameId: null,
          status: 'pending',
          winnerId: null,
          result: null,
        });
      }
    }
  }
  return shuffle(matches);
}

/** Rückwärtskompatibel: einfaches Round-Robin über alle Spieler (eine Gruppe). */
function generateRoundRobin(players) {
  return generateGroupMatches([{ id: 'A', name: 'Gruppe A', playerIds: players.map((p) => p.id) }]);
}

function playerName(t, id) {
  const p = t.players.find((x) => x.id === id);
  return p ? p.name : '?';
}

/** Zählt nur Gruppenspiele; groupId=null => alle (rückwärtskompatibel, ohne Gruppen). */
function countsForStandings(m, groupId) {
  const isGroup = m.phase === undefined || m.phase === 'group';
  if (!isGroup) return false;
  if (groupId == null) return true;
  return m.group === groupId;
}

/** Direkter Vergleich: Gewinner-ID des Gruppenspiels a↔b oder null. */
function headToHead(t, aId, bId) {
  const m = t.matches.find(
    (x) =>
      (x.phase === undefined || x.phase === 'group') &&
      x.status === 'done' &&
      ((x.p1 === aId && x.p2 === bId) || (x.p1 === bId && x.p2 === aId))
  );
  return m ? m.winnerId : null;
}

/** Manuell entschiedener Bull-off zwischen zwei Spielern (Override), sonst null. */
function bullOffWinner(t, aId, bId) {
  const key = [aId, bId].sort().join('|');
  return (t.bullOffs && t.bullOffs[key]) || null;
}

/**
 * Standings einer Gruppe (oder aller Spieler bei groupId=null).
 * liveByMatch: { [matchId]: { p1Legs, p2Legs } } – laufende Legs fließen live in
 * die Leg-Spalten ein (Punkte/Siege erst nach Match-Ende), damit sich die Tabelle
 * bereits nach jedem Leg verändert.
 */
function computeStandings(t, groupId = null, liveByMatch = {}) {
  let playerIds;
  if (groupId != null) {
    const g = (t.groups || []).find((x) => x.id === groupId);
    playerIds = g ? g.playerIds.slice() : [];
  } else {
    playerIds = t.players.map((p) => p.id);
  }

  const acc = new Map();
  for (const id of playerIds) {
    const p = t.players.find((x) => x.id === id);
    if (!p) continue;
    acc.set(id, {
      playerId: id,
      name: p.name,
      type: p.type,
      botLevel: p.botLevel || null,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      legsFor: 0,
      legsAgainst: 0,
      totalPoints: 0,
      totalDarts: 0,
    });
  }

  for (const m of t.matches) {
    if (!countsForStandings(m, groupId)) continue;
    const a = acc.get(m.p1);
    const b = acc.get(m.p2);
    if (!a || !b) continue;

    if (m.status === 'done' && m.result) {
      a.matchesPlayed += 1;
      b.matchesPlayed += 1;
      a.legsFor += m.result.p1.legs || 0;
      a.legsAgainst += m.result.p2.legs || 0;
      b.legsFor += m.result.p2.legs || 0;
      b.legsAgainst += m.result.p1.legs || 0;
      a.totalPoints += m.result.p1.points || 0;
      a.totalDarts += m.result.p1.darts || 0;
      b.totalPoints += m.result.p2.points || 0;
      b.totalDarts += m.result.p2.darts || 0;
      if (m.winnerId === m.p1) {
        a.wins += 1;
        b.losses += 1;
      } else if (m.winnerId === m.p2) {
        b.wins += 1;
        a.losses += 1;
      }
    } else if (liveByMatch[m.id]) {
      // Laufendes Match: nur aktuelle Legs live einrechnen (keine Punkte/Siege).
      const lv = liveByMatch[m.id];
      a.legsFor += lv.p1Legs || 0;
      a.legsAgainst += lv.p2Legs || 0;
      b.legsFor += lv.p2Legs || 0;
      b.legsAgainst += lv.p1Legs || 0;
    }
  }

  const rows = [...acc.values()].map((r) => ({
    playerId: r.playerId,
    name: r.name,
    type: r.type,
    botLevel: r.botLevel,
    wins: r.wins,
    losses: r.losses,
    matchesPlayed: r.matchesPlayed,
    legs: r.legsFor,
    legsAgainst: r.legsAgainst,
    points: r.wins * 2,
    avg: r.totalDarts ? Math.round((r.totalPoints / r.totalDarts) * 3 * 100) / 100 : 0,
    diff: r.legsFor - r.legsAgainst,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    const h = headToHead(t, a.playerId, b.playerId);
    if (h === a.playerId) return -1;
    if (h === b.playerId) return 1;
    if (b.avg !== a.avg) return b.avg - a.avg;
    const bo = bullOffWinner(t, a.playerId, b.playerId);
    if (bo === a.playerId) return -1;
    if (bo === b.playerId) return 1;
    return a.name.localeCompare(b.name);
  });
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Sind zwei Spieler bis einschließlich Ø gleich (nur Bull-off könnte trennen)? */
function fullyTied(t, a, b) {
  return (
    a.points === b.points &&
    a.diff === b.diff &&
    headToHead(t, a.playerId, b.playerId) == null &&
    a.avg === b.avg
  );
}

/**
 * Findet offene Bull-off-Entscheidungen an der Qualifikationsgrenze (nur wenn KO
 * aktiv, alle Gruppenspiele fertig und noch nicht ins KO gestartet).
 */
function pendingGroupTieBreaks(t) {
  if (!t.ko || !t.ko.enabled || t.stage !== 'group') return [];
  if (!allGroupMatchesDone(t)) return [];
  const advance = t.ko.advance || 0;
  if (advance <= 0) return []; // alle kommen weiter -> keine Grenze
  const pending = [];
  for (const g of t.groups || []) {
    if (advance >= g.playerIds.length) continue;
    const rows = computeStandings(t, g.id);
    const a = rows[advance - 1];
    const b = rows[advance];
    if (a && b && fullyTied(t, a, b) && !bullOffWinner(t, a.playerId, b.playerId)) {
      pending.push({ group: g.id, aId: a.playerId, bId: b.playerId, aName: a.name, bName: b.name });
    }
  }
  return pending;
}

function allGroupMatchesDone(t) {
  const groupMatches = t.matches.filter((m) => m.phase === undefined || m.phase === 'group');
  return groupMatches.length > 0 && groupMatches.every((m) => m.status === 'done');
}

function nextMatches(t, limit = 5) {
  return t.matches
    .filter((m) => m.status === 'pending' && m.p1 && m.p2)
    .slice(0, limit)
    .map((m) => ({ id: m.id, p1: playerName(t, m.p1), p2: playerName(t, m.p2) }));
}

module.exports = {
  shuffle,
  assignGroups,
  generateGroupMatches,
  generateRoundRobin,
  computeStandings,
  headToHead,
  bullOffWinner,
  pendingGroupTieBreaks,
  allGroupMatchesDone,
  nextMatches,
  playerName,
  GROUP_NAMES,
};
