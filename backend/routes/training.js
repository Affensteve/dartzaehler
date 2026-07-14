'use strict';

const express = require('express');
const trainingStore = require('../models/trainingStore');
const statsStore = require('../models/statsStore');
const playerStore = require('../models/playerStore');
const achievementEval = require('../utils/achievementEval');
const customDrillStore = require('../models/customDrillStore');

const router = express.Router();

// POST /api/training/records – Trainingsergebnis (Highscore) speichern
router.post('/records', (req, res) => {
  const { playerId, mode, score, detail } = req.body || {};
  const id = Number(playerId);
  if (!id || !playerStore.get(id)) return res.status(400).json({ error: 'Unbekannter Spieler.' });
  try {
    trainingStore.record({ playerId: id, mode, score: Number(score), detail });
    try { achievementEval.evaluate(id, {}); } catch (e) { /* ignore */ }
    res.status(201).json(trainingStore.playerBests(id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/training/records/:playerId – Bestwerte je Modus
router.get('/records/:playerId', (req, res) => {
  res.json(trainingStore.playerBests(req.params.playerId));
});

// GET /api/training/stats/:playerId?range= – aggregierte Trainings-Statistik je Modus
router.get('/stats/:playerId', (req, res) => {
  const ranges = ['today', '7d', '30d', 'all'];
  const range = ranges.includes(req.query.range) ? req.query.range : 'all';
  res.json(trainingStore.playerStats(req.params.playerId, range));
});

// POST /api/training/scoring – Scoring-Training (Count-up) in die Trainings-Statistik
router.post('/scoring', (req, res) => {
  const { playerId } = req.body || {};
  const id = Number(playerId);
  if (!id || !playerStore.get(id)) return res.status(400).json({ error: 'Unbekannter Spieler.' });
  statsStore.recordTrainingScoring({ ...req.body, playerId: id });
  try { achievementEval.evaluate(id, {}); } catch (e) { /* ignore */ }
  res.status(201).json({ ok: true });
});

// --- Trainings-Builder: eigene Übungen (Custom Drills) ---
// GET /api/training/drills?player=ID
router.get('/drills', (req, res) => {
  const id = Number(req.query.player);
  if (!id || !playerStore.get(id)) return res.status(400).json({ error: 'Unbekannter Spieler.' });
  res.json(customDrillStore.list(id));
});
// POST /api/training/drills  { playerId, name, field, ring, rounds, goal, weekday }
router.post('/drills', (req, res) => {
  const id = Number(req.body?.playerId);
  if (!id || !playerStore.get(id)) return res.status(400).json({ error: 'Unbekannter Spieler.' });
  res.status(201).json(customDrillStore.create(id, req.body || {}));
});
// PUT /api/training/drills/:id
router.put('/drills/:id', (req, res) => {
  const d = customDrillStore.update(req.params.id, req.body || {});
  if (!d) return res.status(404).json({ error: 'Übung nicht gefunden.' });
  res.json(d);
});
// DELETE /api/training/drills/:id
router.delete('/drills/:id', (req, res) => {
  res.json({ ok: customDrillStore.remove(req.params.id) });
});

module.exports = router;
