'use strict';

const express = require('express');
const dartStore = require('../models/dartStore');

const router = express.Router();

// GET /api/darts – alle Pfeile
router.get('/', (req, res) => {
  res.json(dartStore.list());
});

// POST /api/darts – neuen Pfeil anlegen
router.post('/', (req, res) => {
  const { name, weightGrams, owner } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name erforderlich.' });
  res.status(201).json(dartStore.create({ name, weightGrams, owner }));
});

// PUT /api/darts/:id – Pfeil bearbeiten
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!dartStore.get(id)) return res.status(404).json({ error: 'Pfeil nicht gefunden.' });
  const { name, weightGrams, owner } = req.body || {};
  if (name != null && !String(name).trim()) return res.status(400).json({ error: 'Name erforderlich.' });
  res.json(dartStore.update(id, { name, weightGrams, owner }));
});

// DELETE /api/darts/:id – Pfeil löschen
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!dartStore.get(id)) return res.status(404).json({ error: 'Pfeil nicht gefunden.' });
  try {
    dartStore.remove(id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
