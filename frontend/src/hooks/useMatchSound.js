import { useEffect, useRef } from 'react';
import { playEffect, callCue, sayCueWithName, sayScore, sayIntro, sayCommentary, parseVoicePref } from '../sound';
import { comment } from '../commentary';

/**
 * Übersetzt Änderungen des Spielzustands in Sound-Effekte, Voice-Caller-Ansagen
 * und (optional) regelbasierten Live-Kommentar. Diff gegen den vorherigen Zustand,
 * damit jedes Ereignis genau einmal ausgelöst wird. Alle Ausgaben respektieren die
 * Ton-Einstellung des jeweiligen Geräts.
 *
 * @param {object}   game
 * @param {object}   [opts]
 * @param {boolean}  [opts.announceOnEnter]  Eröffnung auch beim Betreten eines laufenden Spiels (Cast).
 * @param {Function} [opts.onComment]        Callback für den Live-Kommentar-Text (z. B. Ticker auf der Anzeigetafel).
 */
export default function useMatchSound(game, { announceOnEnter = false, onComment } = {}) {
  const prev = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    if (!game) return;
    const p = prev.current;
    const prefOf = (pl) => (pl ? parseVoicePref(pl.voice) : null);
    const emit = (event, vars) => {
      const text = comment(event, vars);
      if (!text) return;
      sayCommentary(text);
      if (onComment) onComment(text);
    };

    // Erstkontakt mit einem laufenden Spiel: einmalig Eröffnungsansage.
    if (!started.current && game.status === 'playing') {
      started.current = true;
      const fresh =
        game.legNumber === 1 &&
        game.setNumber === 1 &&
        game.players.every((p2) => (p2.dartsThrown || 0) === 0);
      if (announceOnEnter || fresh) sayIntro(game.players.map((p2) => p2.name));
      prev.current = game;
      return;
    }

    if (p) {
      const justFinished = game.status === 'finished' && p.status !== 'finished';
      if (justFinished) {
        const winner = game.players.find((pl) => pl.id === game.winnerId);
        playEffect('match');
        sayCueWithName(winner ? winner.name : null, 'game-shot-match', prefOf(winner));
        emit('match', { name: winner ? winner.name : '' });
      } else {
        const finisher = game.players[p.currentPlayerIndex];
        const pref = prefOf(finisher);
        const name = finisher ? finisher.name : '';
        const msgChanged = game.message && game.messageSeq !== p.messageSeq;
        if (msgChanged) {
          if (game.message === 'CHECKOUT') {
            playEffect('leg');
            sayCueWithName(name || null, 'game-shot', pref);
            const co = finisher ? finisher.lastVisitScore : 0;
            if (co >= 60) emit('checkout', { name, score: co });
          } else if (game.message === 'BUST') {
            playEffect('bust');
            callCue('no-score', pref);
            emit('bust', { name });
          } else if (game.message === 'BULLOFF_WIN') {
            playEffect('leg');
          }
        }
        if (game.awaitingBullOff && !p.awaitingBullOff) playEffect('bulloff');

        // Abgeschlossene Aufnahme (Zugwechsel, kein Checkout/Bust): Score + Kommentar
        if (
          game.currentPlayerIndex !== p.currentPlayerIndex &&
          game.message !== 'CHECKOUT' &&
          game.message !== 'BUST' &&
          game.message !== 'BULLOFF_WIN'
        ) {
          const sc = finisher ? finisher.lastVisitScore : 0;
          if (sc > 0) sayScore(sc, pref);
          if (sc === 180) emit('s180', { name });
          else if (sc >= 100) emit('big', { name, score: sc });
        }
      }
    }
    prev.current = game;
  }, [game, announceOnEnter, onComment]);
}
