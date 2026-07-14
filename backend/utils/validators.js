'use strict';

/** Kleine Eingabe-Validierer für die REST-API. */

const MODES = [501, 301, 101];
const CHECK_IN = ['straight', 'double'];
const CHECKOUT = ['double', 'single', 'master'];
const BOT_LEVELS = ['easy', 'medium', 'hard', 'adaptive'];
const SATZ_LEG = ['firstto', 'bestof', 'unlimited'];

function sanitizePlayer(p) {
  if (!p || typeof p.name !== 'string' || !p.name.trim()) {
    throw new Error('Spieler benötigt einen Namen.');
  }
  const type = p.type === 'bot' ? 'bot' : 'human';
  return {
    id: p.id,
    name: p.name.trim().slice(0, 40),
    type,
    botLevel: type === 'bot' ? (BOT_LEVELS.includes(p.botLevel) ? p.botLevel : 'medium') : null,
    checkoutMode: CHECKOUT.includes(p.checkoutMode) ? p.checkoutMode : 'double',
    dartId: Number.isInteger(p.dartId) ? p.dartId : null,
    adaptivePush: type === 'bot' && p.adaptivePush === true,
  };
}

function sanitizeGameConfig(body) {
  const mode = MODES.includes(Number(body.mode)) ? Number(body.mode) : 501;
  const checkIn = CHECK_IN.includes(body.checkIn) ? body.checkIn : 'straight';
  const satzLegMode = SATZ_LEG.includes(body.satzLegMode) ? body.satzLegMode : 'firstto';
  const sets = Math.min(Math.max(parseInt(body.sets, 10) || 1, 1), 15);
  const legs = Math.min(Math.max(parseInt(body.legs, 10) || 3, 1), 15);
  // Rundenlimit fürs Ausbullen: weggelassen = 20 (Standard), 0 = deaktiviert
  const maxRounds =
    body.maxRounds == null ? 20 : Math.min(Math.max(parseInt(body.maxRounds, 10) || 0, 0), 99);
  const inputMode = ['sum', 'board'].includes(body.inputMode) ? body.inputMode : 'numpad';
  const players = Array.isArray(body.players) ? body.players.map(sanitizePlayer) : [];

  // Doppel/Team: optionales teams-Array. Jedes Team hat Mitglieder (nur Menschen)
  // und einen Checkout-Modus. Mindestens zwei Teams mit je einem Mitglied.
  let teams = null;
  if (Array.isArray(body.teams) && body.teams.length >= 2) {
    teams = body.teams.map((tm) => {
      const members = (Array.isArray(tm.members) ? tm.members : []).map((mp) => {
        const sp = sanitizePlayer(mp);
        sp.type = 'human';
        sp.botLevel = null;
        return sp;
      });
      if (members.length < 1) throw new Error('Jedes Team braucht mindestens einen Spieler.');
      return {
        name: typeof tm.name === 'string' ? tm.name.trim().slice(0, 40) : '',
        color: typeof tm.color === 'string' ? tm.color.slice(0, 20) : null,
        checkoutMode: [...CHECKOUT, 'individual'].includes(tm.checkoutMode) ? tm.checkoutMode : 'double',
        members,
      };
    });
  }

  if (!teams && players.length < 1) throw new Error('Mindestens ein Spieler erforderlich.');
  return {
    mode,
    checkIn,
    satzLegMode,
    sets,
    legs,
    maxRounds,
    inputMode,
    training: Boolean(body.training),
    players,
    teams,
    randomOrder: Boolean(body.randomOrder),
  };
}

module.exports = { sanitizePlayer, sanitizeGameConfig, MODES, BOT_LEVELS };
