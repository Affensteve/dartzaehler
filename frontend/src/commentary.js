// Regelbasierte Live-Kommentar-Bausteine. Wählt je Ereignis zufällig eine
// von mehreren lokalisierten Formulierungen (kein externer Dienst).
import { t } from './i18n';

const SETS = {
  s180: ['cmt.180a', 'cmt.180b', 'cmt.180c'],
  big: ['cmt.biga', 'cmt.bigb'],
  checkout: ['cmt.coa', 'cmt.cob'],
  bust: ['cmt.busta', 'cmt.bustb'],
  match: ['cmt.matcha', 'cmt.matchb'],
};

export function comment(event, vars) {
  const keys = SETS[event];
  if (!keys || !keys.length) return '';
  const key = keys[Math.floor(Math.random() * keys.length)];
  return t(key, vars);
}
