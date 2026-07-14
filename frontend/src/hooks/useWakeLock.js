import { useEffect, useRef } from 'react';
import NoSleep from 'nosleep.js';

/**
 * Hält den Bildschirm wach, solange `active` true ist – gedacht für den
 * eingabefreien Cast-/Anzeigetafel-Modus (TV/Tablet dimmt sonst weg).
 *
 * Nutzt die native Screen-Wake-Lock-API, wenn verfügbar (HTTPS/localhost).
 * Der Pi liefert jedoch über http:// im LAN aus – dort ist die native API
 * gesperrt; nosleep.js fällt dann automatisch auf ein stummes Loop-Video
 * zurück. Dessen Start (video.play()) braucht eine Nutzergeste, deshalb wird
 * beim ersten Tippen/Tastendruck nachgezogen. Beim Verlassen bzw. Spielende
 * wird der Lock wieder freigegeben, damit der Screen normal schlafen darf.
 */
export default function useWakeLock(active = true) {
  const noSleep = useRef(null);
  const on = useRef(false);

  useEffect(() => {
    if (!active) return undefined;
    const get = () => (noSleep.current || (noSleep.current = new NoSleep()));

    const enable = () => {
      if (on.current) return;
      try {
        // play() muss synchron in der Geste starten; das Promise dürfen wir ignorieren.
        Promise.resolve(get().enable())
          .then(() => {
            on.current = true;
          })
          .catch(() => {
            /* ohne Nutzergeste (HTTP) abgelehnt – beim ersten Tap erneut versuchen */
          });
      } catch {
        /* API nicht verfügbar – ignorieren */
      }
    };

    // Nativer Versuch sofort (greift im secure context ohne Geste).
    enable();
    // Video-Fallback (HTTP) beim ersten Tap/Tastendruck aktivieren.
    const onGesture = () => enable();
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture);

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      try {
        if (on.current) {
          get().disable();
          on.current = false;
        }
      } catch {
        /* ignorieren */
      }
    };
  }, [active]);
}
