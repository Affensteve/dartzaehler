'use strict';

/**
 * Dart-Regeln: Wurf-Bewertung, Busting, Check-In/Out und Checkout-Vorschläge.
 * Alle Funktionen sind rein (keine Seiteneffekte) und werden sowohl von der
 * Game-Engine als auch (perspektivisch) von den Tests genutzt.
 *
 * Ein "Dart" ist ein Objekt: { segment: number, multiplier: 1|2|3 }
 *   - segment 0            = Fehlwurf (Miss)
 *   - segment 1..20        = normales Feld
 *   - segment 25           = Bull (Single 25 = äußeres Bull, Double 25 = 50 = Bullseye)
 *   - multiplier 1|2|3     = Single / Double / Triple
 */

const START_SCORES = { 701: 701, 601: 601, 501: 501, 301: 301, 101: 101 };

/** Punktwert eines einzelnen Darts. */
function dartPoints(dart) {
  if (!dart || dart.segment === 0) return 0;
  return dart.segment * dart.multiplier;
}

/** Ist der Dart ein "Double" im Sinne der Regeln? (echtes Double oder Bullseye 50) */
function isDoubleDart(dart) {
  if (!dart) return false;
  return dart.multiplier === 2; // gilt auch für segment 25 (25*2 = 50 = Bullseye)
}

/** Lesbares Kürzel eines Darts, z. B. "T20", "D16", "25", "Miss". */
function dartLabel(dart) {
  if (!dart || dart.segment === 0) return 'Miss';
  if (dart.segment === 25) return dart.multiplier === 2 ? 'Bull' : '25';
  const prefix = dart.multiplier === 3 ? 'T' : dart.multiplier === 2 ? 'D' : '';
  return `${prefix}${dart.segment}`;
}

/**
 * Prüft, ob eine Dart-Eingabe technisch gültig ist
 * (verhindert z. B. T25, D0, Segmente > 20).
 */
function isValidDart(dart) {
  if (!dart || typeof dart.segment !== 'number' || typeof dart.multiplier !== 'number') {
    return false;
  }
  const { segment, multiplier } = dart;
  if (![1, 2, 3].includes(multiplier)) return false;
  if (segment === 0) return multiplier === 1;           // Miss nur als Single
  if (segment === 25) return multiplier === 1 || multiplier === 2; // kein Triple-Bull
  if (segment < 1 || segment > 20) return false;
  return true;
}

/**
 * Wendet einen Dart auf den Restscore an und liefert das Ergebnis.
 * @returns {{ remaining, bust, checkout, opened }}
 *   remaining  – neuer Restscore (bei bust der Wert vor dem Wurf)
 *   bust       – true, wenn der Wurf ungültig überworfen wurde
 *   checkout   – true, wenn exakt auf 0 gefinished wurde
 *   opened     – true, wenn der Spieler mit diesem Dart "eröffnet" (Double-In)
 */
function applyDartToScore(remainingBefore, dart, { checkIn, checkoutMode, alreadyOpened }) {
  const points = dartPoints(dart);
  const isDouble = isDoubleDart(dart);

  // --- Check-In: Double-In erfordert ein Double zum Eröffnen ---
  let opened = alreadyOpened;
  if (checkIn === 'double' && !alreadyOpened) {
    if (!isDouble) {
      // Vor dem Eröffnen zählt jeder Nicht-Double-Dart als 0 (kein Bust).
      return { remaining: remainingBefore, bust: false, checkout: false, opened: false };
    }
    opened = true; // dieser Double eröffnet das Spiel
  }

  const remaining = remainingBefore - points;
  const isTriple = Boolean(dart) && dart.multiplier === 3;

  // --- Checkout ---
  if (remaining === 0) {
    // double: nur Doppel; master: Doppel oder Triple; single: beliebig.
    const validFinish =
      checkoutMode === 'single' ? true : checkoutMode === 'master' ? isDouble || isTriple : isDouble;
    if (!validFinish) {
      return { remaining: remainingBefore, bust: true, checkout: false, opened };
    }
    return { remaining: 0, bust: false, checkout: true, opened };
  }

  // --- Bust ---
  // Unter 0, oder bei Double-/Master-Out genau 1 (kein Doppel-/Triple-Finish mehr möglich).
  const needsFinishField = checkoutMode === 'double' || checkoutMode === 'master';
  if (remaining < 0 || (needsFinishField && remaining === 1)) {
    return { remaining: remainingBefore, bust: true, checkout: false, opened };
  }

  return { remaining, bust: false, checkout: false, opened };
}

