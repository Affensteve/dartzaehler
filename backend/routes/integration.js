'use strict';

/**
 * Darterkenner-Integration (HTTP-Client auf Port 3001).
 *
 * Der Darterkenner sendet KEINE Einzelwürfe – er überträgt alle drei Würfe einer
 * Runde gebündelt via POST /api/round-complete. Zusätzlich liefert er Ausbullen
 * (POST /api/bulls-out), lädt den Spielkontext (GET /api/game-context) und
 * optional Korrektur-/Kalibrierungs-/ML-Endpunkte.
 *
 * Alle score-verändernden Aktionen laufen über die bestehende X01-Engine, damit
 * Statistik, Achievements, SSE-Live-Anzeige und Turnier-Sync identisch greifen.
 * Party-Spiele werden hier bewusst NICHT bedient (nur X01).
 */

const express = require('express');
const engine = require('../utils/gameEngine');
const rules = require('../utils/dartRules');
const { parseThrow } = require('../utils/darterkennerParse');
const gameStore = require('../models/gameStore');
const statsStore = require('../models/statsStore');
const matchHistoryStore = require('../models/matchHistoryStore');
const achievementEval = require('../utils/achievementEval');
const playerStore = require('../models/playerStore');
const gameEvents = require('../utils/gameEvents');
const tview = require('../utils/tournamentView');

const router = express.Router();

const BOT_DELAY_MS = 900;
const driving = new Set();

// --- gemeinsame Helfer (analog routes/games.js) ---
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

// Findet die Scoring-Einheit (X01: Spieler oder Team) per Darterkenner-playerId.
// Primär die In-Game-UUID (p.id); Fallback numerische dbId als String.
function findUnit(game, playerId) {
  const pid = String(playerId);
  return (
    game.players.find((p) => String(p.id) === pid) ||
    game.players.find((p) => p.dbId != null && String(p.dbId) === pid) ||
    null
  );
}

// Nur X01-Spiele laden (Party liegt in separater Tabelle und wird hier nicht bedient).
function loadX01(id) {
  return gameStore.get(id);
}

// Baut die Game-Context-/Games-Repräsentation eines Spiels (Darterkenner-Schema).
function contextView(game) {
  const v = view(game);
  const players = v.players.map((p, idx) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    checkoutMode: p.checkoutMode || 'double',
    isActive: !!p.isActive,
    order: idx,
  }));
  const active = v.players[game.currentPlayerIndex];
  const current = game.players[game.currentPlayerIndex];
  return {
    gameId: game.id,
    mode: String(game.mode),
    status: game.status === 'finished' ? 'finished' : game.status === 'playing' ? 'active' : 'waiting',
    players,
    activePlayerId: active ? active.id : null,
    throwsThisRound: current ? current.currentTurn.length : 0,
    roundNumber: game.roundNumber || 1,
  };
}

// --------------------------------------------------------------------------
// 2.3 Vollständigen Game Context laden
// --------------------------------------------------------------------------
router.get('/game-context', (req, res) => {
  const gameId = req.query.gameId;
  if (!gameId) return res.status(400).json({ success: false, error: 'gameId fehlt.' });
  const game = loadX01(gameId);
  if (!game) return res.status(404).json({ success: false, error: 'Spiel nicht gefunden.' });
  res.json(contextView(game));
});

