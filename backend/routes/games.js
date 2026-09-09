'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const engine = require('../utils/gameEngine');
const gameStore = require('../models/gameStore');
const statsStore = require('../models/statsStore');
const matchHistoryStore = require('../models/matchHistoryStore');
const achievementEval = require('../utils/achievementEval');
const playerStore = require('../models/playerStore');
const gameEvents = require('../utils/gameEvents');
const tview = require('../utils/tournamentView');
const { sanitizeGameConfig } = require('../utils/validators');

const router = express.Router();

const BOT_DELAY_MS = 900;
const driving = new Set();

function loadOr404(req, res) {
  const game = gameStore.get(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Spiel nicht gefunden.' });
    return null;
  }
  return game;
}

// Client-Ansicht: Anzeigenamen gespeicherter Spieler per ID frisch aus der DB
// auflösen, damit Umbenennungen überall sofort greifen.
function view(game) {
  const v = engine.toClient(game);
  for (const p of v.players) {
    if (Number.isInteger(p.dbId)) p.name = playerStore.displayName(p.dbId, p.name);
  }
  return v;
}

function persist(game) {
  if (game.status === 'finished' && !game.statsRecorded) {
    statsStore.recordGameResult(game);
    try {
      matchHistoryStore.recordMatch(game);
    } catch (e) {
      console.error('[history]', e.message);
    }
    try {
      // Neu erspielte Achievements dieses Spiels merken (je Spieler-dbId -> IDs),
      // damit sie im Endstand angezeigt werden können.
      game.achievementsEarned = achievementEval.evaluateGame(game) || {};
    } catch (e) {
      console.error('[achievements]', e.message);
    }
    game.statsRecorded = true;
  }
  gameStore.save(game);
}

function emit(game) {
  gameEvents.publish(game.id, 'state', view(game));
  if (game.tournamentId) tview.publishUpdate(game.tournamentId);
}

function driveBots(gameId) {
  if (driving.has(gameId)) return;
  const g0 = gameStore.get(gameId);
  if (!g0 || g0.status !== 'playing' || g0.awaitingBullOff) return;
  if (g0.players[g0.currentPlayerIndex].type !== 'bot') return;

  driving.add(gameId);
  const step = () => {
    const g = gameStore.get(gameId);
    if (
      !g ||
      g.status !== 'playing' ||
      g.awaitingBullOff ||
      g.players[g.currentPlayerIndex].type !== 'bot'
    ) {
      driving.delete(gameId);
      return;
    }
    engine.playBotTurn(g);
    persist(g);
    emit(g);
    if (
      g.status === 'playing' &&
      !g.awaitingBullOff &&
      g.players[g.currentPlayerIndex].type === 'bot'
    ) {
      setTimeout(step, BOT_DELAY_MS);
    } else {
      driving.delete(gameId);
    }
  };
  setTimeout(step, BOT_DELAY_MS);
}

