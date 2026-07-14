// Zentrale API-Anbindung. Basis-URL ist relativ (gleicher Origin wie das
// ausgelieferte Frontend); im Dev-Modus proxyt Vite /api ans Backend.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Fehler ${res.status}`);
  }
  return data;
}

export const api = {
  // Pfeile
  listDarts: () => request('/darts'),
  createDart: (body) => request('/darts', { method: 'POST', body: JSON.stringify(body) }),
  updateDart: (id, body) => request(`/darts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDart: (id) => request(`/darts/${id}`, { method: 'DELETE' }),

  // Spieler
  listPlayers: () => request('/players'),
  listSavedTeams: () => request('/teams'),
  createSavedTeam: (body) => request('/teams', { method: 'POST', body: JSON.stringify(body) }),
  deleteSavedTeam: (id) => request(`/teams/${id}`, { method: 'DELETE' }),
  getPlayer: (id) => request(`/players/${id}`),
  getPlayerDoubles: (id) => request(`/players/${id}/doubles`),
  updatePlayerProfile: (id, body) =>
    request(`/players/${id}/profile`, { method: 'PUT', body: JSON.stringify(body) }),
  getCoach: (id) => request(`/players/${id}/coach`),
  getPlayerAchievements: (id) => request(`/players/${id}/achievements`),
  createPlayer: (body) => request('/players', { method: 'POST', body: JSON.stringify(body) }),
  updatePlayer: (id, body) =>
    request(`/players/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Einzelspiel
  createGame: (config) => request('/games', { method: 'POST', body: JSON.stringify(config) }),
  getGame: (id) => request(`/games/${id}`),
  listGames: () => request('/games'),
  throwDart: (id, dart) =>
    request(`/games/${id}/throw`, { method: 'POST', body: JSON.stringify(dart) }),
  submitVisit: (id, sum, checkoutDarts) =>
    request(`/games/${id}/visit`, {
      method: 'POST',
      body: JSON.stringify(checkoutDarts != null ? { sum, checkoutDarts } : { sum }),
    }),
  finishGame: (id) => request(`/games/${id}/finish`, { method: 'POST' }),
  botTurn: (id) => request(`/games/${id}/bot-turn`, { method: 'POST' }),
  undo: (id) => request(`/games/${id}/undo`, { method: 'POST' }),
  bullOff: (id, winnerId) =>
    request(`/games/${id}/bulloff`, { method: 'POST', body: JSON.stringify({ winnerId }) }),
  deleteGame: (id) => request(`/games/${id}`, { method: 'DELETE' }),

  // Turnier
  createTournament: (config) =>
    request('/tournaments', { method: 'POST', body: JSON.stringify(config) }),
  getTournament: (id) => request(`/tournaments/${id}`),
  listTournaments: () => request('/tournaments'),
  startMatch: (tid, mid) =>
    request(`/tournaments/${tid}/matches/${mid}/start`, { method: 'POST' }),
  startKo: (tid) => request(`/tournaments/${tid}/start-ko`, { method: 'POST' }),
  tournamentBulloff: (tid, body) =>
    request(`/tournaments/${tid}/bulloff`, { method: 'POST', body: JSON.stringify(body) }),
  deleteTournament: (id) => request(`/tournaments/${id}`, { method: 'DELETE' }),

  // Statistik (area: 'game' = Spiel & Turnier, 'training' = Training)
  listStats: (range = 'all', area = 'game') => request(`/stats?range=${range}&area=${area}`),
  getPlayerStats: (id, range = 'all', area = 'game', dartId = null) =>
    request(`/stats/${id}?range=${range}&area=${area}${dartId != null ? `&dart=${dartId}` : ''}`),
  playerDarts: (id, area = 'game') => request(`/stats/${id}/darts?area=${area}`),
  playerSectors: (id, area = 'game', range = 'all') =>
    request(`/stats/${id}/sectors?area=${area}&range=${range}`),
  playerTimeline: (id, range = 'all', area = 'game', dartId = null) =>
    request(`/stats/${id}/timeline?range=${range}&area=${area}${dartId != null ? `&dart=${dartId}` : ''}`),

  // Match-Historie (abgeschlossene Spiele + Aufnahme-Verlauf)
  listMatches: (range = 'all', area = 'all', player = null) =>
    request(`/matches?range=${range}&area=${area}${player != null ? `&player=${player}` : ''}`),
  getMatch: (id) => request(`/matches/${id}`),
  headToHead: (a, b) => request(`/matches/h2h?a=${a}&b=${b}`),

  // Achievements (Katalog + wer hat sie erreicht)
  getAchievements: () => request('/achievements'),
  deleteMatch: (id) => request(`/matches/${id}`, { method: 'DELETE' }),

  // Export (CSV) – Datei-Download laeuft ueber einen Link, nicht ueber fetch()
  exportStatsUrl: (range = 'all', area = 'game') => `/api/export/stats.csv?range=${range}&area=${area}`,
  exportMatchesUrl: (range = 'all', area = 'all', player = null) =>
    `/api/export/matches.csv?range=${range}&area=${area}${player != null ? `&player=${player}` : ''}`,

  // Training
  trainingRecord: (playerId, mode, score, detail) =>
    request('/training/records', { method: 'POST', body: JSON.stringify({ playerId, mode, score, detail }) }),
  trainingBests: (playerId) => request(`/training/records/${playerId}`),
  listDrills: (playerId) => request(`/training/drills?player=${playerId}`),
  createDrill: (body) => request('/training/drills', { method: 'POST', body: JSON.stringify(body) }),
  updateDrill: (id, body) => request(`/training/drills/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDrill: (id) => request(`/training/drills/${id}`, { method: 'DELETE' }),
  trainingStats: (playerId, range = 'all') => request(`/training/stats/${playerId}?range=${range}`),
  trainingScoring: (body) => request('/training/scoring', { method: 'POST', body: JSON.stringify(body) }),

  // Einstellungen (key/value)
  getSettings: () => request('/settings'),
  setSetting: (key, value) => request('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),
};
