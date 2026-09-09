'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const engine = require('../utils/gameEngine');
const gameStore = require('../models/gameStore');
const tournamentStore = require('../models/tournamentStore');
const playerStore = require('../models/playerStore');
const tlogic = require('../utils/tournamentLogic');
const bracket = require('../utils/tournamentBracket');
const tview = require('../utils/tournamentView');
const gameEvents = require('../utils/gameEvents');
const ratingStore = require('../models/ratingStore');
const { sanitizePlayer } = require('../utils/validators');

const router = express.Router();

const MODES = [501, 301, 101];

/** Ein Phasen-Format aus einem Teil-Objekt bauen (fällt auf Basis zurück). */
function phaseFormat(src, base) {
  const b = src || base || {};
  return engine.resolveFormat({
    satzLegMode: ['firstto', 'bestof'].includes(b.satzLegMode) ? b.satzLegMode : 'firstto',
    sets: b.sets,
    legs: b.legs,
  });
}

// POST /api/tournaments – neues Turnier
router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    // Teilnehmer-Einheiten: entweder Einzelspieler oder Teams (Doppel-Turnier).
    const isTeams = Array.isArray(body.teams) && body.teams.length >= 2;
    let players;
    if (isTeams) {
      players = body.teams
        .map((tm) => {
          const members = (Array.isArray(tm.members) ? tm.members : [])
            .map((mp) => ({ src: mp, sp: sanitizePlayer({ ...mp, type: 'human' }) }))
            .map(({ src, sp }) => {
              let dbId = Number.isInteger(src.id) && playerStore.get(src.id) ? src.id : null;
              if (!dbId && sp.name) dbId = playerStore.create({ name: sp.name, type: 'human' }).id;
              if (dbId && Number.isInteger(src.dartId)) playerStore.setDart(dbId, src.dartId);
              return { id: dbId, dbId, name: sp.name, dartId: Number.isInteger(src.dartId) ? src.dartId : null, checkoutMode: sp.checkoutMode };
            })
            .filter((m) => m.name && m.dbId != null);
          return {
            id: randomUUID(),
            type: 'team',
            name: (tm.name && String(tm.name).trim()) || members.map((m) => m.name).join(' & '),
            color: typeof tm.color === 'string' ? tm.color.slice(0, 20) : null,
            checkoutMode: ['single', 'master', 'individual', 'double'].includes(tm.checkoutMode) ? tm.checkoutMode : 'double',
            members,
          };
        })
        .filter((u) => u.members.length >= 1);
      if (players.length < 2) {
        return res.status(400).json({ error: 'Ein Doppel-Turnier benötigt mindestens 2 Teams.' });
      }
    } else {
      players = (Array.isArray(body.players) ? body.players : [])
        .map(sanitizePlayer)
        .map((p) => {
          let dbId = Number.isInteger(p.id) && playerStore.get(p.id) ? p.id : null;
          if (p.type === 'bot') dbId = playerStore.ensureBot(p.name, p.botLevel).id;
          // Pfeil-Auswahl wie der Checkout-Modus persistieren.
          if (dbId && p.type !== 'bot' && Number.isInteger(p.dartId)) playerStore.setDart(dbId, p.dartId);
          return { ...p, id: p.id || randomUUID(), dbId };
        });
      if (players.length < 2) {
        return res.status(400).json({ error: 'Ein Turnier benötigt mindestens 2 Spieler.' });
      }
      // Setzung nach Elo: stärkste Spieler zuerst, damit assignGroups/Bracket sie trennt.
      if (body.seedByElo) {
        const ratings = ratingStore.ratingMap();
        players.sort((a, b) => (ratings[b.dbId] ?? ratingStore.START_ELO) - (ratings[a.dbId] ?? ratingStore.START_ELO));
      }
    }

    const groupCount = Number(body.groupCount) === 2 && players.length >= 4 ? 2 : 1;
    const pf = body.phaseFormats || {};
    const groupFormat = phaseFormat(pf.group, body);
    const koEnabled = Boolean(body.koEnabled);
    const advance = [0, 2, 3].includes(Number(body.koAdvance)) ? Number(body.koAdvance) : 0;
    const thirdPlace = koEnabled && Boolean(body.thirdPlace);

    const groups = tlogic.assignGroups(players, groupCount);
    const t = {
      id: randomUUID(),
      name: (body.name && String(body.name).trim()) || 'Turnier',
      status: 'active',
      mode: MODES.includes(Number(body.mode)) ? Number(body.mode) : 501,
      checkIn: body.checkIn === 'double' ? 'double' : 'straight',
      inputMode: body.inputMode === 'sum' ? 'sum' : 'numpad',
      maxRounds:
        body.maxRounds == null ? 20 : Math.min(Math.max(parseInt(body.maxRounds, 10) || 0, 0), 99),
      bullOffRandomField: Boolean(body.bullOffRandomField),
      groupCount,
      ko: { enabled: koEnabled, advance },
      thirdPlace,
      formats: {
        group: groupFormat,
        ko: phaseFormat(pf.ko, body),
        final: phaseFormat(pf.final, pf.ko || body),
      },
      format: groupFormat, // Rückwärtskompatibilität (Untertitel etc.)
      players,
      groups,
      matches: tlogic.generateGroupMatches(groups),
      stage: 'group',
      bullOffs: {},
    };
    tournamentStore.save(t);
    res.status(201).json(tview.buildClient(t));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/tournaments
router.get('/', (req, res) => {
  res.json(tournamentStore.list());
});

