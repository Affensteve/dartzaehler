'use strict';

const express = require('express');
const engine = require('../utils/partyEngine');
const partyStore = require('../models/partyStore');
const playerStore = require('../models/playerStore');
const gameEvents = require('../utils/gameEvents');
const achievementEval = require('../utils/achievementEval');
const { catalog } = require('../utils/achievements');

const router = express.Router();
const ACH = new Map(catalog().map((a) => [a.id, a]));

function enrichAch(game) {
  const earned = game.achievementsEarned || {};
  return Object.entries(earned).map(([dbId, ids]) => {
    const pl = game.players.find((p) => String(p.dbId) === String(dbId));
    return {
      dbId: Number(dbId),
      playerName: pl ? pl.name : '',
      items: (ids || []).map((id) => {
        const a = ACH.get(id);
        return { id, name: a ? a.name : id, nameEn: a ? a.nameEn : id, icon: a ? a.icon : '🎯', desc: a ? a.desc : '', descEn: a ? a.descEn : '' };
      }),
    };
  });
}

function view(game) {
  const v = engine.toClient(game);
  for (const p of v.players) if (Number.isInteger(p.dbId)) p.name = playerStore.displayName(p.dbId, p.name);
  if (game.status === 'finished') v.achievementsEarned = enrichAch(game);
  return v;
}

function load(req, res) {
  const game = partyStore.get(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Party-Spiel nicht gefunden.' });
    return null;
  }
  return game;
}

// Beim Beenden Achievements auswerten (einmalig).
function onFinish(game) {
  if (game.status === 'finished' && !game.achievementsEarned) {
    try {
      partyStore.save(game); // zuerst speichern, damit die Party-Zählung dieses Spiel einschließt
      game.achievementsEarned = achievementEval.evaluateGame(game) || {};
    } catch (e) {
      console.error('[party-ach]', e.message);
      game.achievementsEarned = {};
    }
  }
}

function persistEmit(game) {
  partyStore.save(game);
  gameEvents.publish(game.id, 'state', view(game));
}

// POST /api/party – neues Party-Spiel
router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    const rawPlayers = Array.isArray(body.players) ? body.players : [];
    const players = rawPlayers.map((p) => {
      const name = (p.name && String(p.name).trim()) || 'Spieler';
      if (p.type === 'bot') {
        const bot = playerStore.ensureBot(name, p.botLevel);
        return { name, type: 'bot', dbId: bot.id };
      }
      const dbId = Number.isInteger(p.id) && playerStore.get(p.id) ? p.id : null;
      return { name, type: 'human', dbId };
    });
    const game = engine.createGame({ partyMode: body.partyMode, players });
    partyStore.save(game);
    res.status(201).json(view(game));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/party – laufende Party-Spiele
router.get('/', (req, res) => {
  res.json(partyStore.list());
});

// GET /api/party/:id/stream – SSE
router.get('/:id/stream', (req, res) => {
  const game = partyStore.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Party-Spiel nicht gefunden.' });
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(`event: state\ndata: ${JSON.stringify(view(game))}\n\n`);
  const unsubscribe = gameEvents.subscribe(req.params.id, res);
  const hb = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      /* ignore */
    }
  }, 25000);
  req.on('close', () => {
    clearInterval(hb);
    unsubscribe();
    res.end();
  });
});

// GET /api/party/:id
router.get('/:id', (req, res) => {
  const game = load(req, res);
  if (!game) return;
  res.json(view(game));
});

// POST /api/party/:id/throw
router.post('/:id/throw', (req, res) => {
  const game = load(req, res);
  if (!game) return;
  try {
    engine.applyDart(game, { segment: Number(req.body?.segment), multiplier: Number(req.body?.multiplier) });
    onFinish(game);
    persistEmit(game);
    res.json(view(game));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/party/:id/undo
router.post('/:id/undo', (req, res) => {
  const game = load(req, res);
  if (!game) return;
  engine.undo(game);
  persistEmit(game);
  res.json(view(game));
});

// DELETE /api/party/:id
router.delete('/:id', (req, res) => {
  const ok = partyStore.remove(req.params.id);
  if (ok) gameEvents.publish(req.params.id, 'deleted', { id: req.params.id });
  res.status(ok ? 204 : 404).end();
});

module.exports = router;
