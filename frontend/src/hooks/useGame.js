import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * Lädt den Spielzustand und hält ihn per Server-Sent Events (SSE) live aktuell.
 * Jeder Wurf – egal von welchem Client oder vom serverseitigen Bot – wird an
 * alle verbundenen Clients gepusht. Aktionen (Wurf/Undo/Ausbullen) senden wie
 * gehabt per HTTP und übernehmen die Antwort sofort; SSE gleicht danach ab.
 *
 * Dedupe: Der werfende Client erhält denselben Zustand doppelt – einmal als
 * HTTP-Antwort, einmal als SSE-Echo. `lastApplied` merkt sich den zuletzt
 * angewendeten Zustand (als JSON-String); die jeweils zweite, identische
 * Zustellung wird verworfen, egal in welcher Reihenfolge sie eintrifft.
 * So entfällt ein kompletter Neu-Render + JSON-Parse pro Wurf.
 */
export default function useGame(id) {
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const lastApplied = useRef(null);

  // Zustand aus einer HTTP-Antwort übernehmen – überspringt das Rendern,
  // wenn das SSE-Echo denselben Zustand bereits angewendet hat.
  const applyGame = useCallback((g) => {
    const str = JSON.stringify(g);
    if (str === lastApplied.current) return;
    lastApplied.current = str;
    setGame(g);
  }, []);

  const reload = useCallback(async () => {
    try {
      const g = await api.getGame(id);
      applyGame(g);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, applyGame]);

  // Initialer Load + Live-Verbindung
  useEffect(() => {
    let closed = false;
    reload();

    const es = new EventSource(`/api/games/${id}/stream`);
    es.addEventListener('state', (e) => {
      if (closed) return;
      // Bereits angewendeter Zustand (eigener Wurf)? Dann nicht erneut rendern.
      if (e.data === lastApplied.current) {
        setLoading(false);
        return;
      }
      try {
        lastApplied.current = e.data;
        setGame(JSON.parse(e.data));
        setLoading(false);
      } catch (err) {
        /* ignore malformed */
      }
    });
    es.addEventListener('deleted', () => {
      if (!closed) setError('Dieses Spiel wurde abgebrochen.');
    });

    return () => {
      closed = true;
      es.close();
    };
  }, [id, reload]);

  const throwDart = useCallback(
    async (dart) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const g = await api.throwDart(id, dart);
        applyGame(g);
      } catch (e) {
        setError(e.message);
      } finally {
        busy.current = false;
      }
    },
    [id, applyGame]
  );

  // Mehrere Fehlwürfe (0) in Folge senden – für die "Double/Triple 0"-Kurzeingabe.
  // Sequenziell und unter einer Sperre, damit die Würfe nicht durcheinandergeraten.
  const throwMisses = useCallback(
    async (count) => {
      const n = Math.max(1, Math.min(3, Math.trunc(Number(count) || 1)));
      if (busy.current) return;
      busy.current = true;
      try {
        let g = null;
        for (let i = 0; i < n; i++) {
          // eslint-disable-next-line no-await-in-loop
          g = await api.throwDart(id, { segment: 0, multiplier: 1 });
        }
        if (g) applyGame(g);
      } catch (e) {
        setError(e.message);
      } finally {
        busy.current = false;
      }
    },
    [id, applyGame]
  );

  // Freitext-Summe: Fehler NICHT global setzen (sonst verschwindet die Spielansicht),
  // sondern zurückgeben, damit die Eingabe sie inline anzeigen kann.
  const submitVisit = useCallback(
    async (sum, checkoutDarts) => {
      if (busy.current) return { ok: false, error: 'Bitte warten…' };
      busy.current = true;
      try {
        const g = await api.submitVisit(id, sum, checkoutDarts);
        applyGame(g);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      } finally {
        busy.current = false;
      }
    },
    [id, applyGame]
  );

  const undo = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const g = await api.undo(id);
      applyGame(g);
    } catch (e) {
      setError(e.message);
    } finally {
      busy.current = false;
    }
  }, [id, applyGame]);

  const finishGame = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const g = await api.finishGame(id);
      applyGame(g);
    } catch (e) {
      setError(e.message);
    } finally {
      busy.current = false;
    }
  }, [id, applyGame]);

  const bullOff = useCallback(
    async (winnerId) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const g = await api.bullOff(id, winnerId);
        applyGame(g);
      } catch (e) {
        setError(e.message);
      } finally {
        busy.current = false;
      }
    },
    [id, applyGame]
  );

  return { game, error, loading, throwDart, throwMisses, submitVisit, undo, bullOff, finishGame, reload };
}
