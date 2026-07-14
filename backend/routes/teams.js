'use strict';

const express = require('express');
const store = require('../models/savedTeamStore');

const router = express.Router();

// GET /api/teams – gespeicherte feste Doppel
router.get('/', (req, res) => {
  res.json(store.list());
});

// POST /api/teams – festes Doppel speichern { name, color, members:[{id,name}] }
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.members) || b.members.length < 1) {
    return res.status(400).json({ error: 'Team braucht mindestens einen Spieler.' });
  }
  res.status(201).json(store.create(b));
});

// DELETE /api/teams/:id
router.delete('/:id', (req, res) => {
  res.json({ ok: store.remove(req.params.id) });
});

module.exports = router;
