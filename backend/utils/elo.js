'use strict';

// Lokales Elo-Rating für X01-Einzelspiele. Das Rating wird pro Match aktualisiert
// und berücksichtigt die Ergebnis-Höhe (Margin) als Multiplikator. Bots haben ein
// festes Rating je Spielstärke, das sich nie ändert (dienen als Referenzpunkte).

const START_ELO = 1000;
const K = 32;

// Feste Ratings je Bot-Level. Fließen in die Berechnung ein, ändern sich aber nie.
const BOT_ELO = { easy: 700, easyplus: 850, medium: 1050, hard: 1350, adaptive: 1050 };

function botElo(level) {
  return Object.prototype.hasOwnProperty.call(BOT_ELO, level) ? BOT_ELO[level] : 1000;
}

// Erwartungswert (Siegwahrscheinlichkeit) für A gegen B.
function expected(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

// Multiplikator aus der Deutlichkeit des Ergebnisses (Sätze bzw. Legs des Siegers/Verlierers).
// Knapper Ausgang ~1.0, ein Whitewash bis ~1.75.
function marginFactor(winUnits, loseUnits) {
  const w = Math.max(0, Number(winUnits) || 0);
  const l = Math.max(0, Number(loseUnits) || 0);
  const total = w + l;
  if (total <= 0) return 1;
  return 1 + 0.75 * ((w - l) / total);
}

// Neue Ratings nach einem Match. scoreA = 1 (A gewinnt) oder 0 (A verliert).
// Die Änderung ist symmetrisch (nullsummen), sodass Aufrufer bei Bedarf nur eine
// Seite übernehmen können (z. B. wenn der Gegner ein Bot mit festem Rating ist).
function update(ra, rb, scoreA, mf = 1) {
  const ea = expected(ra, rb);
  const delta = K * mf * (scoreA - ea);
  return { a: ra + delta, b: rb - delta, delta };
}

module.exports = { START_ELO, K, BOT_ELO, botElo, expected, marginFactor, update };
