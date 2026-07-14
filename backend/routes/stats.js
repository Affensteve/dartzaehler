'use strict';

const express = require('express');
const statsStore = require('../models/statsStore');

const router = express.Router();

const RANGES = ['today', '7d', '30d', 'all'];
const parseRange = (q) => (RANGES.includes(q) ? q : 'all');
const isTraining = (q) => q === 'training';

// GET /api/stats?range=&area=game|training – aggregierte Statistik im Zeitfenster/Bereich
router.get('/', (req, res) => {
  res.json(statsStore.list(parseRange(req.query.range), { training: isTraining(req.query.area) }));
});

// GET /api/stats/:playerId/darts?area= – vom Spieler benutzte Pfeile (für den Filter)
router.get('/:playerId/darts', (req, res) => {
  res.json(statsStore.playerDarts(req.params.playerId, { training: isTraining(req.query.area) }));
});

// GET /api/stats/:playerId/sectors?area=&range= – Sektor-Trefferzahlen je Pfeil (gestapelte Balken)
router.get('/:playerId/sectors', (req, res) => {
  res.json(
    statsStore.playerSectorsByDart(req.params.playerId, {
      training: isTraining(req.query.area),
      range: parseRange(req.query.range),
    })
  );
});

// GET /api/stats/:playerId/timeline?range=&area=&dart= – Fortschritt je Kalenderwoche
router.get('/:playerId/timeline', (req, res) => {
  const dartId = req.query.dart != null && req.query.dart !== '' ? Number(req.query.dart) : null;
  res.json(
    statsStore.timeline(req.params.playerId, {
      training: isTraining(req.query.area),
      range: parseRange(req.query.range),
      dartId: Number.isInteger(dartId) ? dartId : null,
    })
  );
});

// GET /api/stats/:playerId?range=&area=&dart= – Statistik eines Spielers (optional je Pfeil)
router.get('/:playerId', (req, res) => {
  const dartId = req.query.dart != null && req.query.dart !== '' ? Number(req.query.dart) : null;
  const row = statsStore.get(req.params.playerId, parseRange(req.query.range), {
    training: isTraining(req.query.area),
    dartId: Number.isInteger(dartId) ? dartId : null,
  });
  if (!row) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
  res.json(row);
});

module.exports = router;
