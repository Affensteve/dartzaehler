'use strict';

const express = require('express');
const leagueStore = require('../models/leagueStore');
const playerStore = require('../models/playerStore');

const router = express.Router();

// GET /api/leagues – alle Ligen (Kopf-Daten + Mitgliederzahl).
router.get('/', (req, res) => {
  res.json(leagueStore.list());
});

// POST /api/leagues – neue Liga anlegen.
router.post('/', (req, res) => {
  const b = req.body || {};
  const memberIds = Array.isArray(b.memberIds) ? b.memberIds.map(Number).filter(Number.isInteger) : [];
  const config = {};
  if (Number.isFinite(Number(b.winPoints))) config.winPoints = Math.max(1, Math.min(10, Number(b.winPoints)));
  if ([501, 301, 101].includes(Number(b.mode))) config.mode = Number(b.mode);
  const league = leagueStore.create({ name: b.name, memberIds, config });
  res.status(201).json(league);
});

// GET /api/leagues/:id – Liga inkl. berechneter Tabelle.
router.get('/:id', (req, res) => {
  const l = leagueStore.get(req.params.id);
  if (!l) return res.status(404).json({ error: 'Liga nicht gefunden.' });
  res.json(l);
});

// POST /api/leagues/:id/members – Mitglied hinzufügen.
router.post('/:id/members', (req, res) => {
  const pid = Number(req.body && req.body.playerId);
  if (!Number.isInteger(pid) || !playerStore.get(pid)) {
    return res.status(400).json({ error: 'Ungültiger Spieler.' });
  }
  const l = leagueStore.addMember(req.params.id, pid);
  if (!l) return res.status(404).json({ error: 'Liga nicht gefunden.' });
  res.json(l);
});

// DELETE /api/leagues/:id/members/:playerId – Mitglied entfernen.
router.delete('/:id/members/:playerId', (req, res) => {
  const l = leagueStore.removeMember(req.params.id, Number(req.params.playerId));
  if (!l) return res.status(404).json({ error: 'Liga nicht gefunden.' });
  res.json(l);
});

// PUT /api/leagues/:id/status – Saison abschließen/aktivieren.
router.put('/:id/status', (req, res) => {
  const l = leagueStore.setStatus(req.params.id, req.body && req.body.status);
  if (!l) return res.status(400).json({ error: 'Ungültiger Status oder Liga.' });
  res.json(l);
});

// DELETE /api/leagues/:id – Liga löschen.
router.delete('/:id', (req, res) => {
  const ok = leagueStore.remove(req.params.id);
  res.status(ok ? 204 : 404).end();
});

module.exports = router;
