'use strict';

const express = require('express');
const ratingStore = require('../models/ratingStore');

const router = express.Router();

// GET /api/ratings?range=all&bots=1 – Elo-Rangliste (absteigend).
router.get('/', (req, res) => {
  const range = ['today', '7d', '30d', 'all'].includes(req.query.range) ? req.query.range : 'all';
  const includeBots = req.query.bots !== '0';
  res.json({ range, players: ratingStore.leaderboard({ range, includeBots }) });
});

// GET /api/ratings/:id – Rating eines einzelnen Spielers.
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige Spieler-ID.' });
  res.json(ratingStore.forPlayer(id));
});

module.exports = router;