// GET /api/tournaments/:id/stream – SSE
router.get('/:id/stream', (req, res) => {
  let t = tournamentStore.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'Turnier nicht gefunden.' });
    return;
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  t = tview.syncResults(t);
  res.write(`event: state\ndata: ${JSON.stringify(tview.buildClient(t))}\n\n`);

  const unsubscribe = gameEvents.subscribe(req.params.id, res);
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      /* ignore */
    }
  }, 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

// GET /api/tournaments/:id
router.get('/:id', (req, res) => {
  let t = tournamentStore.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
  t = tview.syncResults(t);
  res.json(tview.buildClient(t));
});

// POST /api/tournaments/:id/matches/:matchId/start – erzeugt das Spiel für ein Match
router.post('/:id/matches/:matchId/start', (req, res) => {
  const t = tournamentStore.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
  const match = t.matches.find((m) => m.id === req.params.matchId);
  if (!match) return res.status(404).json({ error: 'Match nicht gefunden.' });
  if (match.bulloff) return res.status(400).json({ error: 'Dieses Match wird per Bull-off entschieden.' });
  if (!match.p1 || !match.p2) return res.status(400).json({ error: 'Gegner steht noch nicht fest.' });

  if (match.gameId) {
    const existing = gameStore.get(match.gameId);
    if (existing && existing.status === 'playing') {
      return res.json({ gameId: match.gameId, game: engine.toClient(existing) });
    }
  }

  const p1 = t.players.find((p) => p.id === match.p1);
  const p2 = t.players.find((p) => p.id === match.p2);
  const fmt = (t.formats && t.formats[bracket.phaseKey(t, match)]) || t.format;
  // Team-Match: Teams als Scoring-Einheiten (id = Turnier-Einheit, damit Sync greift).
  const teamCfg = (u) => ({
    id: u.id,
    name: u.name,
    color: u.color || null,
    checkoutMode: u.checkoutMode || 'double',
    members: (u.members || []).map((m) => ({ id: m.dbId ?? m.id, dbId: m.dbId ?? null, name: m.name, dartId: m.dartId, checkoutMode: m.checkoutMode })),
  });
  const unitCfg =
    p1.type === 'team' || p2.type === 'team' ? { teams: [teamCfg(p1), teamCfg(p2)] } : { players: [p1, p2] };
  const game = engine.createGame({
    mode: t.mode,
    checkIn: t.checkIn,
    inputMode: t.inputMode || 'numpad',
    satzLegMode: fmt.satzLegMode,
    sets: fmt.sets,
    legs: fmt.legs,
    maxRounds: t.maxRounds || 0,
    bullOffRandomField: Boolean(t.bullOffRandomField),
    ...unitCfg,
    randomOrder: true,
    tournamentId: t.id,
    meta: { tournamentName: t.name, matchId: match.id },
  });
  gameStore.save(game);
  match.gameId = game.id;
  match.status = 'playing';
  tournamentStore.save(t);
  res.status(201).json({ gameId: game.id, game: engine.toClient(game) });
  tview.publishUpdate(t.id);
});

// POST /api/tournaments/:id/start-ko – KO-Phase starten (Bracket aufbauen)
router.post('/:id/start-ko', (req, res) => {
  const t = tournamentStore.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
  if (!t.ko || !t.ko.enabled) return res.status(400).json({ error: 'Für dieses Turnier ist keine KO-Phase vorgesehen.' });
  if (t.stage === 'ko') return res.json(tview.buildClient(t));
  if (!tlogic.allGroupMatchesDone(t)) return res.status(400).json({ error: 'Es sind noch nicht alle Gruppenspiele gespielt.' });
  const pending = tlogic.pendingGroupTieBreaks(t);
  if (pending.length) return res.status(400).json({ error: 'Offene Bull-off-Entscheidung(en) in der Gruppenphase.' });

  bracket.buildBracket(t);
  tournamentStore.save(t);
  res.json(tview.buildClient(t));
  tview.publishUpdate(t.id);
});

// POST /api/tournaments/:id/bulloff – Bull-off entscheiden
//   Platz-3 / KO-Match:   { matchId, winnerId }
//   Gruppen-Gleichstand:  { aId, bId, winnerId }
router.post('/:id/bulloff', (req, res) => {
  const t = tournamentStore.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Turnier nicht gefunden.' });
  const { matchId, aId, bId, winnerId } = req.body || {};
  try {
    if (matchId) {
      const m = t.matches.find((x) => x.id === matchId);
      if (!m || !m.bulloff) return res.status(400).json({ error: 'Kein Bull-off-Match.' });
      if (![m.p1, m.p2].includes(winnerId)) return res.status(400).json({ error: 'Ungültiger Sieger.' });
      m.winnerId = winnerId;
      m.status = 'done';
      bracket.advanceKo(t);
    } else if (aId && bId && winnerId) {
      if (![aId, bId].includes(winnerId)) return res.status(400).json({ error: 'Ungültiger Sieger.' });
      t.bullOffs = t.bullOffs || {};
      t.bullOffs[[aId, bId].sort().join('|')] = winnerId;
    } else {
      return res.status(400).json({ error: 'Ungültige Bull-off-Anfrage.' });
    }
    tournamentStore.save(t);
    res.json(tview.buildClient(t));
    tview.publishUpdate(t.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/tournaments/:id
router.delete('/:id', (req, res) => {
  const ok = tournamentStore.remove(req.params.id);
  if (ok) gameEvents.publish(req.params.id, 'deleted', { id: req.params.id });
  res.status(ok ? 204 : 404).end();
});

module.exports = router;
