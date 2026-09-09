'use strict';

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const { parseThrow } = require('../utils/darterkennerParse');

// --- reine parseThrow-Tests (kein Server/DB nötig) ---
test('parseThrow: Segmente/Multiplikatoren', () => {
  assert.deepStrictEqual(parseThrow({ segment: '20', multiplier: 'triple' }), { segment: 20, multiplier: 3 });
  assert.deepStrictEqual(parseThrow({ segment: '10', multiplier: 'double' }), { segment: 10, multiplier: 2 });
  assert.deepStrictEqual(parseThrow({ segment: '5', multiplier: 'single' }), { segment: 5, multiplier: 1 });
  assert.deepStrictEqual(parseThrow({ segment: '7' }), { segment: 7, multiplier: 1 }); // multiplier fehlt -> single
});

test('parseThrow: Bull / Bullseye', () => {
  assert.deepStrictEqual(parseThrow({ segment: 'BULL', multiplier: 'bullseye' }), { segment: 25, multiplier: 2 });
  assert.deepStrictEqual(parseThrow({ segment: 'BULL', multiplier: 'double' }), { segment: 25, multiplier: 2 });
  assert.deepStrictEqual(parseThrow({ segment: 'BULL', multiplier: 'single' }), { segment: 25, multiplier: 1 });
});

test('parseThrow: Miss-Varianten -> null (0 Punkte)', () => {
  assert.strictEqual(parseThrow({ segment: 'MISS', multiplier: null }), null);
  assert.strictEqual(parseThrow({ segment: 'M20', multiplier: null }), null);
  assert.strictEqual(parseThrow({ segment: 'M1' }), null);
  assert.strictEqual(parseThrow({ segment: '0' }), null);
  assert.strictEqual(parseThrow({ segment: '21' }), null);
  assert.strictEqual(parseThrow(null), null);
});

// --------------------------------------------------------------------------
// HTTP-Integrationstests gegen die echte App.
// Benötigt better-sqlite3 (natives Modul). Falls es in der aktuellen Node-
// Umgebung nicht lädt (z. B. für andere Node-Version kompiliert), werden diese
// Tests übersprungen statt fehlzuschlagen – die reinen Tests oben laufen immer.
// --------------------------------------------------------------------------
let app = null;
let dbErr = null;
const tmpDb = path.join(os.tmpdir(), `dz-int-${process.pid}-${Date.now()}.db`);
try {
  process.env.DB_PATH = tmpDb;
  process.env.PORT = '0';
  app = require('../server');
} catch (e) {
  dbErr = e;
}
const skipHttp = { skip: dbErr ? `DB nicht ladbar: ${dbErr.message.split('\n')[0]}` : false };

