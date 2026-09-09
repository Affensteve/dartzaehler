'use strict';

/**
 * Wandelt die Wurf-Notation des Darterkenners in einen Engine-Dart um.
 * Frei von Seiteneffekten/DB, damit unabhängig testbar.
 *
 * Eingabe (Darterkenner):
 *   segment:   "1".."20" | "BULL" | "M1".."M20" | "MISS"
 *   multiplier:"single" | "double" | "triple" | "bullseye" | null
 *
 * Rückgabe:
 *   { segment: number, multiplier: 1|2|3 }  – Treffer
 *   null                                     – Miss/ungültig (= 0 Punkte)
 */

const MULT = { single: 1, double: 2, triple: 3 };

function parseThrow(th) {
  if (!th || typeof th !== 'object') return null;
  let seg = th.segment;
  const mult = th.multiplier;
  if (seg == null) return null;
  seg = String(seg).trim().toUpperCase();

  // Außenring-Miss (M1..M20) und kompletter Fehlwurf (MISS) => 0 Punkte.
  if (seg === 'MISS' || /^M([1-9]|1[0-9]|20)$/.test(seg)) return null;

  if (seg === 'BULL') {
    // Bullseye (50) = Double 25; einfaches Bull (25) = Single 25.
    if (mult === 'bullseye' || mult === 'double') return { segment: 25, multiplier: 2 };
    return { segment: 25, multiplier: 1 };
  }

  const n = parseInt(seg, 10);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return { segment: n, multiplier: MULT[mult] || 1 };
}

module.exports = { parseThrow };
