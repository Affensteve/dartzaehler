'use strict';

const express = require('express');
const matchHistoryStore = require('../models/matchHistoryStore');

const router = express.Router();

const RANGES = ['today', '7d', '30d', 'all'];
const parseRange = (q) => (RANGES.includes(q) ? q : 'all');

// GET /api/matches?range=&area=game|training|all&player=<dbId> – Liste abgeschlossener Spiele
router.get('/', (req, res) => {
  const area = req.query.area;
  const training = area === 'training' ? true : area === 'game' ? false : null;
  const player = req.query.player != null && req.query.player !== '' ? Number(req.query.player) : null;
  res.json(
    matchHistoryStore.list({
      range: parseRange(req.query.range),
      training,
      playerId: Number.isInteger(player) ? player : null,
    })
  );
});

// GET /api/matches/h2h?a=&b= – direkter Vergleich zweier Spieler
router.get('/h2h', (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (!a || !b || a === b) return res.status(400).json({ error: 'Zwei verschiedene Spieler nötig.' });
  res.json(matchHistoryStore.headToHead(a, b));
});

// GET /api/matches/:id – ein Spiel mit vollem Aufnahme-Verlauf
router.get('/:id', (req, res) => {
  const match = matchHistoryStore.get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Spiel nicht gefunden.' });
  res.json(match);
});

// DELETE /api/matches/:id – Historie-Eintrag löschen
router.delete('/:id', (req, res) => {
  const ok = matchHistoryStore.remove(req.params.id);
  res.status(ok ? 204 : 404).end();
});

module.exports = router;
