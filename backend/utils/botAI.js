'use strict';

/**
 * Dart-Bot-AI: parametrische Randomisierung dreier Schwierigkeitsstufen.
 * Keine echte KI/ML – gewichtete Wahrscheinlichkeiten pro Segment und
 * Treffer-Raten für Checkout-Doubles ergeben realistische Spielstärken.
 *
 * Ziel-Durchschnitte (3-Dart):
 *   easy   ~ 25-35   (Anfänger)
 *   medium ~ 45-65   (Fortgeschritten)
 *   hard   ~ 70-90   (Profi)
 */

const rules = require('./dartRules');

const D = (segment, multiplier) => ({ segment, multiplier });

const PROFILES = {
  easy: {
    doubleHit: 0.18, // Trefferwahrscheinlichkeit auf das finishende Double
    setupHit: 0.45, // Trefferwahrscheinlichkeit auf einen Setup-Dart im Checkout
    scoring: [
      [D(20, 1), 0.28],
      [D(19, 1), 0.10],
      [D(5, 1), 0.15],
      [D(1, 1), 0.15],
      [D(7, 1), 0.07],
      [D(0, 1), 0.25], // Fehlwurf
    ],
  },
  medium: {
    doubleHit: 0.42,
    setupHit: 0.65,
    scoring: [
      [D(20, 3), 0.12],
      [D(20, 1), 0.30],
      [D(19, 1), 0.14],
      [D(5, 1), 0.14],
      [D(1, 1), 0.12],
      [D(0, 1), 0.18],
    ],
  },
  hard: {
    doubleHit: 0.62,
    setupHit: 0.80,
    scoring: [
      [D(20, 3), 0.38],
      [D(20, 1), 0.18],
      [D(19, 3), 0.06],
      [D(1, 1), 0.12],
      [D(5, 1), 0.12],
      [D(0, 1), 0.14],
    ],
  },
};

// Ankerpunkte (Ziel-3-Dart-Ø) für die stufenlose Interpolation des adaptiven Bots.
const ANCHORS = [
  { avg: 30, prof: PROFILES.easy },
  { avg: 55, prof: PROFILES.medium },
  { avg: 80, prof: PROFILES.hard },
];
const lerp = (a, b, t) => a + (b - a) * t;

// Zwei Scoring-Verteilungen gewichtet mischen (Vereinigung der Segmente).
function blendScoring(a, b, t) {
  const key = (d) => `${d.segment}x${d.multiplier}`;
  const map = new Map();
  for (const [d, w] of a) map.set(key(d), { dart: d, wa: w, wb: 0 });
  for (const [d, w] of b) {
    const k = key(d);
    const cur = map.get(k) || { dart: d, wa: 0, wb: 0 };
    cur.wb = w;
    map.set(k, cur);
  }
  const out = [];
  for (const { dart, wa, wb } of map.values()) {
    const w = lerp(wa, wb, t);
    if (w > 0.0001) out.push([{ ...dart }, w]);
  }
  return out;
}

// Erzeugt ein Bot-Profil für einen gewünschten Ziel-Ø (adaptiver Gegner).
function profileForAverage(avg) {
  const a = Math.max(20, Math.min(95, Number(avg) || 50));
  let lo = ANCHORS[0];
  let hi = ANCHORS[ANCHORS.length - 1];
  if (a <= ANCHORS[0].avg) {
    lo = hi = ANCHORS[0];
  } else if (a >= ANCHORS[ANCHORS.length - 1].avg) {
    lo = hi = ANCHORS[ANCHORS.length - 1];
  } else {
    for (let i = 0; i < ANCHORS.length - 1; i++) {
      if (a >= ANCHORS[i].avg && a <= ANCHORS[i + 1].avg) {
        lo = ANCHORS[i];
        hi = ANCHORS[i + 1];
        break;
      }
    }
  }
  const t = hi.avg === lo.avg ? 0 : (a - lo.avg) / (hi.avg - lo.avg);
  return {
    doubleHit: lerp(lo.prof.doubleHit, hi.prof.doubleHit, t),
    setupHit: lerp(lo.prof.setupHit, hi.prof.setupHit, t),
    scoring: blendScoring(lo.prof.scoring, hi.prof.scoring, t),
  };
}

function parseLabel(label) {
  if (label === 'Bull') return D(25, 2);
  if (label === '25') return D(25, 1);
  if (label[0] === 'T') return D(parseInt(label.slice(1), 10), 3);
  if (label[0] === 'D') return D(parseInt(label.slice(1), 10), 2);
  return D(parseInt(label, 10), 1);
}

function weightedPick(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [dart, w] of entries) {
    r -= w;
    if (r <= 0) return { ...dart };
  }
  return { ...entries[entries.length - 1][0] };
}

/** Sicherer Fehlwurf, der nicht überwirft und nicht ungewollt finished. */
function scatterMiss(score) {
  for (const seg of [20, 19, 18, 5, 1]) {
    if (score - seg >= 2) return D(seg, 1);
  }
  return D(0, 1); // reiner Fehlwurf
}

/**
 * Wählt den nächsten Dart eines Bots.
 * @returns {{segment:number, multiplier:number}}
 */
function chooseDart({ score, checkoutMode = 'double', checkIn = 'straight', opened = true, level = 'medium', targetAvg }) {
  const prof = level === 'adaptive' ? profileForAverage(targetAvg) : PROFILES[level] || PROFILES.medium;

  // Double-In: erst mit einem Double eröffnen
  if (checkIn === 'double' && !opened) {
    let target = D(20, 2);
    const path = rules.findCheckout(score, 'double');
    if (path && path.length === 1) target = parseLabel(path[0]);
    return Math.random() < prof.doubleHit ? target : D(20, 1);
  }

  // Checkout-Versuch
  if (score <= 170) {
    const path = rules.findCheckout(score, checkoutMode);
    if (path) {
      const target = parseLabel(path[0]);
      const finishing = path.length === 1;
      const hit = finishing ? prof.doubleHit : prof.setupHit;
      if (Math.random() < hit) return target;
      return scatterMiss(score);
    }
  }

  // Normales Scoring
  return weightedPick(prof.scoring);
}

module.exports = { chooseDart, PROFILES, profileForAverage };
