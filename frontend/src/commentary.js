// Regelbasierte Live-Kommentar-Bausteine. Wählt je Ereignis zufällig eine
// von mehreren lokalisierten Formulierungen (kein externer Dienst).
import { t } from './i18n';

const SETS = {
  s180: ['cmt.180a', 'cmt.180b', 'cmt.180c', 'cmt.180d', 'cmt.180e', 'cmt.180f', 'cmt.180g', 'cmt.180h', 'cmt.180i', 'cmt.180j'],
  s140: ['cmt.140a', 'cmt.140b', 'cmt.140c', 'cmt.140d', 'cmt.140e', 'cmt.140f', 'cmt.140g', 'cmt.140h'],
  big: ['cmt.biga', 'cmt.bigb', 'cmt.bigc', 'cmt.bigd', 'cmt.bige', 'cmt.bigf', 'cmt.bigg', 'cmt.bigh', 'cmt.bigi', 'cmt.bigj'],
  checkout: ['cmt.coa', 'cmt.cob', 'cmt.coc', 'cmt.cod', 'cmt.coe', 'cmt.cof', 'cmt.cog', 'cmt.coh', 'cmt.coi', 'cmt.coj', 'cmt.cok', 'cmt.col', 'cmt.com', 'cmt.con', 'cmt.coo', 'cmt.cop', 'cmt.coq', 'cmt.cor', 'cmt.cos', 'cmt.cot'],
  bigco: ['cmt.bigcoa', 'cmt.bigcob', 'cmt.bigcoc', 'cmt.bigcod', 'cmt.bigcoe', 'cmt.bigcof', 'cmt.bigcog', 'cmt.bigcoh'],
  bust: ['cmt.busta', 'cmt.bustb', 'cmt.bustc', 'cmt.bustd', 'cmt.buste', 'cmt.bustf', 'cmt.bustg', 'cmt.busth', 'cmt.busti', 'cmt.bustj', 'cmt.bustk', 'cmt.bustl', 'cmt.bustm', 'cmt.bustn', 'cmt.busto', 'cmt.bustp', 'cmt.bustq', 'cmt.bustr', 'cmt.busts', 'cmt.bustt'],
  match: ['cmt.matcha', 'cmt.matchb', 'cmt.matchc', 'cmt.matchd', 'cmt.matche', 'cmt.matchf', 'cmt.matchg', 'cmt.matchh', 'cmt.matchi', 'cmt.matchj', 'cmt.matchk', 'cmt.matchl', 'cmt.matchm', 'cmt.matchn', 'cmt.matcho', 'cmt.matchp', 'cmt.matchq', 'cmt.matchr', 'cmt.matchs', 'cmt.matcht'],
};

export function comment(event, vars) {
  const keys = SETS[event];
  if (!keys || !keys.length) return '';
  const key = keys[Math.floor(Math.random() * keys.length)];
  return t(key, vars);
}