// --------------------------------------------------------------------------
// 2.4 Runde abschließen – HAUPT-SCORING-ENDPOINT
// --------------------------------------------------------------------------
router.post('/round-complete', (req, res) => {
  const body = req.body || {};
  const { gameId, playerId } = body;
  const throwsIn = Array.isArray(body.throws) ? body.throws.slice(0, 3) : [];

  if (!gameId) return res.status(400).json({ success: false, error: 'gameId fehlt.' });
  const game = loadX01(gameId);
  if (!game) return res.status(404).json({ success: false, error: 'Spiel nicht gefunden.' });
  if (game.status !== 'playing') {
    return res.status(400).json({ success: false, error: 'Spiel ist nicht aktiv.' });
  }
  if (game.awaitingBullOff) {
    return res.status(400).json({ success: false, error: 'Ausbullen ausstehend.' });
  }

  // Sicherstellen, dass der übermittelte Spieler auch am Zug ist.
  const unit = findUnit(game, playerId);
  const activeUnit = game.players[game.currentPlayerIndex];
  if (unit && unit !== activeUnit) {
    return res.status(400).json({
      success: false,
      error: 'Übermittelter Spieler ist nicht am Zug.',
    });
  }

  try {
    for (const th of throwsIn) {
      if (game.status !== 'playing' || game.awaitingBullOff) break;
      const before = game.currentPlayerIndex;
      const dart = parseThrow(th) || { segment: 0, multiplier: 1 }; // Miss = 0 Punkte
      engine.applyDart(game, dart);
      if (
        game.message === 'BUST' ||
        game.message === 'CHECKOUT' ||
        game.currentPlayerIndex !== before
      ) {
        break;
      }
    }
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  const wasBust = game.message === 'BUST';
  persist(game);
  emit(game);
  driveBots(game.id);

  if (wasBust) {
    return res.status(400).json({ success: false, error: 'Bust!', details: { bust: true } });
  }

  // Erfolgs-Antwort zusammenstellen.
  const next = game.players[game.currentPlayerIndex];
  const nextId = next ? next.id : null;
  const nextName = next ? (Number.isInteger(next.dbId) ? playerStore.displayName(next.dbId, next.name) : next.name) : null;

  // Checkout-Vorschlag für den nächsten Spieler (nur bei laufendem Spiel).
  let remainingCheckout = null;
  if (game.status === 'playing' && next) {
    const route = rules.findCheckout(next.score, next.checkoutMode || 'double', 3);
    if (route && route.length) remainingCheckout = route[route.length - 1];
  }

  return res.json({
    success: true,
    gameState: {
      nextPlayerId: nextId,
      remainingCheckout,
      currentScore: next ? next.score : null,
      status: game.status,
      winnerId: game.winnerId || null,
    },
    nextPlayerInfo: next ? { id: nextId, name: nextName } : null,
  });
});

// --------------------------------------------------------------------------
// 2.5 Ausbullen (Bulls-Out)
// --------------------------------------------------------------------------
router.post('/bulls-out', (req, res) => {
  const body = req.body || {};
  const { gameId, player1, player2 } = body;
  if (!gameId) return res.status(400).json({ success: false, error: 'gameId fehlt.' });
  const game = loadX01(gameId);
  if (!game) return res.status(404).json({ success: false, error: 'Spiel nicht gefunden.' });

  // Gewinner lokal aus bullDistance bestimmen (niedrigster Wert gewinnt);
  // ansonsten den vom Darterkenner gelieferten winner übernehmen.
  let winnerId = body.winner || null;
  if (player1 && player2 && Number.isFinite(player1.bullDistance) && Number.isFinite(player2.bullDistance)) {
    winnerId = player1.bullDistance <= player2.bullDistance ? player1.id : player2.id;
  }

  // Reihenfolge festlegen: Gewinner beginnt. Nur wenn das Spiel noch am Start
  // steht (Runde 1, keine Würfe) – sonst nur bestätigen.
  const unit = winnerId ? findUnit(game, winnerId) : null;
  const untouched =
    (game.roundNumber || 1) === 1 &&
    game.players.every((p) => (p.currentTurn || []).length === 0 && p.score === game.startScore);
  if (unit && untouched && game.status === 'playing') {
    const idx = game.players.indexOf(unit);
    if (idx > 0) {
      game.legStarterIndex = idx;
      game.currentPlayerIndex = idx;
      try {
        persist(game);
        emit(game);
      } catch (e) {
        /* Persistenzfehler nicht fatal – Client hat Offline-Queue */
      }
    }
  }

  return res.json({ success: true, winner: winnerId || null });
});

// --------------------------------------------------------------------------
// 2.6 Wurf korrigieren (optional, reines Logging – keine Score-Wirkung)
// --------------------------------------------------------------------------
router.put('/detected-throws/:throwId', (req, res) => {
  // Die finale korrigierte Runde kommt ohnehin via /round-complete.
  // Hier nur bestätigen (Fehler werden clientseitig ignoriert).
  res.json({ success: true, throwId: req.params.throwId });
});

// --------------------------------------------------------------------------
// 2.7 Board-Kalibrierung sichern (optional, non-critical Backup)
// --------------------------------------------------------------------------
router.put('/board-calibration', (req, res) => {
  res.json({ success: true });
});

// --------------------------------------------------------------------------
// 2.8 ML-Modell-Update prüfen (Phase 3, optional) – aktuell kein Modell.
// --------------------------------------------------------------------------
router.get('/ml-models/latest', (req, res) => {
  res.json({ version: 0, modelUrl: null, accuracy: 0 });
});

module.exports = router;
module.exports.parseThrow = parseThrow; // Re-Export für Tests