// --------------------------------------------------------------------------
// Checkout-Vorschläge
// --------------------------------------------------------------------------

// Wurf-Optionen in bevorzugter Reihenfolge (für "schöne" Finishes).
function buildOptions() {
  const setups = [];
  for (let i = 20; i >= 1; i--) setups.push({ label: `T${i}`, points: 3 * i, isDouble: false });
  setups.push({ label: 'Bull', points: 50, isDouble: true });
  setups.push({ label: '25', points: 25, isDouble: false });
  for (let i = 20; i >= 1; i--) setups.push({ label: `D${i}`, points: 2 * i, isDouble: true });
  for (let i = 20; i >= 1; i--) setups.push({ label: `${i}`, points: i, isDouble: false });
  return setups;
}

const OPTIONS = buildOptions();

// Double-Finisher in bevorzugter Reihenfolge (klassische Scorer-Logik).
const DOUBLE_FINISH_ORDER = [
  'D20', 'D16', 'D8', 'D4', 'D2', 'D10', 'D20',
  'D12', 'D18', 'D14', 'D6', 'D19', 'D17', 'D15',
  'D13', 'D11', 'D9', 'D7', 'D5', 'D3', 'D1', 'Bull',
];
const DOUBLE_FINISHERS = DOUBLE_FINISH_ORDER
  .filter((l, i, arr) => arr.indexOf(l) === i)
  .map((label) => OPTIONS.find((o) => o.label === label));

// Single-Out: einfacher Ausgang bevorzugt – erst Singles (inkl. 25), dann Triples,
// dann Doppel, zuletzt Bull. So wird z. B. 10 als "10" statt "D5" empfohlen.
const SINGLE_FINISH_ORDER = [
  ...Array.from({ length: 20 }, (_, i) => String(20 - i)), // '20'..'1'
  '25',
  ...Array.from({ length: 20 }, (_, i) => `T${20 - i}`),
  ...Array.from({ length: 20 }, (_, i) => `D${20 - i}`),
  'Bull',
];
const SINGLE_FINISHERS = SINGLE_FINISH_ORDER
  .map((label) => OPTIONS.find((o) => o.label === label))
  .filter(Boolean);

const byPoints = new Map(OPTIONS.map((o) => [o.points + (o.isDouble ? '_d' : '_s'), o]));
const setupByPoints = (() => {
  const m = new Map();
  for (const o of OPTIONS) if (!m.has(o.points)) m.set(o.points, o); // erste = bevorzugt
  return m;
})();

