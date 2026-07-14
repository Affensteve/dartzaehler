'use strict';

/**
 * Einfacher Event-Bus für Server-Sent Events (SSE) pro Spiel.
 * Jeder verbundene Client (Anzeigetafel/Handy) abonniert ein Spiel und
 * erhält bei jeder Zustandsänderung den kompletten Spielstand gepusht.
 */

// gameId -> Set<res>
const channels = new Map();

function subscribe(gameId, res) {
  let set = channels.get(gameId);
  if (!set) {
    set = new Set();
    channels.set(gameId, set);
  }
  set.add(res);
  return () => {
    const s = channels.get(gameId);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) channels.delete(gameId);
  };
}

function hasSubscribers(gameId) {
  const s = channels.get(gameId);
  return Boolean(s && s.size > 0);
}

/** Sendet ein Event an alle Abonnenten eines Spiels. */
function publish(gameId, event, data) {
  const set = channels.get(gameId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (e) {
      /* defekte Verbindung – wird beim close-Event entfernt */
    }
  }
}

module.exports = { subscribe, hasSubscribers, publish };
