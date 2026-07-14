'use strict';

const express = require('express');
const playerStore = require('../models/playerStore');
const { BOT_LEVELS } = require('../utils/validators');
const coach = require('../utils/coach');
const achievementStore = require('../models/achievementStore');
const doubleProfile = require('../utils/doubleProfile');
const { catalog: achCatalog } = require('../utils/achievements');
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

// GET /api/players/:id/achievements – erspielte Abzeichen mit Zeitstempel (neueste zuerst)
router.get('/:id/achievements', (req, res) => {
  const id = Number(req.params.id);
  if (!playerStore.get(id)) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  const out = achievementStore
    .earnedForPlayer(id)
    .map((r) => {
      const a = ACH_MAP.get(r.id);
      return a ? { id: a.id, cat: a.cat, name: a.name, nameEn: a.nameEn, icon: a.icon, earnedAt: r.earnedAt } : null;
    })
    .filter(Boolean);
  res.json(out);
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
