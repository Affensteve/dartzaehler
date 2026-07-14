'use strict';

const express = require('express');
const statsStore = require('../models/statsStore');
const matchHistoryStore = require('../models/matchHistoryStore');

const router = express.Router();

const RANGES = ['today', '7d', '30d', 'all'];
const parseRange = (q) => (RANGES.includes(q) ? q : 'all');
const isTraining = (q) => q === 'training';

// CSV-Feld escapen (Trennzeichen ";", deutsches Excel-freundlich).
function cell(v) {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header, rows) {
  const lines = [header.map(cell).join(';')];
  for (const r of rows) lines.push(r.map(cell).join(';'));
  return '﻿' + lines.join('\r\n'); // BOM für UTF-8 in Excel
}
function send(res, name, csv) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${name}"`);
  res.send(csv);
}

// GET /api/export/stats.csv?range=&area= – aggregierte Spielerstatistik als CSV
router.get('/stats.csv', (req, res) => {
  const range = parseRange(req.query.range);
  const rows = statsStore.list(range, { training: isTraining(req.query.area) });
  const header = [
    'Spieler', 'Typ', 'Spiele', 'Siege', 'Siege %', 'Legs', 'Legs gewonnen', 'Legs %',
    'Average', 'Erste-9 Ø', 'Pfeile Ø', 'Double %', 'Triple %', 'Doppelquote %',
    'Max Aufnahme', '60+', '100+', '140+', '180', 'Max Checkout', 'Min Darts', 'Checkout %',
  ];
  const data = rows.map((r) => [
    r.name, r.type, r.games, r.wins, r.winPct, r.legs, r.legsWon, r.legsWinPct,
    r.average, r.first9Avg, r.dartsAvg, r.doublePct, r.triplePct, r.doubleRatePct,
    r.maxTurn, r.s60, r.s100, r.s140, r.s180, r.maxCheckout, r.minDarts || '', r.checkoutPct,
  ]);
  send(res, `dartzaehler-statistik-${range}.csv`, toCsv(header, data));
});

// GET /api/export/matches.csv?range=&area=&player= – Match-Historie als CSV
router.get('/matches.csv', (req, res) => {
  const range = parseRange(req.query.range);
  const area = req.query.area;
  const training = area === 'training' ? true : area === 'game' ? false : null;
  const player = req.query.player != null && req.query.player !== '' ? Number(req.query.player) : null;
  const matches = matchHistoryStore.list({ range, training, playerId: Number.isInteger(player) ? player : null });
  const header = ['Datum', 'Modus', 'Format', 'Eingabe', 'Bereich', 'Sieger', 'Ergebnis (Spieler: Legs, Ø)'];
  const data = matches.map((m) => [
    m.finishedAt,
    m.mode,
    m.formatLabel || '',
    m.inputMode,
    m.isTraining ? 'Training' : 'Spiel/Turnier',
    m.winnerName || '',
    m.players.map((p) => `${p.name}: ${p.legsWon} Legs, Ø ${p.average}`).join(' | '),
  ]);
  send(res, `dartzaehler-historie-${range}.csv`, toCsv(header, data));
});

module.exports = router;
