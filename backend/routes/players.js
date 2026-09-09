'use strict';

const express = require('express');
const playerStore = require('../models/playerStore');
const { BOT_LEVELS } = require('../utils/validators');
const coach = require('../utils/coach');
const achievementStore = require('../models/achievementStore');
const doubleProfile = require('../utils/doubleProfile');
const tripleProfile = require('../utils/tripleProfile');
const rules = require('../utils/dartRules');
const statsStore = require('../models/statsStore');
const trainingStore = require('../models/trainingStore');
const matchHistoryStore = require('../models/matchHistoryStore');
const { catalog: achCatalog, progressFor } = require('../utils/achievements');
const ACH_MAP = new Map(achCatalog().map((a) => [a.id, a]));

const router = express.Router();

// GET /api/players – alle gespeicherten Spieler
router.get('/', (req, res) => {
  res.json(playerStore.list());
});

// GET /api/players/:id – einzelner Spieler inkl. Profilfelder
router.get('/:id', (req, res) => {
  const p = playerStore.get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  res.json(p);
});

// GET /api/players/:id/coach – regelbasierte Trainingsempfehlungen (KI-Coach)
router.get('/:id/coach', (req, res) => {
  const data = coach.coachForPlayer(req.params.id);
  if (!data) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  res.json(data);
});

// GET /api/players/:id/doubles – gemessene Doppel-Trefferquoten (Lieblings-/Angst-Doppel)
router.get('/:id/doubles', (req, res) => {
  const id = Number(req.params.id);
  if (!playerStore.get(id)) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  const list = doubleProfile.getPlayerDoubleStats(id);
  res.json({ list, best: list[0] || null, worst: list.length ? list[list.length - 1] : null });
});

// GET /api/players/:id/achievements – erspielte Abzeichen (neueste zuerst) +
// Fortschritt der noch offenen, messbaren Achievements (höchster Fortschritt zuerst).
router.get('/:id/achievements', (req, res) => {
  const id = Number(req.params.id);
  if (!playerStore.get(id)) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  const earnedRows = achievementStore.earnedForPlayer(id);
  const earnedSet = new Set(earnedRows.map((r) => r.id));
  const earned = earnedRows
    .map((r) => {
      const a = ACH_MAP.get(r.id);
      if (!a) return null;
      const item = { id: a.id, cat: a.cat, name: a.name, nameEn: a.nameEn, icon: a.icon, earnedAt: r.earnedAt };
      // Feld-Detail rückwirkend aus der Historie (z. B. „Shanghai (5)").
      if (a.id === 'shanghai-live') {
        const field = matchHistoryStore.shanghaiFieldForPlayer(id);
        if (field) item.field = field;
      }
      return item;
    })
    .filter(Boolean);

  const ctx = {
    agg: statsStore.get(id, 'all', { training: false }) || {},
    training: trainingStore.playerStats(id, 'all') || {},
    playStreak: statsStore.playDayStreak(id),
    trainStreak: trainingStore.trainDayStreak(id),
  };
  const prog = progressFor(ctx);
  const progress = Object.entries(prog)
    .filter(([aid]) => !earnedSet.has(aid) && (prog[aid].cur > 0)) // nur begonnene offene Ziele
    .map(([aid, p]) => {
      const a = ACH_MAP.get(aid);
      return a
        ? { id: aid, cat: a.cat, name: a.name, nameEn: a.nameEn, desc: a.desc, descEn: a.descEn, icon: a.icon, cur: p.cur, target: p.target, pct: p.pct }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);

  res.json({ earned, progress });
});

// GET /api/players/:id/checkout-table – persönliche Checkout-Tabelle: je Rest die
// Standard-Route und – falls ein gemessenes Doppel-Profil vorliegt – die auf den
// persönlich besten Doppeln basierende Route. deviates=true, wenn beide abweichen.
router.get('/:id/checkout-table', (req, res) => {
  const id = Number(req.params.id);
  const p = playerStore.get(id);
  if (!p) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  const mode = ['single', 'master'].includes(p.checkoutMode) ? p.checkoutMode : 'double';
  const profile = doubleProfile.getPlayerDoubleProfile(id) || {};
  const tprofile = tripleProfile.getPlayerTripleProfile(id) || {};
  const hasProfile = Object.keys(profile).length > 0 || Object.keys(tprofile).length > 0;
  const rows = [];
  for (let rest = 170; rest >= 2; rest--) {
    const std = rules.findCheckout(rest, mode, 3);
    if (!std) continue;
    let personal = std;
    let deviates = false;
    if (hasProfile) {
      const pers = rules.findPersonalizedCheckout(rest, mode, profile, 3, tprofile);
      if (pers && pers.route) {
        personal = pers.route;
        deviates = pers.route.join(' ') !== std.join(' ');
      }
    }
    rows.push({ rest, standard: std, personal, deviates });
  }
  res.json({ mode, hasProfile, rows });
});

// POST /api/players – neuen Spieler anlegen
router.post('/', (req, res) => {
  const { name, type, botLevel, checkoutMode, dartId, personalizeCheckout, voice } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Name erforderlich.' });
  }
  const t = type === 'bot' ? 'bot' : 'human';
  const lvl = t === 'bot' && BOT_LEVELS.includes(botLevel) ? botLevel : t === 'bot' ? 'medium' : null;
  const player = playerStore.create({
    name: String(name).trim().slice(0, 40),
    type: t,
    botLevel: lvl,
    checkoutMode: ['single', 'master'].includes(checkoutMode) ? checkoutMode : 'double',
    dartId: Number.isInteger(dartId) ? dartId : null,
    personalizeCheckout: personalizeCheckout === true,
    voice: typeof voice === 'string' ? voice : null,
  });
  res.status(201).json(player);
});

// PUT /api/players/:id – Spieler umbenennen und/oder Checkout-Modus setzen (persistiert)
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, checkoutMode, dartId, personalizeCheckout, voice } = req.body || {};
  if (!playerStore.get(id)) {
    return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  }
  if (name != null) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Name erforderlich.' });
    playerStore.rename(id, name);
  }
  if (['single', 'double', 'master'].includes(checkoutMode)) {
    playerStore.setCheckoutMode(id, checkoutMode);
  }
  if (Number.isInteger(dartId)) {
    playerStore.setDart(id, dartId);
  }
  if (typeof personalizeCheckout === 'boolean') {
    playerStore.setPersonalizeCheckout(id, personalizeCheckout);
  }
  if (voice === null || typeof voice === 'string') {
    playerStore.setVoice(id, voice || null);
  }
  res.json(playerStore.get(id));
});

// PUT /api/players/:id/profile – erweiterte Profilfelder aktualisieren (partiell)
router.put('/:id/profile', (req, res) => {
  const id = Number(req.params.id);
  if (!playerStore.get(id)) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  const allowed = ['photo', 'color', 'nickname', 'handedness', 'favoriteDouble', 'birthday', 'club', 'notes'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  res.json(playerStore.setProfile(id, patch));
});

module.exports = router;