// POST /api/games – neues Einzelspiel
router.post('/', (req, res) => {
  try {
    const config = sanitizeGameConfig(req.body || {});
    for (const p of config.players) {
      if (p.type === 'bot') {
        const bot = playerStore.ensureBot(p.name, p.botLevel);
        p.dbId = bot.id;
      } else if (Number.isInteger(p.id) && playerStore.get(p.id)) {
        p.dbId = p.id;
        playerStore.setCheckoutMode(p.id, p.checkoutMode);
        if (Number.isInteger(p.dartId)) playerStore.setDart(p.id, p.dartId);
      }
    }
    // Adaptiver Bot: Start-Niveau am historischen Ø der menschlichen Gegner ausrichten.
    if (config.players.some((p) => p.type === 'bot' && p.botLevel === 'adaptive')) {
      const humanAvgs = config.players
        .filter((p) => p.type !== 'bot' && Number.isInteger(p.dbId))
        .map((p) => {
          const st = statsStore.get(p.dbId);
          return st ? st.average : 0;
        });
      const base = humanAvgs.length ? Math.max(...humanAvgs) : 0;
      if (base > 0) {
        for (const p of config.players) {
          if (p.type === 'bot' && p.botLevel === 'adaptive') p.adaptiveBase = base;
        }
      }
    }
    // Eindeutige In-Game-ID; Stats-/Anzeige-ID bleibt in dbId erhalten.
    config.players = config.players.map((p) => ({ ...p, id: randomUUID() }));
    const game = engine.createGame(config);
    gameStore.save(game);
    res.status(201).json(view(game));
    driveBots(game.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/games
// Liefert die interne Spieleliste UND (für den Darterkenner) die Felder
// gameId/mode(string)/status(waiting|active)/players[{id,name,score}]/createdAt.
// Beendete Spiele erscheinen nicht (Darterkenner-Anforderung).
router.get('/', (req, res) => {
  const list = gameStore.list()
    .filter((g) => g.status !== 'finished')
    .map((g) => ({
      ...g,
      gameId: g.id,
      mode: g.mode != null ? String(g.mode) : null,
      status: g.status === 'playing' ? 'active' : 'waiting',
      players: Array.isArray(g.playerObjs) && g.playerObjs.length ? g.playerObjs : g.players,
      createdAt: g.createdAt,
    }));
  res.json(list);
});

// GET /api/games/:id/stream – SSE
router.get('/:id/stream', (req, res) => {
  const game = gameStore.get(req.params.id);
  if (!game) {
    res.status(404).json({ error: 'Spiel nicht gefunden.' });
    return;
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(`event: state\ndata: ${JSON.stringify(view(game))}\n\n`);

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

  driveBots(req.params.id);
});

// GET /api/games/:id
router.get('/:id', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  res.json(view(game));
});

// POST /api/games/:id/throw
router.post('/:id/throw', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  try {
    const { segment, multiplier } = req.body || {};
    engine.applyDart(game, { segment: Number(segment), multiplier: Number(multiplier) });
    persist(game);
    emit(game);
    res.json(view(game));
    driveBots(game.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/games/:id/turn – gebündelte Aufnahme (mehrere Einzel-Darts auf einmal).
// Wendet die Darts nacheinander an; bei Bust/Checkout/Zugwechsel wird gestoppt.
router.post('/:id/turn', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  try {
    const darts = Array.isArray(req.body?.darts) ? req.body.darts.slice(0, 3) : [];
    for (const d of darts) {
      if (game.status !== 'playing' || game.awaitingBullOff) break;
      const before = game.currentPlayerIndex;
      engine.applyDart(game, { segment: Number(d.segment), multiplier: Number(d.multiplier) });
      if (game.message === 'BUST' || game.message === 'CHECKOUT' || game.currentPlayerIndex !== before) break;
    }
    persist(game);
    emit(game);
    res.json(view(game));
    driveBots(game.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/games/:id/visit – ganze Aufnahme als Summe (Freitext-Modus)
router.post('/:id/visit', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  try {
    engine.applyVisitSum(
      game,
      Number(req.body?.sum),
      req.body?.checkoutDarts != null ? Number(req.body.checkoutDarts) : undefined
    );
    persist(game);
    emit(game);
    res.json(view(game));
    driveBots(game.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/games/:id/finish – Unbegrenzt-Spiel manuell beenden & werten
router.post('/:id/finish', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  try {
    engine.endUnlimited(game);
    persist(game);
    emit(game);
    res.json(view(game));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/games/:id/surrender – ein Spieler/Team gibt auf; Spiel wird gewertet beendet.
router.post('/:id/surrender', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  try {
    engine.surrender(game, req.body?.unitId);
    persist(game);
    emit(game);
    res.json(view(game));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/games/:id/bot-turn
router.post('/:id/bot-turn', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  engine.playBotTurn(game);
  persist(game);
  emit(game);
  res.json(view(game));
});

// POST /api/games/:id/bulloff
router.post('/:id/bulloff', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  try {
    engine.resolveBullOff(game, req.body?.winnerId);
    persist(game);
    emit(game);
    res.json(view(game));
    driveBots(game.id);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/games/:id/undo
router.post('/:id/undo', (req, res) => {
  const game = loadOr404(req, res);
  if (!game) return;
  engine.undo(game);
  gameStore.save(game);
  emit(game);
  res.json(view(game));
});

// DELETE /api/games/:id
router.delete('/:id', (req, res) => {
  const ok = gameStore.remove(req.params.id);
  if (ok) gameEvents.publish(req.params.id, 'deleted', { id: req.params.id });
  res.status(ok ? 204 : 404).end();
});

module.exports = router;
