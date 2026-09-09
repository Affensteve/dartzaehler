'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

// --- Minimaler .env-Loader (ohne zusätzliche Dependency) ---
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = (m[2] || '').trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(cors());
// gzip für JSON/HTML/JS – SSE (text/event-stream) NICHT komprimieren,
// sonst puffert die Middleware die Live-Events und der Stream stockt.
app.use(
  compression({
    filter: (req, res) => {
      if (res.getHeader('Content-Type') === 'text/event-stream') return false;
      if (req.headers.accept && req.headers.accept.includes('text/event-stream')) return false;
      return compression.filter(req, res);
    },
  })
);
app.use(express.json({ limit: '4mb' })); // größer wegen Foto-Uploads (Profil, verkleinert)

// --- API-Routen ---
app.use('/api/players', require('./routes/players'));
app.use('/api/darts', require('./routes/darts'));
app.use('/api/training', require('./routes/training'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/games', require('./routes/games'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/export', require('./routes/export'));
app.use('/api/achievements', require('./routes/achievements'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/leagues', require('./routes/leagues'));
app.use('/api/party', require('./routes/party'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', ok: true, version: '1.0.0', timestamp: new Date().toISOString() })
);

// --- Darterkenner-Integration (HTTP-Client, Port 3001) ---
// Endpunkte: /api/game-context, /api/round-complete, /api/bulls-out,
// /api/detected-throws/:id, /api/board-calibration, /api/ml-models/latest.
// (GET /api/games ist um die Darterkenner-Felder erweitert – s. routes/games.js.)
app.use('/api', require('./routes/integration'));

// --- Statisches Frontend (Vite-Build) ---
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA-Fallback: alle Nicht-API-Routen -> index.html
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res
      .status(200)
      .send(
        '<h1>DartZähler Backend läuft</h1><p>Das Frontend wurde noch nicht gebaut. ' +
          'Bitte <code>npm run build</code> im Projektstamm ausführen.</p>'
      );
  });
}

// --- Fehler-Handler ---
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

app.listen(PORT, HOST, () => {
  console.log(`[dartzaehler] Server läuft auf http://${HOST}:${PORT}`);
});

module.exports = app;
