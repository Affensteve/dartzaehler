'use strict';

const express = require('express');
const { catalog } = require('../utils/achievements');
const store = require('../models/achievementStore');

const router = express.Router();

// GET /api/achievements – Katalog + welche Spieler jedes Achievement erreicht haben
router.get('/', (req, res) => {
  res.json({ catalog: catalog(), earners: store.earners() });
});

module.exports = router;