function listen() {
  return new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function req(srv, method, urlPath, body) {
  const { port } = srv.address();
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const r = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try { json = buf ? JSON.parse(buf) : null; } catch (e) { /* ignore */ }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

test('HTTP: health -> status ok + timestamp', skipHttp, async () => {
  const srv = await listen();
  try {
    const res = await req(srv, 'GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(typeof res.body.timestamp === 'string');
  } finally {
    srv.close();
  }
});

test('HTTP: games -> context -> round-complete (Score)', skipHttp, async () => {
  const srv = await listen();
  try {
    const create = await req(srv, 'POST', '/api/games', {
      mode: 501,
      players: [
        { name: 'Steffen', type: 'human', checkoutMode: 'double' },
        { name: 'Marcel', type: 'human', checkoutMode: 'double' },
      ],
    });
    assert.strictEqual(create.status, 201);
    const gameId = create.body.id;
    const p1 = create.body.players[0].id;
    const p2 = create.body.players[1].id;

    const games = await req(srv, 'GET', '/api/games');
    assert.strictEqual(games.status, 200);
    const entry = games.body.find((g) => g.gameId === gameId);
    assert.ok(entry, 'Spiel in Liste');
    assert.strictEqual(entry.status, 'active');
    assert.strictEqual(entry.mode, '501');
    assert.ok(Array.isArray(entry.players) && entry.players[0].id && entry.players[0].score === 501);

    const ctx = await req(srv, 'GET', `/api/game-context?gameId=${gameId}`);
    assert.strictEqual(ctx.status, 200);
    assert.strictEqual(ctx.body.activePlayerId, p1);
    assert.strictEqual(ctx.body.players.length, 2);
    assert.strictEqual(ctx.body.players[0].score, 501);

    const rc = await req(srv, 'POST', '/api/round-complete', {
      gameId,
      playerId: p1,
      roundNumber: 1,
      throws: [
        { segment: '20', multiplier: 'triple', score: 60 },
        { segment: '20', multiplier: 'triple', score: 60 },
        { segment: '20', multiplier: 'triple', score: 60 },
      ],
    });
    assert.strictEqual(rc.status, 200);
    assert.strictEqual(rc.body.success, true);
    assert.strictEqual(rc.body.gameState.nextPlayerId, p2);
    assert.strictEqual(rc.body.gameState.currentScore, 501);
    assert.strictEqual(rc.body.nextPlayerInfo.name, 'Marcel');

    const ctx2 = await req(srv, 'GET', `/api/game-context?gameId=${gameId}`);
    assert.strictEqual(ctx2.body.players[0].score, 321);
    assert.strictEqual(ctx2.body.activePlayerId, p2);
  } finally {
    srv.close();
  }
});

test('HTTP: round-complete Bust liefert 400 mit details.bust===true', skipHttp, async () => {
  const srv = await listen();
  try {
    const create = await req(srv, 'POST', '/api/games', {
      mode: 101,
      players: [
        { name: 'A', type: 'human', checkoutMode: 'double' },
        { name: 'B', type: 'human', checkoutMode: 'double' },
      ],
    });
    const gameId = create.body.id;
    const pA = create.body.players[0].id;

    // 101 - 60 = 41; 41 - 60 < 0 -> Bust beim 2. Dart.
    const rc = await req(srv, 'POST', '/api/round-complete', {
      gameId,
      playerId: pA,
      roundNumber: 1,
      throws: [
        { segment: '20', multiplier: 'triple', score: 60 },
        { segment: '20', multiplier: 'triple', score: 60 },
        { segment: '20', multiplier: 'triple', score: 60 },
      ],
    });
    assert.strictEqual(rc.status, 400);
    assert.strictEqual(rc.body.success, false);
    assert.strictEqual(rc.body.details.bust, true);
  } finally {
    srv.close();
  }
});

test('HTTP: bulls-out bestimmt Starter (niedrigste bullDistance)', skipHttp, async () => {
  const srv = await listen();
  try {
    const create = await req(srv, 'POST', '/api/games', {
      mode: 501,
      players: [
        { name: 'A', type: 'human', checkoutMode: 'double' },
        { name: 'B', type: 'human', checkoutMode: 'double' },
      ],
    });
    const gameId = create.body.id;
    const pA = create.body.players[0].id;
    const pB = create.body.players[1].id;

    const res = await req(srv, 'POST', '/api/bulls-out', {
      gameId,
      player1: { id: pA, name: 'A', bullDistance: 80 },
      player2: { id: pB, name: 'B', bullDistance: 12 },
      winner: pA,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.winner, pB);

    const ctx = await req(srv, 'GET', `/api/game-context?gameId=${gameId}`);
    assert.strictEqual(ctx.body.activePlayerId, pB);
  } finally {
    srv.close();
  }
});

test('HTTP: game-context 404 bei unbekanntem Spiel', skipHttp, async () => {
  const srv = await listen();
  try {
    const res = await req(srv, 'GET', '/api/game-context?gameId=does-not-exist');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  } finally {
    srv.close();
  }
});

test.after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDb + suffix); } catch (e) { /* ignore */ }
  }
});
