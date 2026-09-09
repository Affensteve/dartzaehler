'use strict';

// Achievement-Katalog. Jeder Eintrag hat eine Beschreibung, wie er zu erreichen
// ist, und eine check(ctx)-Funktion. ctx = { agg, match, training }:
//   agg      = kumulierte Spiel-/Turnier-Statistik des Spielers (statsStore.get)
//   match    = Kennzahlen des gerade beendeten Spiels (oder null bei Training)
//   training = aggregierte Trainings-Statistik je Modus (trainingStore.playerStats)

const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const trainSessions = (t) => Object.values(t || {}).reduce((s, m) => s + n(m.sessions), 0);
const modeBest = (t, mode) => (t && t[mode] ? t[mode].best : null);
const modeDetail = (t, mode) => (t && t[mode] ? t[mode].detail || {} : {});

const ACHIEVEMENTS = [
  // --- Siege ---
  { id: 'win-1', cat: 'Siege', name: 'Erster Sieg', desc: 'Gewinne dein erstes Spiel.', check: (c) => n(c.agg.wins) >= 1 },
  { id: 'win-10', cat: 'Siege', name: 'Routinier', desc: 'Gewinne 10 Spiele.', check: (c) => n(c.agg.wins) >= 10 },
  { id: 'win-50', cat: 'Siege', name: 'Vielgewinner', desc: 'Gewinne 50 Spiele.', check: (c) => n(c.agg.wins) >= 50 },
  { id: 'win-100', cat: 'Siege', name: 'Champion', desc: 'Gewinne 100 Spiele.', check: (c) => n(c.agg.wins) >= 100 },
  { id: 'win-streak-3', cat: 'Siege', name: 'Auf Serie', desc: 'Gewinne 3 Spiele in Folge.', check: (c) => n(c.agg.winStreak) >= 3 },
  { id: 'clean-set', cat: 'Siege', name: 'Zu-Null-Satz', desc: 'Gewinne einen Satz, ohne ein Leg abzugeben.', check: (c) => c.match && c.match.cleanSet === true },
  { id: 'comeback', cat: 'Siege', name: 'Comeback', desc: 'Gewinne ein Match, in dem ein Gegner bereits am Matchdart war.', check: (c) => c.match && c.match.comeback === true },
  { id: 'whitewash', cat: 'Siege', name: 'Whitewash', desc: 'Gewinne ein Match (mind. 2 Legs), ohne dem Gegner ein Leg zu lassen.', check: (c) => c.match && c.match.won && c.match.oppLegs === 0 && c.match.legsWon >= 2 },

  // --- Scoring ---
  { id: 'turn-100', cat: 'Scoring', name: 'Ton', desc: 'Wirf eine Aufnahme von 100 oder mehr.', check: (c) => n(c.agg.maxTurn) >= 100 },
  { id: 'turn-140', cat: 'Scoring', name: 'Ton-40', desc: 'Wirf eine Aufnahme von 140 oder mehr.', check: (c) => n(c.agg.maxTurn) >= 140 },
  { id: 'max-180-1', cat: 'Scoring', name: 'Maximum!', desc: 'Wirf deine erste 180.', check: (c) => n(c.agg.s180) >= 1 },
  { id: 'max-180-10', cat: 'Scoring', name: '180-Sammler', desc: 'Wirf insgesamt 10 mal die 180.', check: (c) => n(c.agg.s180) >= 10 },
  { id: 'max-180-50', cat: 'Scoring', name: '180-Maschine', desc: 'Wirf insgesamt 50 mal die 180.', check: (c) => n(c.agg.s180) >= 50 },
  { id: 'max-180-100', cat: 'Scoring', name: '180-Legende', desc: 'Wirf insgesamt 100 mal die 180.', check: (c) => n(c.agg.s180) >= 100 },
  { id: 'three-180-match', cat: 'Scoring', name: 'Drei-Maximum', desc: 'Wirf drei 180er in einem einzigen Match.', check: (c) => c.match && n(c.match.oneEighties) >= 3 },
  { id: 'match-avg-60', cat: 'Scoring', name: 'Solide Serie', desc: 'Beende ein Match mit einem Average von 60+.', check: (c) => c.match && n(c.match.average) >= 60 },
  { id: 'match-avg-80', cat: 'Scoring', name: 'Scharfschütze', desc: 'Beende ein Match mit einem Average von 80+.', check: (c) => c.match && n(c.match.average) >= 80 },
  { id: 'match-avg-100', cat: 'Scoring', name: 'Ton-Average', desc: 'Beende ein Match mit einem Average von 100+.', check: (c) => c.match && n(c.match.average) >= 100 },
  { id: 'hit-t20', cat: 'Scoring', name: 'Triple 20', desc: 'Triff das Triple 20.', check: (c) => n(c.agg.sectors && c.agg.sectors['T20']) >= 1 },
  { id: 'hit-t20-50', cat: 'Scoring', name: 'Triple-Sammler', desc: 'Triff insgesamt 50 mal das Triple 20.', check: (c) => n(c.agg.sectors && c.agg.sectors['T20']) >= 50 },
  { id: 'shanghai-live', cat: 'Scoring', name: 'Shanghai', desc: 'Triff in einer Aufnahme Single, Double und Triple derselben Zahl.', check: (c) => c.match && n(c.match.shanghai) >= 1 },

  // --- Checkout ---
  { id: 'co-100', cat: 'Checkout', name: 'High Finish', desc: 'Checke 100 oder mehr Punkte auf einmal.', check: (c) => n(c.agg.maxCheckout) >= 100 },
  { id: 'co-120', cat: 'Checkout', name: 'Ton-20-Finish', desc: 'Checke 120 oder mehr Punkte auf einmal.', check: (c) => n(c.agg.maxCheckout) >= 120 },
  { id: 'co-big-fish', cat: 'Checkout', name: 'Big Fish', desc: 'Das große Finish: checke 170 (T20-T20-Bull).', check: (c) => n(c.agg.maxCheckout) >= 170 },
  { id: 'nine-darter', cat: 'Checkout', name: 'Neun-Darter', desc: 'Gewinne ein 501-Leg mit nur 9 Darts.', check: (c) => c.match && c.match.mode === 501 && c.match.minDartsLeg === 9 },
  { id: 'lowton-501', cat: 'Checkout', name: 'Sparsam', desc: 'Gewinne ein 501-Leg mit 15 Darts oder weniger.', check: (c) => c.match && c.match.mode === 501 && c.match.minDartsLeg != null && c.match.minDartsLeg <= 15 },
  { id: 'bull-finish', cat: 'Checkout', name: 'Bull-Finish', desc: 'Checke ein Leg direkt auf dem Bullseye aus.', check: (c) => c.match && c.match.bullFinish === true },
  { id: 'co-streak-5', cat: 'Checkout', name: 'Doppel-Serie', desc: 'Gewinne 5 Legs in Folge per Checkout.', check: (c) => c.match && n(c.match.coStreakMax) >= 5 },
  { id: 'double-master', cat: 'Checkout', name: 'Doppel-Meister', desc: 'Erreiche eine Doppelquote von 40%+ (mind. 20 Doppelversuche).', check: (c) => n(c.agg.doubleTries) >= 20 && n(c.agg.doubleRatePct) >= 40 },
  { id: 'first-double', cat: 'Checkout', name: 'Erstes Doppel', desc: 'Triff dein erstes Doppel zum Ausmachen.', check: (c) => n(c.agg.doubleHits) >= 1 },
  { id: 'hit-bull', cat: 'Checkout', name: 'Bullseye', desc: 'Triff das Bullseye (Doppel-Bull, 50).', check: (c) => n(c.agg.sectors && c.agg.sectors['D25']) >= 1 },
  { id: 'hit-bull-25', cat: 'Checkout', name: 'Bull-Jäger', desc: 'Triff insgesamt 25 mal das Bullseye.', check: (c) => n(c.agg.sectors && c.agg.sectors['D25']) >= 25 },

  // --- Meilensteine ---
  { id: 'games-1', cat: 'Meilensteine', name: 'Willkommen', desc: 'Spiele dein erstes Spiel.', check: (c) => n(c.agg.games) >= 1 },
  { id: 'games-10', cat: 'Meilensteine', name: 'Angekommen', desc: 'Spiele 10 Spiele.', check: (c) => n(c.agg.games) >= 10 },
  { id: 'games-50', cat: 'Meilensteine', name: 'Stammspieler', desc: 'Spiele 50 Spiele.', check: (c) => n(c.agg.games) >= 50 },
  { id: 'games-100', cat: 'Meilensteine', name: 'Dartsverrückt', desc: 'Spiele 100 Spiele.', check: (c) => n(c.agg.games) >= 100 },
  { id: 'legs-50', cat: 'Meilensteine', name: 'Leg-Jäger', desc: 'Gewinne insgesamt 50 Legs.', check: (c) => n(c.agg.legsWon) >= 50 },
  { id: 'legs-250', cat: 'Meilensteine', name: 'Leg-Fabrik', desc: 'Gewinne insgesamt 250 Legs.', check: (c) => n(c.agg.legsWon) >= 250 },
  { id: 'darts-10k', cat: 'Meilensteine', name: 'Vielwerfer', desc: 'Wirf insgesamt 10.000 Darts.', check: (c) => n(c.agg.dartsTotal) >= 10000 },
  { id: 'early-bird', cat: 'Kurios', name: 'Frühaufsteher', desc: 'Beende ein Spiel zwischen 5 und 8 Uhr morgens.', check: (c) => c.now && c.now.getHours() >= 5 && c.now.getHours() < 8 },
  { id: 'night-owl', cat: 'Kurios', name: 'Nachteule', desc: 'Beende ein Spiel zwischen 0 und 5 Uhr.', check: (c) => c.now && c.now.getHours() < 5 },

  // --- Training ---
  { id: 'train-1', cat: 'Training', name: 'Trainingsauftakt', desc: 'Absolviere deine erste Trainingseinheit.', check: (c) => trainSessions(c.training) >= 1 },
  { id: 'train-25', cat: 'Training', name: 'Fleißig', desc: 'Absolviere 25 Trainingseinheiten.', check: (c) => trainSessions(c.training) >= 25 },
  { id: 'train-100', cat: 'Training', name: 'Trainingsweltmeister', desc: 'Absolviere 100 Trainingseinheiten.', check: (c) => trainSessions(c.training) >= 100 },
  { id: 'allrounder', cat: 'Training', name: 'Allrounder', desc: 'Spiele jeden der 7 Trainingsmodi mindestens einmal.', check: (c) => ['clock', 'bob27', 'countup', 'cricket', 'shanghai', 'halveit', 'checkout'].every((m) => c.training && c.training[m] && c.training[m].sessions > 0) },
  { id: 'bob27-50', cat: 'Training', name: 'Bob geknackt', desc: 'Erreiche 50+ Punkte bei Bob’s 27.', check: (c) => modeBest(c.training, 'bob27') != null && modeBest(c.training, 'bob27') >= 50 },
  { id: 'bob27-100', cat: 'Training', name: 'Doppel-Guru', desc: 'Erreiche 100+ Punkte bei Bob’s 27.', check: (c) => modeBest(c.training, 'bob27') != null && modeBest(c.training, 'bob27') >= 100 },
  { id: 'countup-400', cat: 'Training', name: 'Count-up-Kanone', desc: 'Erreiche 400+ Punkte bei Count-up.', check: (c) => modeBest(c.training, 'countup') != null && modeBest(c.training, 'countup') >= 400 },
  { id: 'countup-500', cat: 'Training', name: 'Count-up-König', desc: 'Erreiche 500+ Punkte bei Count-up.', check: (c) => modeBest(c.training, 'countup') != null && modeBest(c.training, 'countup') >= 500 },
  { id: 'countup-180', cat: 'Training', name: '180 im Training', desc: 'Wirf im Count-up-Training eine 180.', check: (c) => n(modeDetail(c.training, 'countup').s180) >= 1 },
  { id: 'clock-40', cat: 'Training', name: 'Uhrwerk', desc: 'Schaffe Around the Clock in 40 Darts oder weniger.', check: (c) => modeBest(c.training, 'clock') != null && modeBest(c.training, 'clock') <= 40 },
  { id: 'clock-25', cat: 'Training', name: 'Uhr-Meister', desc: 'Schaffe Around the Clock in 25 Darts oder weniger.', check: (c) => modeBest(c.training, 'clock') != null && modeBest(c.training, 'clock') <= 25 },
  { id: 'cricket-30', cat: 'Training', name: 'Cricket-Crack', desc: 'Schließe Cricket in 30 Darts oder weniger.', check: (c) => modeBest(c.training, 'cricket') != null && modeBest(c.training, 'cricket') <= 30 },
  { id: 'shanghai-hit', cat: 'Training', name: 'Shanghai!', desc: 'Triff im Shanghai-Training ein Shanghai (Single, Double und Triple eines Feldes).', check: (c) => n(modeDetail(c.training, 'shanghai').shanghais) >= 1 },
  { id: 'halveit-200', cat: 'Training', name: 'Konstanz', desc: 'Erreiche 200+ Punkte bei Halve-it.', check: (c) => modeBest(c.training, 'halveit') != null && modeBest(c.training, 'halveit') >= 200 },
  { id: 'co-challenge-1', cat: 'Training', name: 'Finisher', desc: 'Meistere die Checkout-Challenge (mind. 1 Checkout).', check: (c) => modeBest(c.training, 'checkout') != null && modeBest(c.training, 'checkout') >= 1 },
  { id: 'co-challenge-5', cat: 'Training', name: 'Doppel-Sniper', desc: 'Schaffe 5 Checkouts in der Checkout-Challenge.', check: (c) => modeBest(c.training, 'checkout') != null && modeBest(c.training, 'checkout') >= 5 },

  // --- Team/Doppel ---
  { id: 'team-win', cat: 'Team', name: 'Doppel-Sieg', desc: 'Gewinne ein Doppel-/Team-Match.', check: (c) => c.match && c.match.teamWin === true },
  { id: 'team-whitewash', cat: 'Team', name: 'Team-Zu-Null', desc: 'Gewinne als Team ein Match (mind. 2 Legs), ohne dem Gegner ein Leg zu lassen.', check: (c) => c.match && c.match.teamWhitewash === true },
  { id: 'team-180-leg', cat: 'Team', name: 'Gemeinsames 180er-Leg', desc: 'Beide Partner werfen im selben Leg jeweils ein 180er.', check: (c) => c.match && c.match.team180Leg === true },
  { id: 'team-partner-co', cat: 'Team', name: 'Partner-Checkout', desc: 'Beide Partner tragen zu einem per Checkout gewonnenen Leg bei.', check: (c) => c.match && c.match.teamPartnerCo === true },

  // --- Stufe 2: Mehr Achievements ---
  { id: 'games-500', cat: 'Meilensteine', name: 'Dart-Enthusiast', desc: 'Spiele 500 Spiele.', check: (c) => n(c.agg.games) >= 500 },
  { id: 'games-1000', cat: 'Meilensteine', name: 'Dart-Veteran', desc: 'Spiele 1.000 Spiele.', check: (c) => n(c.agg.games) >= 1000 },
  { id: 'legs-1000', cat: 'Meilensteine', name: 'Leg-Legende', desc: 'Gewinne insgesamt 1.000 Legs.', check: (c) => n(c.agg.legsWon) >= 1000 },
  { id: 'darts-50k', cat: 'Meilensteine', name: 'Dauerwerfer', desc: 'Wirf insgesamt 50.000 Darts.', check: (c) => n(c.agg.dartsTotal) >= 50000 },
  { id: 'play-streak-7', cat: 'Meilensteine', name: 'Täglich am Board', desc: 'Spiele an 7 Tagen in Folge.', check: (c) => n(c.playStreak) >= 7 },
  { id: 'match-avg-110', cat: 'Scoring', name: 'Weltklasse-Ø', desc: 'Beende ein Match mit einem Average von 110+.', check: (c) => c.match && n(c.match.average) >= 110 },
  { id: 'match-avg-120', cat: 'Scoring', name: 'Traum-Ø', desc: 'Beende ein Match mit einem Average von 120+.', check: (c) => c.match && n(c.match.average) >= 120 },
  { id: 'high-roller', cat: 'Scoring', name: 'High Roller', desc: 'Wirf drei 140+-Aufnahmen in einem Match.', check: (c) => c.match && n(c.match.s140Plus) >= 3 },
  { id: 'two-180-row', cat: 'Scoring', name: 'Doppel-Maximum', desc: 'Wirf zwei 180er in Folge.', check: (c) => c.match && c.match.twoInRow180 === true },
  { id: 'bull-bull', cat: 'Checkout', name: 'Bull-Bull-Finish', desc: 'Checke ein Leg mit zwei Bulls in einer Aufnahme.', check: (c) => c.match && c.match.bullBullFinish === true },
  { id: 'madhouse', cat: 'Checkout', name: 'Madhouse', desc: 'Finish auf das Doppel 1 (Rest 2).', check: (c) => c.match && c.match.madhouse === true },
  { id: 'clutch-finish', cat: 'Checkout', name: 'Nervenstark', desc: 'Beende ein Match mit einem 100+-Checkout.', check: (c) => c.match && c.match.clutchFinish === true },
  { id: 'bed-breakfast', cat: 'Kurios', name: 'Bed & Breakfast', desc: 'Wirf eine Aufnahme von genau 26 Punkten.', check: (c) => c.match && c.match.bedBreakfast === true },
  { id: 'three-in-bed', cat: 'Kurios', name: 'Drei im Bett', desc: 'Triff in einer Aufnahme dreimal dieselbe Zahl.', check: (c) => c.match && c.match.threeInBed === true },
  { id: 'nuller', cat: 'Kurios', name: 'Nuller', desc: 'Wirf eine Aufnahme mit 0 Punkten (drei Fehlwürfe).', check: (c) => c.match && c.match.nuller === true },
  { id: 'weekend-warrior', cat: 'Kurios', name: 'Wochenend-Krieger', desc: 'Beende ein Spiel an einem Samstag oder Sonntag.', check: (c) => c.now && (c.now.getDay() === 0 || c.now.getDay() === 6) },
  { id: 'birthday-game', cat: 'Kurios', name: 'Geburtstagsspiel', desc: 'Spiele an deinem Geburtstag (Profil-Geburtsdatum).', check: (c) => { if (!c.player || !c.player.birthday || !c.now) return false; const pad = (x) => String(x).padStart(2, '0'); return c.player.birthday.slice(5) === `${pad(c.now.getMonth() + 1)}-${pad(c.now.getDate())}`; } },
  { id: 'clock-20', cat: 'Training', name: 'Uhrwerk-Profi', desc: 'Schaffe Around the Clock in 20 Darts oder weniger.', check: (c) => modeBest(c.training, 'clock') != null && modeBest(c.training, 'clock') <= 20 },
  { id: 'bob27-150', cat: 'Training', name: 'Bob-Perfektion', desc: 'Erreiche 150+ Punkte bei Bob’s 27.', check: (c) => modeBest(c.training, 'bob27') != null && modeBest(c.training, 'bob27') >= 150 },
  { id: 'builder-goal', cat: 'Training', name: 'Eigenes Training', desc: 'Spiele eine selbst erstellte Übung aus dem Trainings-Builder.', check: (c) => c.training && Object.keys(c.training).some((k) => k.startsWith('custom_') && c.training[k] && c.training[k].sessions > 0) },
  { id: 'train-streak-7', cat: 'Training', name: 'Trainingswoche', desc: 'Trainiere an 7 Tagen in Folge.', check: (c) => n(c.trainStreak) >= 7 },
  { id: 'team-partner-co-3', cat: 'Team', name: 'Eingespieltes Team', desc: 'Erzielt drei Partner-Checkouts in einem Doppel-Match.', check: (c) => c.match && n(c.match.teamPartnerCoCount) >= 3 },

  // --- Aufnahme-Kombinationen (ein Zug) ---
  { id: 'two-t20', cat: 'Scoring', name: 'Doppel-Triple 20', desc: 'Triff in einer Aufnahme zweimal das Triple 20.', check: (c) => c.match && c.match.twoT20 === true },
  { id: 'two-bull', cat: 'Checkout', name: 'Doppel-Bull', desc: 'Triff in einer Aufnahme zwei Bullseyes.', check: (c) => c.match && c.match.twoBull === true },
  { id: 'three-bull', cat: 'Checkout', name: 'Drei Bulls', desc: 'Triff in einer Aufnahme drei Bullseyes (150).', check: (c) => c.match && c.match.threeBull === true },
  { id: 'two-t19', cat: 'Scoring', name: 'Doppel-Triple 19', desc: 'Triff in einer Aufnahme zweimal das Triple 19.', check: (c) => c.match && c.match.twoT19 === true },
  { id: 'match-avg-90', cat: 'Scoring', name: 'Konstante 90', desc: 'Beende ein Match mit einem Average von 90+.', check: (c) => c.match && n(c.match.average) >= 90 },
  { id: 'hit-t20-200', cat: 'Scoring', name: 'Triple-20-Meister', desc: 'Triff insgesamt 200 mal das Triple 20.', check: (c) => n(c.agg.sectors && c.agg.sectors['T20']) >= 200 },

  // --- Triple-Out (nur im Master-Out) ---
  { id: 'triple-out', cat: 'Checkout', name: 'Triple-Finish', desc: 'Beende ein Leg auf einem Triple (im Master-Out moeglich).', check: (c) => c.match && c.match.tripleFinish === true },
  { id: 'triple-out-3', cat: 'Checkout', name: 'Triple-Serie', desc: 'Erziele drei Triple-Finishes in einem Match.', check: (c) => c.match && n(c.match.tripleFinishCount) >= 3 },
  { id: 'co-140', cat: 'Checkout', name: 'Ton-40-Finish', desc: 'Checke 140 oder mehr Punkte auf einmal.', check: (c) => n(c.agg.maxCheckout) >= 140 },
  { id: 'co-150', cat: 'Checkout', name: 'High-Finish 150', desc: 'Checke 150 oder mehr Punkte auf einmal.', check: (c) => n(c.agg.maxCheckout) >= 150 },
  { id: 'hit-bull-100', cat: 'Checkout', name: 'Bull-Meister', desc: 'Triff insgesamt 100 mal das Bullseye.', check: (c) => n(c.agg.sectors && c.agg.sectors['D25']) >= 100 },

  // --- Weitere Meilensteine/Siege ---
  { id: 'win-25', cat: 'Siege', name: 'Gewinner', desc: 'Gewinne 25 Spiele.', check: (c) => n(c.agg.wins) >= 25 },
  { id: 'win-streak-5', cat: 'Siege', name: 'Heisser Lauf', desc: 'Gewinne 5 Spiele in Folge.', check: (c) => n(c.agg.winStreak) >= 5 },
  { id: 'legs-500', cat: 'Meilensteine', name: 'Leg-Sammler', desc: 'Gewinne insgesamt 500 Legs.', check: (c) => n(c.agg.legsWon) >= 500 },
  { id: 'darts-100k', cat: 'Meilensteine', name: 'Dart-Marathon', desc: 'Wirf insgesamt 100.000 Darts.', check: (c) => n(c.agg.dartsTotal) >= 100000 },

  // --- Stufe: 20 weitere kuriose Achievements ---
  { id: 'friday-13', cat: 'Kurios', name: 'Freitag der 13.', desc: 'Spiele an einem Freitag, den 13.', check: (c) => c.now && c.now.getDay() === 5 && c.now.getDate() === 13 },
  { id: 'new-year', cat: 'Kurios', name: 'Neujahrsstart', desc: 'Spiele am 1. Januar.', check: (c) => c.now && c.now.getMonth() === 0 && c.now.getDate() === 1 },
  { id: 'xmas', cat: 'Kurios', name: 'Weihnachtsdart', desc: 'Spiele am 24. Dezember.', check: (c) => c.now && c.now.getMonth() === 11 && c.now.getDate() === 24 },
  { id: 'silvester', cat: 'Kurios', name: 'Silvester-Darts', desc: 'Spiele am 31. Dezember.', check: (c) => c.now && c.now.getMonth() === 11 && c.now.getDate() === 31 },
  { id: 'nikolaus', cat: 'Kurios', name: 'Nikolaus-Darts', desc: 'Spiele am 6. Dezember.', check: (c) => c.now && c.now.getMonth() === 11 && c.now.getDate() === 6 },
  { id: 'halloween', cat: 'Kurios', name: 'Gruseldart', desc: 'Spiele an Halloween (31. Oktober).', check: (c) => c.now && c.now.getMonth() === 9 && c.now.getDate() === 31 },
  { id: 'valentine', cat: 'Kurios', name: 'Verliebte Pfeile', desc: 'Spiele am Valentinstag (14. Februar).', check: (c) => c.now && c.now.getMonth() === 1 && c.now.getDate() === 14 },
  { id: 'st-patrick', cat: 'Kurios', name: 'Gruener Pfeil', desc: 'Spiele am St. Patricks Day (17. Maerz).', check: (c) => c.now && c.now.getMonth() === 2 && c.now.getDate() === 17 },
  { id: 'april-fools', cat: 'Kurios', name: 'Aprilscherz', desc: 'Spiele am 1. April.', check: (c) => c.now && c.now.getMonth() === 3 && c.now.getDate() === 1 },
  { id: 'leap-day', cat: 'Kurios', name: 'Schalttag', desc: 'Spiele am 29. Februar.', check: (c) => c.now && c.now.getMonth() === 1 && c.now.getDate() === 29 },
  { id: 'lunch-darts', cat: 'Kurios', name: 'Mittagsdart', desc: 'Beende ein Spiel zwischen 12 und 13 Uhr.', check: (c) => c.now && c.now.getHours() === 12 },
  { id: 'afternoon', cat: 'Kurios', name: 'Nachmittagsrunde', desc: 'Beende ein Spiel am Nachmittag (14-16 Uhr).', check: (c) => c.now && c.now.getHours() >= 14 && c.now.getHours() <= 16 },
  { id: 'monday-motivation', cat: 'Kurios', name: 'Montags-Motivation', desc: 'Spiele an einem Montag.', check: (c) => c.now && c.now.getDay() === 1 },
  { id: 'oktoberfest', cat: 'Kurios', name: 'Wiesn-Darts', desc: 'Spiele im Oktober.', check: (c) => c.now && c.now.getMonth() === 9 },
  { id: 'summer-darts', cat: 'Kurios', name: 'Sommerpfeil', desc: 'Spiele im Sommer (Juni-August).', check: (c) => c.now && c.now.getMonth() >= 5 && c.now.getMonth() <= 7 },
  { id: 'witching-hour', cat: 'Kurios', name: 'Geisterstunde', desc: 'Beende ein Spiel zwischen 0 und 1 Uhr.', check: (c) => c.now && c.now.getHours() === 0 },
  { id: 'exact-ton', cat: 'Kurios', name: 'Sauberer Ton', desc: 'Wirf eine Aufnahme von genau 100.', check: (c) => c.match && c.match.exactTon === true },
  { id: 'sixty-nine', cat: 'Kurios', name: 'Die 69', desc: 'Wirf eine Aufnahme von genau 69.', check: (c) => c.match && c.match.sixtyNine === true },
  { id: 'three-doubles', cat: 'Kurios', name: 'Doppel-Trio', desc: 'Triff in einer Aufnahme drei Doppel.', check: (c) => c.match && c.match.threeDoubles === true },
  { id: 'three-triples', cat: 'Kurios', name: 'Triple-Trio', desc: 'Triff in einer Aufnahme drei Triple.', check: (c) => c.match && c.match.threeTriples === true },

  // --- Aufgabe (Spieler gibt auf) ---
  { id: 'surrender-give', cat: 'Kurios', name: 'Weisse Flagge', desc: 'Gib ein Spiel auf.', check: (c) => c.match && c.match.surrenderedByMe === true },
  { id: 'surrender-win', cat: 'Siege', name: 'Kampflos', desc: 'Gewinne, weil der Gegner aufgibt.', check: (c) => c.match && c.match.wonBySurrender === true },
  { id: 'surrender-leading', cat: 'Kurios', name: 'Vorzeitiger Rueckzug', desc: 'Gib auf, obwohl du in Fuehrung lagst (weniger Rest als der Gegner).', check: (c) => c.match && c.match.surrenderedWhileLeading === true },
  { id: 'surrender-early', cat: 'Kurios', name: 'Handtuch geworfen', desc: 'Gib schon in der ersten Runde auf.', check: (c) => c.match && c.match.surrenderedEarly === true },
  { id: 'surrender-near', cat: 'Kurios', name: 'Kurz vorm Ziel gekniffen', desc: 'Gib mit 40 oder weniger Rest auf.', check: (c) => c.match && c.match.surrenderedNearFinish === true },

  // --- Stufe 7: Ranglisten & Elo ---
  { id: 'elo-1100', cat: 'Meilensteine', name: 'Aufsteiger', desc: 'Erreiche ein Elo-Rating von 1100.', check: (c) => n(c.elo) >= 1100 },
  { id: 'elo-1250', cat: 'Meilensteine', name: 'Ranglisten-Ass', desc: 'Erreiche ein Elo-Rating von 1250.', check: (c) => n(c.elo) >= 1250 },
  { id: 'ranked-10', cat: 'Meilensteine', name: 'Ranglisten-Stammgast', desc: 'Bestreite 10 gewertete Ranglisten-Spiele.', check: (c) => n(c.rankedGames) >= 10 },

  // --- Party (Stufe 4) ---
  { id: 'party-first', cat: 'Party', name: 'Partygast', desc: 'Spiele deinen ersten Party-Modus.', check: (c) => !!c.match && (!!c.match.partyMode || n(c.match.mode) >= 601) },
  { id: 'party-601', cat: 'Party', name: 'Sechshunderter', desc: 'Gewinne ein 601er-Spiel.', check: (c) => !!c.match && c.match.won && n(c.match.mode) === 601 },
  { id: 'party-701', cat: 'Party', name: 'Siebenhunderter', desc: 'Gewinne ein 701er-Spiel.', check: (c) => !!c.match && c.match.won && n(c.match.mode) === 701 },
  { id: 'party-hi-play', cat: 'Party', name: 'Langstrecke', desc: 'Spiele ein 601er- oder 701er-Spiel.', check: (c) => !!c.match && (n(c.match.mode) === 601 || n(c.match.mode) === 701) },
  { id: 'gotcha-play', cat: 'Party', name: 'Zielübung', desc: 'Spiele eine Runde Gotcha.', check: (c) => !!c.match && c.match.partyMode === 'gotcha' },
  { id: 'gotcha-win', cat: 'Party', name: 'Gotcha!', desc: 'Gewinne ein Gotcha-Spiel (Zielzahl punktgenau getroffen).', check: (c) => !!c.match && c.match.won && c.match.partyMode === 'gotcha' },
  { id: 'killer-play', cat: 'Party', name: 'Auf die Jagd', desc: 'Spiele eine Runde Killer.', check: (c) => !!c.match && c.match.partyMode === 'killer' },
  { id: 'killer-win', cat: 'Party', name: 'Last Man Standing', desc: 'Gewinne ein Killer-Spiel.', check: (c) => !!c.match && c.match.won && c.match.partyMode === 'killer' },
  { id: 'killer-armed', cat: 'Party', name: 'Scharf geschaltet', desc: 'Schalte im Killer dein eigenes Feld scharf.', check: (c) => !!c.match && c.match.killerArmed === true },
  { id: 'baseball-play', cat: 'Party', name: 'Play Ball', desc: 'Spiele eine Runde Baseball.', check: (c) => !!c.match && c.match.partyMode === 'baseball' },
  { id: 'baseball-win', cat: 'Party', name: 'Homerun-König', desc: 'Gewinne ein Baseball-Spiel.', check: (c) => !!c.match && c.match.won && c.match.partyMode === 'baseball' },
  { id: 'baseball-slam', cat: 'Party', name: 'Grand Slam', desc: 'Triff in einem Baseball-Inning das Triple des Ziels.', check: (c) => !!c.match && c.match.baseballSlam === true },
  { id: 'golf-play', cat: 'Party', name: 'Abschlag', desc: 'Spiele eine Runde Golf.', check: (c) => !!c.match && c.match.partyMode === 'golf' },
  { id: 'golf-win', cat: 'Party', name: 'Grünes Jackett', desc: 'Gewinne ein Golf-Spiel.', check: (c) => !!c.match && c.match.won && c.match.partyMode === 'golf' },
  { id: 'golf-birdie', cat: 'Party', name: 'Birdie', desc: 'Schließe beim Golf ein Loch mit nur einem Dart.', check: (c) => !!c.match && c.match.golfBirdie === true },
  { id: 'party-shanghai-win', cat: 'Party', name: 'Shanghai-Champion', desc: 'Gewinne ein Shanghai-Wettkampfmatch.', check: (c) => !!c.match && c.match.won && c.match.partyMode === 'shanghai' },
  { id: 'party-clock-win', cat: 'Party', name: 'Uhrwerk-Sieger', desc: 'Gewinne einen Around-the-Clock-Wettkampf.', check: (c) => !!c.match && c.match.won && c.match.partyMode === 'clock' },
  { id: 'party-halveit-win', cat: 'Party', name: 'Nervenstark', desc: 'Gewinne ein Halve-it-Match.', check: (c) => !!c.match && c.match.won && c.match.partyMode === 'halveit' },

  // --- Stufe: 25 neue Achievements (breit gestreut + Trost) ---
  { id: 'loss-first3', cat: 'Trost', name: 'Aller Anfang ist schwer', desc: 'Verliere deine ersten 3 Spiele.', check: (c) => n(c.agg.games) >= 3 && n(c.agg.wins) === 0 },
  { id: 'loss-streak-5', cat: 'Trost', name: 'Pechsträhne', desc: 'Verliere 5 Spiele in Folge.', check: (c) => n(c.agg.lossStreak) >= 5 },
  { id: 'loss-50', cat: 'Trost', name: 'Immerhin dabei', desc: 'Sammle insgesamt 50 Niederlagen.', check: (c) => n(c.agg.losses) >= 50 },
  { id: 'phoenix', cat: 'Trost', name: 'Phönix aus der Asche', desc: 'Gewinne direkt nach 5 Niederlagen in Folge.', check: (c) => c.agg.brokeLoss5 === true },
  { id: 'high-avg-loss', cat: 'Trost', name: 'Unglücklich verloren', desc: 'Verliere ein Match trotz 90+ eigenem Average.', check: (c) => c.match && c.match.highAvgLoss === true },
  { id: 'overkill', cat: 'Trost', name: 'Overkill', desc: 'Überwirf 4-mal in einem einzigen Spiel.', check: (c) => c.match && n(c.match.bustsInGame) >= 4 },
  { id: 'whitewash-received', cat: 'Trost', name: 'Ehrenrunde', desc: 'Kassiere einen Whitewash (0 gewonnene Legs, min. 2 abgegeben).', check: (c) => c.match && c.match.whitewashReceived === true },

  { id: 'tons-in-row', cat: 'Scoring', name: 'Ton-Ton-Ton', desc: 'Wirf in einem Match drei 100+-Aufnahmen in Folge.', check: (c) => c.match && c.match.tonsInRow === true },
  { id: 'hit-t20-250', cat: 'Scoring', name: 'Sniper-Serie', desc: 'Triff insgesamt 250-mal das Triple 20.', check: (c) => n(c.agg.sectors && c.agg.sectors['T20']) >= 250 },
  { id: 'big-fish-3', cat: 'Scoring', name: 'Weißer Hai', desc: 'Checke 3-mal 170 oder mehr (High Finish).', check: (c) => n(c.agg.bigFishCount) >= 3 },
  { id: 'avg90-streak-5', cat: 'Scoring', name: 'Weltklasse-Serie', desc: 'Spiele 5 Matches in Folge mit 90+ Average.', check: (c) => n(c.agg.avg90Streak) >= 5 },

  { id: 'double-dom', cat: 'Checkout', name: 'Doppel-Dominator', desc: 'Erreiche 50 %+ Doppelquote in einem Match (min. 8 Versuche).', check: (c) => c.match && n(c.match.matchDoubleRate) >= 0.5 },
  { id: 'bull-250', cat: 'Checkout', name: 'Bull-Titan', desc: 'Triff insgesamt 250-mal das Bullseye.', check: (c) => n(c.agg.sectors && c.agg.sectors['D25']) >= 250 },
  { id: 'checkout-500', cat: 'Checkout', name: 'Checkout-König', desc: 'Beende insgesamt 500 Legs per Checkout.', check: (c) => n(c.agg.checkoutsTotal) >= 500 },

  { id: 'games-2500', cat: 'Meilensteine', name: 'Dart-Ikone', desc: 'Spiele 2.500 Spiele.', check: (c) => n(c.agg.games) >= 2500 },
  { id: 'darts-250k', cat: 'Meilensteine', name: 'Wurf-Titan', desc: 'Wirf insgesamt 250.000 Darts.', check: (c) => n(c.agg.dartsTotal) >= 250000 },
  { id: 'elo-1400', cat: 'Meilensteine', name: 'Elo-Elite', desc: 'Erreiche ein Elo-Rating von 1400.', check: (c) => n(c.elo) >= 1400 },
  { id: 'ranked-100', cat: 'Meilensteine', name: 'Ranglisten-Veteran', desc: 'Bestreite 100 gewertete Ranglisten-Spiele.', check: (c) => n(c.rankedGames) >= 100 },

  { id: 'party-25', cat: 'Party', name: 'Partylöwe', desc: 'Spiele 25 Party-Spiele.', check: (c) => n(c.partyGames) >= 25 },
  { id: 'golf-underpar', cat: 'Party', name: 'Unter Par', desc: 'Beende ein Golf-Spiel mit 30 Schlägen oder weniger.', check: (c) => c.match && c.match.golfUnderPar === true },
  { id: 'clock-blitz', cat: 'Party', name: 'Uhrwerk-Blitz', desc: 'Gewinne Around the Clock, bevor ein Gegner die 10 erreicht.', check: (c) => c.match && c.match.clockBlitz === true },
  { id: 'baseball-40', cat: 'Party', name: 'Grand-Slam-König', desc: 'Erziele 40+ Runs in einem Baseball-Spiel.', check: (c) => c.match && c.match.baseballBig === true },

  { id: 'team-comeback', cat: 'Team', name: 'Team-Aufholjagd', desc: 'Gewinne ein Doppel-Match aus 2 Legs Rückstand.', check: (c) => c.match && c.match.isTeam && c.match.teamWin && n(c.match.comebackDeficit) >= 2 },
  { id: 'team-tourney-match', cat: 'Team', name: 'Doppel im Turnier', desc: 'Gewinne ein Doppel-Match in einem Turnier.', check: (c) => c.match && c.match.isTeam && c.match.teamWin && c.match.inTournament === true },

  { id: 'aufholjagd', cat: 'Kurios', name: 'Aufholjagd', desc: 'Gewinne ein Match, in dem du 2 Legs zurücklagst.', check: (c) => c.match && c.match.won && n(c.match.comebackDeficit) >= 2 },
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// Fortschritt für kumulative/messbare Achievements: liefert je ID {cur, target}.
// Nur für Achievements sinnvoll, deren Ziel über einen Zählwert läuft; rein
// ereignisbasierte (Comeback, Whitewash, 9-Darter …) haben keinen Fortschritt.
const sec = (c, k) => n(c.agg.sectors && c.agg.sectors[k]);
const ALLROUND_MODES = ['clock', 'bob27', 'countup', 'cricket', 'shanghai', 'halveit', 'checkout'];
const PROGRESS = {
  'win-1': (c) => ({ cur: n(c.agg.wins), target: 1 }),
  'win-10': (c) => ({ cur: n(c.agg.wins), target: 10 }),
  'win-50': (c) => ({ cur: n(c.agg.wins), target: 50 }),
  'win-100': (c) => ({ cur: n(c.agg.wins), target: 100 }),
  'win-streak-3': (c) => ({ cur: n(c.agg.winStreak), target: 3 }),
  'max-180-1': (c) => ({ cur: n(c.agg.s180), target: 1 }),
  'max-180-10': (c) => ({ cur: n(c.agg.s180), target: 10 }),
  'max-180-50': (c) => ({ cur: n(c.agg.s180), target: 50 }),
  'max-180-100': (c) => ({ cur: n(c.agg.s180), target: 100 }),
  'turn-100': (c) => ({ cur: n(c.agg.maxTurn), target: 100 }),
  'turn-140': (c) => ({ cur: n(c.agg.maxTurn), target: 140 }),
  'hit-t20': (c) => ({ cur: sec(c, 'T20'), target: 1 }),
  'hit-t20-50': (c) => ({ cur: sec(c, 'T20'), target: 50 }),
  'first-double': (c) => ({ cur: n(c.agg.doubleHits), target: 1 }),
  'hit-bull': (c) => ({ cur: sec(c, 'D25'), target: 1 }),
  'hit-bull-25': (c) => ({ cur: sec(c, 'D25'), target: 25 }),
  'co-100': (c) => ({ cur: n(c.agg.maxCheckout), target: 100 }),
  'co-120': (c) => ({ cur: n(c.agg.maxCheckout), target: 120 }),
  'co-big-fish': (c) => ({ cur: n(c.agg.maxCheckout), target: 170 }),
  'games-1': (c) => ({ cur: n(c.agg.games), target: 1 }),
  'games-10': (c) => ({ cur: n(c.agg.games), target: 10 }),
  'games-50': (c) => ({ cur: n(c.agg.games), target: 50 }),
  'games-100': (c) => ({ cur: n(c.agg.games), target: 100 }),
  'games-500': (c) => ({ cur: n(c.agg.games), target: 500 }),
  'games-1000': (c) => ({ cur: n(c.agg.games), target: 1000 }),
  'legs-50': (c) => ({ cur: n(c.agg.legsWon), target: 50 }),
  'legs-250': (c) => ({ cur: n(c.agg.legsWon), target: 250 }),
  'legs-1000': (c) => ({ cur: n(c.agg.legsWon), target: 1000 }),
  'darts-10k': (c) => ({ cur: n(c.agg.dartsTotal), target: 10000 }),
  'darts-50k': (c) => ({ cur: n(c.agg.dartsTotal), target: 50000 }),
  'play-streak-7': (c) => ({ cur: n(c.playStreak), target: 7 }),
  'train-1': (c) => ({ cur: trainSessions(c.training), target: 1 }),
  'train-25': (c) => ({ cur: trainSessions(c.training), target: 25 }),
  'train-100': (c) => ({ cur: trainSessions(c.training), target: 100 }),
  'train-streak-7': (c) => ({ cur: n(c.trainStreak), target: 7 }),
  'allrounder': (c) => ({ cur: ALLROUND_MODES.filter((m) => c.training && c.training[m] && c.training[m].sessions > 0).length, target: 7 }),
  'hit-t20-200': (c) => ({ cur: sec(c, 'T20'), target: 200 }),
  'hit-bull-100': (c) => ({ cur: sec(c, 'D25'), target: 100 }),
  'co-140': (c) => ({ cur: n(c.agg.maxCheckout), target: 140 }),
  'co-150': (c) => ({ cur: n(c.agg.maxCheckout), target: 150 }),
  'win-25': (c) => ({ cur: n(c.agg.wins), target: 25 }),
  'win-streak-5': (c) => ({ cur: n(c.agg.winStreak), target: 5 }),
  'legs-500': (c) => ({ cur: n(c.agg.legsWon), target: 500 }),
  'darts-100k': (c) => ({ cur: n(c.agg.dartsTotal), target: 100000 }),
  'elo-1100': (c) => ({ cur: n(c.elo), target: 1100 }),
  'elo-1250': (c) => ({ cur: n(c.elo), target: 1250 }),
  'ranked-10': (c) => ({ cur: n(c.rankedGames), target: 10 }),
  'loss-streak-5': (c) => ({ cur: n(c.agg.lossStreak), target: 5 }),
  'loss-50': (c) => ({ cur: n(c.agg.losses), target: 50 }),
  'hit-t20-250': (c) => ({ cur: sec(c, 'T20'), target: 250 }),
  'big-fish-3': (c) => ({ cur: n(c.agg.bigFishCount), target: 3 }),
  'avg90-streak-5': (c) => ({ cur: n(c.agg.avg90Streak), target: 5 }),
  'bull-250': (c) => ({ cur: sec(c, 'D25'), target: 250 }),
  'checkout-500': (c) => ({ cur: n(c.agg.checkoutsTotal), target: 500 }),
  'games-2500': (c) => ({ cur: n(c.agg.games), target: 2500 }),
  'darts-250k': (c) => ({ cur: n(c.agg.dartsTotal), target: 250000 }),
  'elo-1400': (c) => ({ cur: n(c.elo), target: 1400 }),
  'ranked-100': (c) => ({ cur: n(c.rankedGames), target: 100 }),
  'party-25': (c) => ({ cur: n(c.partyGames), target: 25 }),
};

// Fortschritt für alle messbaren Achievements berechnen. cur wird auf target
// gedeckelt; pct in Prozent.
function progressFor(ctx) {
  const out = {};
  for (const [id, fn] of Object.entries(PROGRESS)) {
    try {
      const r = fn(ctx);
      if (r && r.target > 0) {
        const cur = Math.max(0, Math.min(r.cur, r.target));
        out[id] = { cur, target: r.target, pct: Math.round((cur / r.target) * 100) };
      }
    } catch {
      /* defensiv ignorieren */
    }
  }
  return out;
}

const EN = {"win-1": ["First Win", "Win your first game."], "win-10": ["Routined", "Win 10 games."], "win-50": ["Frequent Winner", "Win 50 games."], "win-100": ["Champion", "Win 100 games."], "whitewash": ["Whitewash", "Win a match (min. 2 legs) without conceding a single leg."], "turn-100": ["Ton", "Score a visit of 100 or more."], "turn-140": ["Ton-40", "Score a visit of 140 or more."], "max-180-1": ["Maximum!", "Throw your first 180."], "max-180-10": ["180 Collector", "Throw a total of 10 maximums."], "max-180-50": ["180 Machine", "Throw a total of 50 maximums."], "max-180-100": ["180 Legend", "Throw a total of 100 maximums."], "three-180-match": ["Triple Maximum", "Throw three 180s in a single match."], "match-avg-60": ["Solid Run", "Finish a match with a 60+ average."], "match-avg-80": ["Sharpshooter", "Finish a match with an 80+ average."], "match-avg-100": ["Ton Average", "Finish a match with a 100+ average."], "co-100": ["High Finish", "Check out 100 or more in one visit."], "co-120": ["Ton-20 Finish", "Check out 120 or more in one visit."], "co-big-fish": ["Big Fish", "The big one: check out 170 (T20-T20-Bull)."], "nine-darter": ["Nine Darter", "Win a 501 leg with just 9 darts."], "double-master": ["Double Master", "Reach a 40%+ double rate (min. 20 double attempts)."], "games-1": ["Welcome", "Play your first game."], "games-10": ["Settled In", "Play 10 games."], "games-50": ["Regular", "Play 50 games."], "games-100": ["Darts Addict", "Play 100 games."], "legs-50": ["Leg Hunter", "Win 50 legs in total."], "legs-250": ["Leg Factory", "Win 250 legs in total."], "train-1": ["Training Kickoff", "Complete your first training session."], "train-25": ["Diligent", "Complete 25 training sessions."], "train-100": ["Training World Champion", "Complete 100 training sessions."], "allrounder": ["All-Rounder", "Play each of the 7 training modes at least once."], "bob27-50": ["Bob Cracked", "Reach 50+ points in Bob’s 27."], "bob27-100": ["Double Guru", "Reach 100+ points in Bob’s 27."], "countup-400": ["Count-up Cannon", "Reach 400+ points in Count-up."], "countup-500": ["Count-up King", "Reach 500+ points in Count-up."], "countup-180": ["180 in Training", "Throw a 180 in Count-up training."], "clock-40": ["Clockwork", "Finish Around the Clock in 40 darts or fewer."], "clock-25": ["Clock Master", "Finish Around the Clock in 25 darts or fewer."], "cricket-30": ["Cricket Ace", "Close Cricket in 30 darts or fewer."], "shanghai-hit": ["Shanghai!", "Hit a Shanghai (single, double and triple of a number) in Shanghai training."], "halveit-200": ["Consistency", "Reach 200+ points in Halve-it."], "co-challenge-1": ["Finisher", "Master the checkout challenge (at least 1 checkout)."], "co-challenge-5": ["Double Sniper", "Land 5 checkouts in the checkout challenge."], "hit-t20": ["Triple 20", "Hit a Triple 20."], "hit-t20-50": ["Treble Collector", "Hit 50 Triple 20s in total."], "first-double": ["First Double", "Hit your first checkout double."], "hit-bull": ["Bullseye", "Hit the bullseye (double bull, 50)."], "hit-bull-25": ["Bull Hunter", "Hit 25 bullseyes in total."], "win-streak-3": ["On a Roll", "Win 3 games in a row."], "lowton-501": ["Efficient", "Win a 501 leg in 15 darts or fewer."], "darts-10k": ["Prolific Thrower", "Throw 10,000 darts in total."], "early-bird": ["Early Bird", "Finish a game between 5 and 8 a.m."], "night-owl": ["Night Owl", "Finish a game between midnight and 5 a.m."], "bull-finish": ["Bull Finish", "Check out a leg right on the bullseye."], "clean-set": ["Clean Set", "Win a set without conceding a leg."], "comeback": ["Comeback", "Win a match in which an opponent already had match darts."], "co-streak-5": ["Double Streak", "Win 5 legs in a row by checkout."], "shanghai-live": ["Shanghai", "Hit single, double and triple of the same number in one visit."], "team-win": ["Doubles Win", "Win a doubles/team match."], "team-whitewash": ["Team Whitewash", "Win a match as a team (min. 2 legs) without conceding a leg."], "team-180-leg": ["Joint 180 Leg", "Both partners each throw a 180 in the same leg."], "team-partner-co": ["Partner Checkout", "Both partners contribute to a leg won by checkout."], "games-500": ["Darts Enthusiast", "Play 500 games."], "games-1000": ["Darts Veteran", "Play 1,000 games."], "legs-1000": ["Leg Legend", "Win 1,000 legs in total."], "darts-50k": ["Marathon Thrower", "Throw 50,000 darts in total."], "play-streak-7": ["Daily Darts", "Play on 7 consecutive days."], "match-avg-110": ["World-Class Average", "Finish a match with a 110+ average."], "match-avg-120": ["Dream Average", "Finish a match with a 120+ average."], "high-roller": ["High Roller", "Throw three 140+ visits in one match."], "two-180-row": ["Back-to-back 180", "Throw two 180s in a row."], "bull-bull": ["Bull-Bull Finish", "Check out a leg with two bulls in one visit."], "madhouse": ["Madhouse", "Finish on double 1 (from 2)."], "clutch-finish": ["Clutch Finish", "Win a match with a 100+ checkout."], "bed-breakfast": ["Bed & Breakfast", "Score exactly 26 in one visit."], "three-in-bed": ["Three in a Bed", "Hit the same number three times in one visit."], "nuller": ["Zero Visit", "Throw a visit worth 0 points (three misses)."], "weekend-warrior": ["Weekend Warrior", "Finish a game on a Saturday or Sunday."], "birthday-game": ["Birthday Game", "Play on your birthday (profile birth date)."], "clock-20": ["Clock Pro", "Finish Around the Clock in 20 darts or fewer."], "bob27-150": ["Bob Mastery", "Reach 150+ points in Bob’s 27."], "builder-goal": ["Custom Trainer", "Play a self-made exercise from the training builder."], "train-streak-7": ["Training Week", "Train on 7 consecutive days."], "team-partner-co-3": ["In Sync", "Land three partner checkouts in one doubles match."], "two-t20": ["Double Treble 20", "Hit two treble 20s in a single visit."], "two-bull": ["Double Bull", "Hit two bullseyes in a single visit."], "three-bull": ["Three Bulls", "Hit three bullseyes in a single visit (150)."], "two-t19": ["Double Treble 19", "Hit two treble 19s in a single visit."], "match-avg-90": ["Steady 90", "Finish a match with a 90+ average."], "hit-t20-200": ["Treble 20 Master", "Hit 200 treble 20s in total."], "triple-out": ["Triple Finish", "Finish a leg on a treble (possible in master out)."], "triple-out-3": ["Triple Streak", "Land three triple finishes in one match."], "co-140": ["Ton-40 Finish", "Check out 140 or more in one visit."], "co-150": ["High Finish 150", "Check out 150 or more in one visit."], "hit-bull-100": ["Bull Master", "Hit 100 bullseyes in total."], "win-25": ["Winner", "Win 25 games."], "win-streak-5": ["Hot Streak", "Win 5 games in a row."], "legs-500": ["Leg Collector", "Win 500 legs in total."], "darts-100k": ["Dart Marathon", "Throw 100,000 darts in total."], "friday-13": ["Friday the 13th", "Play on Friday the 13th."], "new-year": ["New Year Kickoff", "Play on January 1st."], "xmas": ["Christmas Darts", "Play on December 24th."], "silvester": ["New Year's Eve", "Play on December 31st."], "nikolaus": ["St. Nicholas Darts", "Play on December 6th."], "halloween": ["Spooky Darts", "Play on Halloween (October 31st)."], "valentine": ["Darts in Love", "Play on Valentine's Day (February 14th)."], "st-patrick": ["Green Dart", "Play on St. Patrick's Day (March 17th)."], "april-fools": ["April Fools", "Play on April 1st."], "leap-day": ["Leap Day", "Play on February 29th."], "lunch-darts": ["Lunch Darts", "Finish a game between 12 and 1 p.m."], "afternoon": ["Afternoon Session", "Finish a game in the afternoon (2-4 p.m.)."], "monday-motivation": ["Monday Motivation", "Play on a Monday."], "oktoberfest": ["Oktoberfest Darts", "Play in October."], "summer-darts": ["Summer Dart", "Play in summer (June-August)."], "witching-hour": ["Witching Hour", "Finish a game between midnight and 1 a.m."], "exact-ton": ["Clean Ton", "Score exactly 100 in one visit."], "sixty-nine": ["The 69", "Score exactly 69 in one visit."], "three-doubles": ["Double Trio", "Hit three doubles in one visit."], "three-triples": ["Triple Trio", "Hit three triples in one visit."], "surrender-give": ["White Flag", "Surrender a game."], "surrender-win": ["Walkover", "Win because the opponent surrenders."], "surrender-leading": ["Premature Retreat", "Surrender while leading (fewer points left than the opponent)."], "surrender-early": ["Towel Thrown", "Surrender in the very first round."], "surrender-near": ["Bottled It", "Surrender with 40 or fewer left."], "elo-1100": ["On the Rise", "Reach an Elo rating of 1100."], "elo-1250": ["Ranking Ace", "Reach an Elo rating of 1250."], "ranked-10": ["Ranked Regular", "Play 10 rated ranking games."], "party-first": ["Party Guest", "Play your first party mode."], "party-601": ["Six Hundred", "Win a 601 game."], "party-701": ["Seven Hundred", "Win a 701 game."], "party-hi-play": ["Long Haul", "Play a 601 or 701 game."], "gotcha-play": ["Target Practice", "Play a round of Gotcha."], "gotcha-win": ["Gotcha!", "Win a Gotcha game (hit the target exactly)."], "killer-play": ["On the Hunt", "Play a round of Killer."], "killer-win": ["Last Man Standing", "Win a Killer game."], "killer-armed": ["Armed", "Arm your own number in Killer."], "baseball-play": ["Play Ball", "Play a round of Baseball."], "baseball-win": ["Home Run King", "Win a Baseball game."], "baseball-slam": ["Grand Slam", "Hit the treble of the target in a Baseball inning."], "golf-play": ["Tee Off", "Play a round of Golf."], "golf-win": ["Green Jacket", "Win a Golf game."], "golf-birdie": ["Birdie", "Close a golf hole with a single dart."], "party-shanghai-win": ["Shanghai Champion", "Win a Shanghai match."], "party-clock-win": ["Clockwork Winner", "Win an Around the Clock contest."], "party-halveit-win": ["Steady Nerves", "Win a Halve-it match."], "loss-first3": ["Rough Start", "Lose your first 3 games."], "loss-streak-5": ["Bad Luck Streak", "Lose 5 games in a row."], "loss-50": ["Still Here", "Rack up 50 losses in total."], "phoenix": ["Phoenix", "Win right after 5 losses in a row."], "high-avg-loss": ["Unlucky Loss", "Lose a match despite a 90+ average."], "overkill": ["Overkill", "Bust 4 times in a single game."], "whitewash-received": ["Lap of Honour", "Get whitewashed (0 legs won, at least 2 conceded)."], "tons-in-row": ["Ton-Ton-Ton", "Throw three 100+ visits in a row in one match."], "hit-t20-250": ["Sniper Streak", "Hit 250 treble 20s in total."], "big-fish-3": ["Great White", "Check out 170+ three times."], "avg90-streak-5": ["World-Class Streak", "Play 5 matches in a row with a 90+ average."], "double-dom": ["Double Dominator", "Reach a 50%+ double rate in a match (min. 8 attempts)."], "bull-250": ["Bull Titan", "Hit 250 bullseyes in total."], "checkout-500": ["Checkout King", "Win 500 legs by checkout in total."], "games-2500": ["Darts Icon", "Play 2,500 games."], "darts-250k": ["Throw Titan", "Throw 250,000 darts in total."], "elo-1400": ["Elo Elite", "Reach an Elo rating of 1400."], "ranked-100": ["Ranking Veteran", "Play 100 rated ranking games."], "party-25": ["Life of the Party", "Play 25 party games."], "golf-underpar": ["Under Par", "Finish a golf game in 30 strokes or fewer."], "clock-blitz": ["Clockwork Blitz", "Win Around the Clock before an opponent reaches 10."], "baseball-40": ["Grand Slam King", "Score 40+ runs in a baseball game."], "team-comeback": ["Team Comeback", "Win a doubles match from 2 legs down."], "team-tourney-match": ["Doubles in the Cup", "Win a doubles match in a tournament."], "aufholjagd": ["Comeback Trail", "Win a match in which you were 2 legs down."]};

const ICONS = {"win-1": "🥇", "win-10": "🏅", "win-50": "🏆", "win-100": "👑", "whitewash": "🧹", "turn-100": "💯", "turn-140": "🎯", "max-180-1": "💥", "max-180-10": "🔥", "max-180-50": "⚡", "max-180-100": "🌟", "three-180-match": "🚀", "match-avg-60": "📈", "match-avg-80": "🎯", "match-avg-100": "🏅", "co-100": "✅", "co-120": "🎯", "co-big-fish": "🐟", "nine-darter": "9️⃣", "double-master": "🎯", "games-1": "👋", "games-10": "🙂", "games-50": "📅", "games-100": "🤩", "legs-50": "🦵", "legs-250": "🏭", "train-1": "🏋️", "train-25": "💪", "train-100": "🥋", "allrounder": "🌈", "bob27-50": "🎯", "bob27-100": "🧙", "countup-400": "💣", "countup-500": "👑", "countup-180": "💥", "clock-40": "🕐", "clock-25": "⏱️", "cricket-30": "🦗", "shanghai-hit": "🏙️", "halveit-200": "⚖️", "co-challenge-1": "🎯", "co-challenge-5": "🔫", "hit-t20": "🎯", "hit-t20-50": "🔥", "first-double": "✅", "hit-bull": "🔴", "hit-bull-25": "🎯", "win-streak-3": "🔥", "lowton-501": "🧮", "darts-10k": "🎯", "early-bird": "🌅", "night-owl": "🦉", "bull-finish": "🎯", "clean-set": "🧹", "comeback": "🔄", "co-streak-5": "🎯", "shanghai-live": "🏙️", "team-win": "👥", "team-whitewash": "🧹", "team-180-leg": "💥", "team-partner-co": "🤝", "games-500": "📆", "games-1000": "🎖️", "legs-1000": "🦿", "darts-50k": "🎯", "play-streak-7": "📅", "match-avg-110": "📈", "match-avg-120": "🚀", "high-roller": "💰", "two-180-row": "🔥", "bull-bull": "🔴", "madhouse": "🏚️", "clutch-finish": "🧊", "bed-breakfast": "🍳", "three-in-bed": "🛏️", "nuller": "🫥", "weekend-warrior": "🗓️", "birthday-game": "🎂", "clock-20": "⏱️", "bob27-150": "🧙", "builder-goal": "🛠️", "train-streak-7": "🔥", "team-partner-co-3": "🤝", "two-t20": "🎯", "two-bull": "🔴", "three-bull": "🎯", "two-t19": "🎯", "match-avg-90": "📈", "hit-t20-200": "🔥", "triple-out": "✴️", "triple-out-3": "✴️", "co-140": "🎯", "co-150": "🐠", "hit-bull-100": "🔴", "win-25": "🏅", "win-streak-5": "🔥", "legs-500": "🦿", "darts-100k": "🎯", "friday-13": "\ud83d\udda4", "new-year": "\ud83c\udf89", "xmas": "\ud83c\udf84", "silvester": "\ud83c\udf86", "nikolaus": "\ud83c\udf85", "halloween": "\ud83c\udf83", "valentine": "\ud83d\udc98", "st-patrick": "\ud83c\udf40", "april-fools": "\ud83e\udd21", "leap-day": "\ud83d\udcc6", "lunch-darts": "\ud83c\udf7d\ufe0f", "afternoon": "\ud83c\udf24\ufe0f", "monday-motivation": "\ud83d\udcaa", "oktoberfest": "\ud83c\udf7a", "summer-darts": "\u2600\ufe0f", "witching-hour": "\ud83d\udc7b", "exact-ton": "\ud83d\udcaf", "sixty-nine": "\ud83d\ude0f", "three-doubles": "\ud83c\udfaf", "three-triples": "\ud83c\udfaf", "surrender-give": "🏳️", "surrender-win": "🚶", "surrender-leading": "🏳️", "surrender-early": "🧻", "surrender-near": "😰", "elo-1100": "📈", "elo-1250": "🎖️", "ranked-10": "🏅", "party-first": "🎉", "party-601": "6️⃣", "party-701": "7️⃣", "party-hi-play": "🏁", "gotcha-play": "🎯", "gotcha-win": "🥷", "killer-play": "🔪", "killer-win": "🏆", "killer-armed": "🔫", "baseball-play": "⚾", "baseball-win": "🥎", "baseball-slam": "💥", "golf-play": "⛳", "golf-win": "🏌️", "golf-birdie": "🐦", "party-shanghai-win": "🏙️", "party-clock-win": "🕐", "party-halveit-win": "✂️", "loss-first3": "🌱", "loss-streak-5": "🌧️", "loss-50": "🤝", "phoenix": "🔥", "high-avg-loss": "😤", "overkill": "💢", "whitewash-received": "🧻", "tons-in-row": "💯", "hit-t20-250": "🎯", "big-fish-3": "🦈", "avg90-streak-5": "📈", "double-dom": "🎯", "bull-250": "🔴", "checkout-500": "🏁", "games-2500": "🌟", "darts-250k": "🎯", "elo-1400": "👑", "ranked-100": "🎖️", "party-25": "🎉", "golf-underpar": "⛳", "clock-blitz": "⚡", "baseball-40": "⚾", "team-comeback": "🤝", "team-tourney-match": "🏆", "aufholjagd": "🚀"};

function catalog() {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    cat: a.cat,
    name: a.name,
    desc: a.desc,
    nameEn: (EN[a.id] || [])[0] || a.name,
    descEn: (EN[a.id] || [])[1] || a.desc,
    icon: ICONS[a.id] || '🎯',
  }));
}

// Prüft alle Achievements gegen den Kontext und liefert die erfüllten IDs.
function satisfiedIds(ctx) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    try {
      if (a.check(ctx)) out.push(a.id);
    } catch {
      /* defensiv ignorieren */
    }
  }
  return out;
}

module.exports = { ACHIEVEMENTS, byId, catalog, satisfiedIds, progressFor };
