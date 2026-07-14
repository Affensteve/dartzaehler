'use strict';

const express = require('express');
const settingsStore = require('../models/settingsStore');

const router = express.Router();

// GET /api/settings – alle Einstellungen als Objekt { key: value }
router.get('/', (req, res) => {
  res.json(settingsStore.all());
});

// PUT /api/settings – eine Einstellung setzen { key, value }
router.put('/', (req, res) => {
  const { key, value } = req.body || {};
  if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key erforderlich.' });
  settingsStore.set(key, value);
  res.json(settingsStore.all());
});

module.exports = router;
