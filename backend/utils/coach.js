'use strict';

const statsStore = require('../models/statsStore');
const { getPlayerDoubleProfile } = require('./doubleProfile');
const customDrillStore = require('../models/customDrillStore');
const trainingStore = require('../models/trainingStore');

/**
 * Regelbasierter KI-Coach (lokal, offline): leitet aus der Spielstatistik und
 * dem Doppel-Profil eines Spielers ein Schwächen-Ranking und daraus konkrete
 * Trainingsempfehlungen (auf die vorhandenen Trainingsmodi gemappt) ab.
 * Zusätzlich „Fokus", eine erkannte Stärke und ein Ø-Trend aus der Timeline.
 * Kein externer Dienst – reine Heuristik über die bereits erfassten Daten.
 */

const MIN_GAMES = 3; // darunter: Hinweis „zu wenig Daten", nur grobe Empfehlung

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}
// Schwere 0..1: value >= good -> 0 (stark), value <= bad -> 1 (schwach).
function sevLow(value, good, bad) {
  if (value >= good) return 0;
  if (value <= bad) return 1;
  return clamp((good - value) / (good - bad), 0, 1);
}
function levelOf(sev) {
  return sev >= 0.66 ? 'hoch' : sev >= 0.33 ? 'mittel' : 'niedrig';
}

// Schwächstes Ziel-Doppel aus dem gepoolten Profil (nur mit genug Versuchen).
function weakestDouble(profile) {
  let min = null;
  for (const [key, rate] of Object.entries(profile || {})) {
    if (!min || rate < min.rate) min = { key, rate };
  }
  return min;
}

function coachForPlayer(playerId) {
  const s = statsStore.get(playerId); // Spiel/Turnier, gesamte Zeit
  if (!s) return null;
  const dp = getPlayerDoubleProfile(playerId);
  const games = s.games || 0;
  const hasData = games >= MIN_GAMES;

  const cands = [];

  // 1) Checkout / Finish
  {
    const v = s.checkoutPct || 0;
    cands.push({
      id: 'checkout',
      mode: 'checkout',
      metricKey: 'checkoutPct',
      value: v,
      metric: `${v}%`,
      sev: sevLow(v, 40, 12),
      titleKey: 'coach.w.checkout',
      rationaleKey: 'coach.r.checkout',
      vars: { value: v },
    });
  }
  // 2) Doppel-Treffer
  {
    const v = s.doubleRatePct || 0;
    const wd = weakestDouble(dp);
    cands.push({
      id: 'doubles',
      mode: 'bob27',
      metricKey: 'doubleRatePct',
      value: v,
      metric: `${v}%`,
      sev: sevLow(v, 24, 8),
      titleKey: 'coach.w.doubles',
      rationaleKey: wd ? 'coach.r.doublesWeak' : 'coach.r.doubles',
      vars: { value: v, double: wd ? wd.key : '', rate: wd ? Math.round(wd.rate * 100) : 0 },
    });
  }
  // 3) Scoring-Power (Ø)
  {
    const v = s.average || 0;
    cands.push({
      id: 'scoring',
      mode: 'countup',
      metricKey: 'average',
      value: v,
      metric: `Ø ${v}`,
      sev: sevLow(v, 55, 24),
      titleKey: 'coach.w.scoring',
      rationaleKey: 'coach.r.scoring',
      vars: { value: v },
    });
  }
  // 4) Anlauf / Erste 9
  {
    const v = s.first9Avg || 0;
    cands.push({
      id: 'first9',
      mode: 'clock',
      metricKey: 'first9Avg',
      value: v,
      metric: `Ø ${v}`,
      sev: sevLow(v, 60, 28),
      titleKey: 'coach.w.first9',
      rationaleKey: 'coach.r.first9',
      vars: { value: v },
    });
  }
  // 5) Hohe Aufnahmen (100+)
  {
    const per = games ? Math.round(((s.s100 || 0) / games) * 10) / 10 : 0;
    cands.push({
      id: 'bigscores',
      mode: 'shanghai',
      metricKey: 's100PerGame',
      value: per,
      metric: `${per}/Spiel`,
      sev: sevLow(per, 1.5, 0.1),
      titleKey: 'coach.w.bigscores',
      rationaleKey: 'coach.r.bigscores',
      vars: { value: per },
    });
  }

  cands.forEach((c) => {
    c.level = levelOf(c.sev);
  });

  const weaknesses = cands.slice().sort((a, b) => b.sev - a.sev);
  const focus = hasData ? weaknesses.find((c) => c.sev >= 0.2) || null : null;

  const best = cands.slice().sort((a, b) => a.sev - b.sev)[0];
  const strength = hasData && best && best.sev <= 0.2 ? best : null;

  let trend = null;
  const tl = statsStore.timeline(playerId, { training: false });
  if (tl.length >= 2) {
    const a = tl[tl.length - 2].average;
    const b = tl[tl.length - 1].average;
    const delta = Math.round((b - a) * 10) / 10;
    trend = { fromAvg: a, toAvg: b, delta, direction: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat' };
  }

  // Trainings-Builder: heutige Übungen aus dem Wochenplan + Fortschritt (Bestwert vs. Ziel).
  let plan = [];
  try {
    const today = ((new Date().getDay() + 6) % 7) + 1; // Mo=1 … So=7
    const bests = trainingStore.playerBests(s.playerId);
    plan = customDrillStore
      .list(s.playerId)
      .filter((d) => d.weekday === today)
      .map((d) => {
        const best = bests[`custom_${d.id}`] ?? null;
        return { id: d.id, name: d.name, goal: d.goal, best, reached: d.goal > 0 && best != null && best >= d.goal };
      });
  } catch (e) {
    /* Plan ist optional */
  }

  return { playerId: s.playerId, name: s.name, games, hasData, minGames: MIN_GAMES, focus, weaknesses, strength, trend, plan };
}

module.exports = { coachForPlayer };