// --------------------------------------------------------------------------
// Offizielle Checkout-Tabelle (dartcoach.de) für Double-Out, Score 41-170.
// Labels in interner Notation: Bull = Bullseye (50 / D25), "25" = Single-Bull,
// reine Zahl = Single-Feld, T.. = Triple, D.. = Double.
// Quelle: https://www.dartcoach.de/download/dartcoach-checkout-tabelle.pdf
// --------------------------------------------------------------------------
const CHECKOUT_TABLE_RAW = {
  170: 'T20 T20 Bull', 167: 'T20 T19 Bull', 164: 'T20 T18 Bull', 161: 'T20 T17 Bull',
  160: 'T20 T20 D20', 158: 'T20 T20 D19', 157: 'T20 T19 D20', 156: 'T20 T20 D18',
  155: 'T20 T19 D19', 154: 'T20 T18 D20', 153: 'T20 T19 D18', 152: 'T20 T20 D16',
  151: 'T20 T17 D20', 150: 'T20 T18 D18', 149: 'T20 T19 D16', 148: 'T20 T16 D20',
  147: 'T20 T17 D18', 146: 'T19 T19 D16', 145: 'T19 T20 D14', 144: 'T20 T20 D12',
  143: 'T20 T17 D16', 142: 'T18 T20 D14', 141: 'T20 T19 D12', 140: 'T20 T20 D10',
  139: 'T19 T14 D20', 138: 'T20 T18 D12', 137: 'T20 T15 D16', 136: 'T20 T20 D8',
  135: '25 T20 Bull', 134: 'T20 T14 D16', 133: 'T20 T11 D20', 132: 'Bull T14 D20',
  131: 'T20 T13 D16', 130: 'T20 T20 D5', 129: 'T19 T16 D12', 128: 'T18 T14 D16',
  127: 'T20 T17 D8', 126: 'T19 T19 D6', 125: 'Bull T17 D12', 124: 'T20 T16 D8',
  123: 'T19 T16 D9', 122: 'T18 T18 D7', 121: 'T20 T11 D14', 120: 'T20 20 D20',
  119: 'T19 T12 D13', 118: 'T20 18 D20', 117: 'T20 17 D20', 116: 'T20 16 D20',
  115: 'T20 15 D20', 114: 'T20 14 D20', 113: 'T19 16 D20', 112: 'T20 12 D20',
  111: 'T20 11 D20', 110: 'T20 10 D20', 109: 'T20 9 D20', 108: 'T20 16 D16',
  107: 'T19 18 D16', 106: 'T20 14 D16', 105: 'T20 13 D16', 104: 'T18 18 D16',
  103: 'T19 14 D16', 102: 'T20 10 D16', 101: 'T20 9 D16', 100: 'T20 D20',
  99: 'T19 10 D16', 98: 'T20 D19', 97: 'T19 D20', 96: 'T20 D18', 95: 'T19 D19',
  94: 'T18 D20', 93: 'T19 D18', 92: 'T20 D16', 91: 'T17 D20', 90: 'T20 D15',
  89: 'T19 D16', 88: 'T20 D14', 87: 'T17 D18', 86: 'T18 D16', 85: 'T15 D20',
  84: 'T20 D12', 83: 'T17 D16', 82: 'Bull D16', 81: 'T19 D12', 80: 'T20 D10',
  79: 'T19 D11', 78: 'T18 D12', 77: 'T19 D10', 76: 'T20 D8', 75: 'T17 D12',
  74: 'T14 D16', 73: 'T17 D11', 72: 'T16 D12', 71: 'T13 D16', 70: 'T18 D8',
  69: 'T15 D12', 68: 'T20 D4', 67: 'T17 D8', 66: 'T10 D18', 65: 'T11 D16',
  64: 'T16 D8', 63: 'T13 D12', 62: 'T10 D16', 61: 'T15 D8', 60: '20 D20',
  59: '19 D20', 58: '18 D20', 57: '17 D20', 56: '16 D20', 55: '15 D20',
  54: '14 D20', 53: '13 D20', 52: '12 D20', 51: '19 D16', 50: '18 D16',
  49: '9 D20', 48: '16 D16', 47: '15 D16', 46: '14 D16', 45: '13 D16',
  44: '12 D16', 43: '11 D16', 42: '10 D16', 41: '9 D16',
};

// Restscores 2-40 (unterhalb der Tabelle) nach Standard ergänzen:
// gerade -> direktes Doppel, ungerade -> Single stellen und "schönes" Doppel lassen.
const CHECKOUT_TABLE = (() => {
  const t = {};
  for (const [k, v] of Object.entries(CHECKOUT_TABLE_RAW)) t[k] = v.split(' ');
  for (let n = 2; n <= 40; n++) {
    if (n % 2 === 0) {
      t[n] = [`D${n / 2}`];
    } else {
      // bevorzugt 32/16/8/4/2 stehen lassen (D16/D8/D4/D2/D1)
      for (const dv of [32, 16, 8, 4, 2]) {
        const s = n - dv;
        if (s >= 1 && s <= 20) {
          t[n] = [`${s}`, `D${dv / 2}`];
          break;
        }
      }
    }
  }
  return t;
})();

// --------------------------------------------------------------------------
// Master-Out-Tabelle (darts1.de), Score 46-180. Beim Master Out darf mit einem
// Doppel ODER Triple ausgecheckt werden. 'DB' der Quelle = Bullseye (Bull).
// Quelle: https://www.darts1.de/outchart/master-out.php
// --------------------------------------------------------------------------
const MASTER_OUT_TABLE_RAW = {
  180: 'T20 T20 T20', 177: 'T19 T20 T20', 174: 'T20 T20 T18', 171: 'T19 T19 T19',
  170: 'Bull T20 T20', 168: 'T20 T20 T16', 167: 'Bull T19 T20', 165: 'T19 T19 T17',
  164: 'Bull T19 T19', 162: 'T18 T18 T18', 161: 'Bull T17 T20', 160: 'T20 T20 D20',
  159: 'T19 T17 T17', 158: 'T20 T20 D19', 157: 'T19 T20 D20', 156: 'T20 T20 D18',
  155: 'T20 T19 D19', 154: 'T19 T19 D20', 153: 'T19 T20 D18', 152: 'T20 T20 D16',
  151: 'T17 T20 D20', 150: 'T19 T19 D18', 149: 'T20 T19 D16', 148: 'T20 T20 D14',
  147: 'T19 T18 D18', 146: 'T19 T19 D16', 145: 'Bull T19 D19', 144: 'T18 T18 D18',
  143: 'T18 T19 D16', 142: 'Bull T20 D16', 141: 'T19 T20 D12', 140: 'T20 T20 D10',
  139: 'T19 Bull D16', 138: 'T18 T20 D12', 137: 'T20 T17 D13', 136: 'T19 T19 D11',
  135: 'T15 T18 D18', 134: 'T20 T14 D16', 133: 'T19 T16 D14', 132: 'T18 T18 D12',
  131: 'T17 T20 D10', 130: 'T19 T19 D8', 129: 'T18 T15 D15', 128: 'T20 T20 D4',
  127: 'T19 T10 D20', 126: 'T18 T12 D18', 125: 'T17 T14 D16', 124: 'T16 T16 D14',
  123: 'T15 T18 D12', 122: 'T14 T20 D10', 121: 'T19 T16 D8', 120: 'T20 T20',
  119: 'T20 19 D20', 118: 'T20 18 D20', 117: 'T19 T20', 116: 'T20 16 D20',
  115: 'T20 15 D20', 114: 'T19 T19', 113: 'T20 17 D18', 112: 'T18 18 D20',
  111: 'T19 T18', 110: 'Bull T20', 109: 'T18 15 D20', 108: 'T18 T18',
  107: 'Bull T19', 106: 'T20 6 D20', 105: 'T19 T16', 104: 'Bull T18',
  103: 'T19 6 D20', 102: 'T20 T14', 101: 'Bull T17', 100: 'T20 D20',
  99: 'T19 T14', 98: 'T20 D19', 97: 'T19 D20', 96: 'T20 D18', 95: 'T19 D19',
  94: 'T18 D20', 93: 'T19 D18', 92: 'T20 D16', 91: 'T17 D20', 90: 'T18 D18',
  89: 'T19 D16', 88: 'T16 D20', 87: 'T17 D18', 86: 'T18 D16', 85: 'T15 D20',
  84: 'T20 D12', 83: 'T17 D16', 82: 'Bull D16', 81: 'T19 D12', 80: 'T20 D10',
  79: 'T19 D11', 78: 'T18 D12', 77: 'T17 D13', 76: 'T16 D14', 75: 'T15 D15',
  74: 'T14 D16', 73: 'T19 D8', 72: 'T12 D18', 71: 'T17 D10', 70: 'T10 D20',
  69: 'T15 D12', 68: 'T20 D4', 67: 'T13 D14', 66: 'T10 D18', 65: 'T11 D16',
  64: 'T16 D8', 63: 'T9 D18', 62: 'T14 D10', 61: 'T7 D20', 60: 'T20',
  59: '19 D20', 58: '18 D20', 57: 'T19', 56: '16 D20', 55: '15 D20',
  54: 'T18', 53: '17 D18', 52: '16 D18', 51: 'T17', 50: '14 D18',
  49: '13 D18', 48: 'T16', 47: '11 D18', 46: '6 D20',
};
const MASTER_OUT_TABLE = (() => {
  const t = {};
  for (const [k, v] of Object.entries(MASTER_OUT_TABLE_RAW)) t[k] = v.split(' ');
  return t;
})();

// Master-Out-Finisher: Triple oder Doppel (Bull = Doppel). Für Restscores < 46,
// die nicht in der Tabelle stehen, dienen sie dem algorithmischen Finder.
const MASTER_FINISH_ORDER = [
  ...Array.from({ length: 20 }, (_, i) => `T${20 - i}`),
  ...Array.from({ length: 20 }, (_, i) => `D${20 - i}`),
  'Bull',
];
const MASTER_FINISHERS = MASTER_FINISH_ORDER.map((l) => OPTIONS.find((o) => o.label === l)).filter(Boolean);

/**
 * Findet einen Checkout-Weg (max. 3 Darts) für einen Restscore.
 * @param {number} score
 * @param {'double'|'single'} mode
 * @returns {string[]|null} z. B. ["T20","T20","D20"] oder null (nicht finishbar)
 */
function findCheckout(score, mode = 'double', maxDarts = 3) {
  const max = mode === 'double' ? 170 : 180; // Master/Single: bis 180 (Triple-Finish möglich)
  if (score <= 0 || score > max) return null;

  // Modus-spezifische Tabelle bevorzugen (nur wenn sie in die verbleibenden Pfeile passt).
  const table = mode === 'double' ? CHECKOUT_TABLE : mode === 'master' ? MASTER_OUT_TABLE : null;
  if (table && table[score] && table[score].length <= maxDarts) {
    return table[score].slice();
  }

  const finishers =
    mode === 'double' ? DOUBLE_FINISHERS : mode === 'master' ? MASTER_FINISHERS : SINGLE_FINISHERS;

  // 1 Dart
  for (const f of finishers) {
    if (f.points === score) return [f.label];
  }
  if (maxDarts < 2) return null;
  // 2 Darts
  for (const f of finishers) {
    const rem = score - f.points;
    if (rem <= 0) continue;
    const setup = setupByPoints.get(rem);
    if (setup) return [setup.label, f.label];
  }
  if (maxDarts < 3) return null;
  // 3 Darts
  for (const f of finishers) {
    const rem = score - f.points;
    if (rem <= 0) continue;
    for (const a of OPTIONS) {
      const rem2 = rem - a.points;
      if (rem2 <= 0) continue;
      const b = setupByPoints.get(rem2);
      if (b) return [a.label, b.label, f.label];
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// Personalisierte Checkout-Empfehlung (Stufe 2b)
// --------------------------------------------------------------------------

// Feste Schwellenwerte: ein Doppel gilt nur als "verlässlicher" Ersatz, wenn
// genug Datenpunkte vorliegen UND die Trefferquote klar über der des
// Standard-Doppels liegt.
const PERSONALIZATION_MIN_ATTEMPTS = 15;
const PERSONALIZATION_MIN_EDGE = 0.15;

/**
 * Sucht eine Route mit exakt `dartCount` Darts, die auf `doubleOption` endet
 * (inkl. Aufbau-Würfe, die dafür frei neu hergeleitet werden).
 * @returns {string[]|null}
 */
function routeToDouble(score, doubleOption, dartCount) {
  if (dartCount === 1) {
    return doubleOption.points === score ? [doubleOption.label] : null;
  }
  if (dartCount === 2) {
    const rem = score - doubleOption.points;
    if (rem <= 0) return null;
    const setup = setupByPoints.get(rem);
    return setup ? [setup.label, doubleOption.label] : null;
  }
  if (dartCount === 3) {
    const rem = score - doubleOption.points;
    if (rem <= 0) return null;
    for (const a of OPTIONS) {
      const rem2 = rem - a.points;
      if (rem2 <= 0) continue;
      const b = setupByPoints.get(rem2);
      if (b) return [a.label, b.label, doubleOption.label];
    }
    return null;
  }
  return null;
}

/**
 * Wie `findCheckout`, weicht aber – nur im Double-Out-Modus und nur bei
 * ausreichend besserer Trefferquote (`doubleProfile`) – auf ein Doppel aus,
 * das der Spieler zuverlässiger trifft. Die Dartzahl bleibt dabei immer
 * gleich zur Standard-Route, sodass das Ergebnis nie schlechter ist.
 * @param {number} score
 * @param {'double'|'single'} mode
 * @param {Object<string, number>|null} doubleProfile Trefferquote (0..1) je Doppel-Label
 * @returns {{route: string[], personalized: boolean, targetDouble?: string}|null}
 */
// Summe der (bekannten) Triple-Trefferquoten der Setup-Würfe einer Route.
function scoreTriples(route, tripleProfile) {
  if (!tripleProfile || !route) return 0;
  return route.reduce((acc, l) => acc + (l && l[0] === 'T' ? tripleProfile[l] || 0 : 0), 0);
}

// Wie routeToDouble, wählt aber unter gleichwertigen 3-Dart-Routen jene mit den
// vom Spieler am besten getroffenen Setup-Triples.
function bestRouteToDouble(score, doubleOption, dartCount, tripleProfile) {
  if (dartCount !== 3) return routeToDouble(score, doubleOption, dartCount);
  const rem = score - doubleOption.points;
  if (rem <= 0) return null;
  let best = null;
  for (const a of OPTIONS) {
    const rem2 = rem - a.points;
    if (rem2 <= 0) continue;
    const b = setupByPoints.get(rem2);
    if (!b) continue;
    const route = [a.label, b.label, doubleOption.label];
    const sc = scoreTriples(route, tripleProfile);
    if (!best || sc > best.sc) best = { route, sc };
  }
  return best ? best.route : null;
}

/**
 * Wie `findCheckout`, weicht aber – nur im Double-Out-Modus – auf ein Doppel aus,
 * das der Spieler zuverlässiger trifft (`doubleProfile`), und wählt bei gleicher
 * Dartzahl die Setup-Triples, die er am besten trifft (`tripleProfile`). Die
 * Dartzahl bleibt immer identisch zur Standard-Route.
 * @param {number} score
 * @param {'double'|'single'|'master'} mode
 * @param {Object<string, number>|null} doubleProfile Trefferquote (0..1) je Doppel-Label
 * @param {number} maxDarts
 * @param {Object<string, number>|null} tripleProfile Trefferquote (0..1) je Triple-Label
 * @returns {{route: string[], personalized: boolean, targetDouble?: string}|null}
 */
function findPersonalizedCheckout(score, mode, doubleProfile, maxDarts = 3, tripleProfile = null) {
  const base = findCheckout(score, mode, maxDarts);
  if (!base) return null;
  if (mode !== 'double') return { route: base, personalized: false };
  const hasD = doubleProfile && Object.keys(doubleProfile).length > 0;
  const hasT = tripleProfile && Object.keys(tripleProfile).length > 0;
  if (!hasD && !hasT) return { route: base, personalized: false };

  const n = base.length;
  const baseKey = base[base.length - 1];
  const baseRate = (hasD ? doubleProfile[baseKey] : undefined) ?? 0;

  // 1) Finish-Doppel evtl. tauschen (nur bei klar besserer Quote).
  let targetLabel = baseKey;
  let dChanged = false;
  if (hasD) {
    let bestRate = baseRate;
    for (const d of DOUBLE_FINISHERS) {
      if (d.label === baseKey) continue;
      const rate = doubleProfile[d.label];
      if (rate === undefined || rate - baseRate < PERSONALIZATION_MIN_EDGE) continue;
      if (routeToDouble(score, d, n) && rate > bestRate) {
        bestRate = rate;
        targetLabel = d.label;
        dChanged = true;
      }
    }
  }
  const dblOpt = DOUBLE_FINISHERS.find((o) => o.label === targetLabel) || DOUBLE_FINISHERS.find((o) => o.label === baseKey);
  const refRoute = dChanged ? routeToDouble(score, dblOpt, n) || base : base;

  // 2) Setup-Triples optimieren (nur wenn es die Triple-Quote wirklich verbessert).
  let route = refRoute;
  let tChanged = false;
  if (hasT && dblOpt) {
    const opt = bestRouteToDouble(score, dblOpt, n, tripleProfile);
    if (opt && scoreTriples(opt, tripleProfile) > scoreTriples(refRoute, tripleProfile)) {
      route = opt;
      tChanged = true;
    }
  }
  return { route, personalized: dChanged || tChanged, targetDouble: dChanged ? targetLabel : undefined };
}

module.exports = {
  START_SCORES,
  dartPoints,
  isDoubleDart,
  dartLabel,
  isValidDart,
  applyDartToScore,
  findCheckout,
  findPersonalizedCheckout,
  routeToDouble,
  OPTIONS,
  byPoints,
  DOUBLE_FINISHERS,
  PERSONALIZATION_MIN_ATTEMPTS,
  PERSONALIZATION_MIN_EDGE,
};
