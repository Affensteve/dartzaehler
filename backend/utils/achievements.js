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
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

const EN = {"win-1": ["First Win", "Win your first game."], "win-10": ["Routined", "Win 10 games."], "win-50": ["Frequent Winner", "Win 50 games."], "win-100": ["Champion", "Win 100 games."], "whitewash": ["Whitewash", "Win a match (min. 2 legs) without conceding a single leg."], "turn-100": ["Ton", "Score a visit of 100 or more."], "turn-140": ["Ton-40", "Score a visit of 140 or more."], "max-180-1": ["Maximum!", "Throw your first 180."], "max-180-10": ["180 Collector", "Throw a total of 10 maximums."], "max-180-50": ["180 Machine", "Throw a total of 50 maximums."], "max-180-100": ["180 Legend", "Throw a total of 100 maximums."], "three-180-match": ["Triple Maximum", "Throw three 180s in a single match."], "match-avg-60": ["Solid Run", "Finish a match with a 60+ average."], "match-avg-80": ["Sharpshooter", "Finish a match with an 80+ average."], "match-avg-100": ["Ton Average", "Finish a match with a 100+ average."], "co-100": ["High Finish", "Check out 100 or more in one visit."], "co-120": ["Ton-20 Finish", "Check out 120 or more in one visit."], "co-big-fish": ["Big Fish", "The big one: check out 170 (T20-T20-Bull)."], "nine-darter": ["Nine Darter", "Win a 501 leg with just 9 darts."], "double-master": ["Double Master", "Reach a 40%+ double rate (min. 20 double attempts)."], "games-1": ["Welcome", "Play your first game."], "games-10": ["Settled In", "Play 10 games."], "games-50": ["Regular", "Play 50 games."], "games-100": ["Darts Addict", "Play 100 games."], "legs-50": ["Leg Hunter", "Win 50 legs in total."], "legs-250": ["Leg Factory", "Win 250 legs in total."], "train-1": ["Training Kickoff", "Complete your first training session."], "train-25": ["Diligent", "Complete 25 training sessions."], "train-100": ["Training World Champion", "Complete 100 training sessions."], "allrounder": ["All-Rounder", "Play each of the 7 training modes at least once."], "bob27-50": ["Bob Cracked", "Reach 50+ points in Bob’s 27."], "bob27-100": ["Double Guru", "Reach 100+ points in Bob’s 27."], "countup-400": ["Count-up Cannon", "Reach 400+ points in Count-up."], "countup-500": ["Count-up King", "Reach 500+ points in Count-up."], "countup-180": ["180 in Training", "Throw a 180 in Count-up training."], "clock-40": ["Clockwork", "Finish Around the Clock in 40 darts or fewer."], "clock-25": ["Clock Master", "Finish Around the Clock in 25 darts or fewer."], "cricket-30": ["Cricket Ace", "Close Cricket in 30 darts or fewer."], "shanghai-hit": ["Shanghai!", "Hit a Shanghai (single, double and triple of a number) in Shanghai training."], "halveit-200": ["Consistency", "Reach 200+ points in Halve-it."], "co-challenge-1": ["Finisher", "Master the checkout challenge (at least 1 checkout)."], "co-challenge-5": ["Double Sniper", "Land 5 checkouts in the checkout challenge."], "hit-t20": ["Triple 20", "Hit a Triple 20."], "hit-t20-50": ["Treble Collector", "Hit 50 Triple 20s in total."], "first-double": ["First Double", "Hit your first checkout double."], "hit-bull": ["Bullseye", "Hit the bullseye (double bull, 50)."], "hit-bull-25": ["Bull Hunter", "Hit 25 bullseyes in total."], "win-streak-3": ["On a Roll", "Win 3 games in a row."], "lowton-501": ["Efficient", "Win a 501 leg in 15 darts or fewer."], "darts-10k": ["Prolific Thrower", "Throw 10,000 darts in total."], "early-bird": ["Early Bird", "Finish a game between 5 and 8 a.m."], "night-owl": ["Night Owl", "Finish a game between midnight and 5 a.m."], "bull-finish": ["Bull Finish", "Check out a leg right on the bullseye."], "clean-set": ["Clean Set", "Win a set without conceding a leg."], "comeback": ["Comeback", "Win a match in which an opponent already had match darts."], "co-streak-5": ["Double Streak", "Win 5 legs in a row by checkout."], "shanghai-live": ["Shanghai", "Hit single, double and triple of the same number in one visit."], "team-win": ["Doubles Win", "Win a doubles/team match."], "team-whitewash": ["Team Whitewash", "Win a match as a team (min. 2 legs) without conceding a leg."], "team-180-leg": ["Joint 180 Leg", "Both partners each throw a 180 in the same leg."], "team-partner-co": ["Partner Checkout", "Both partners contribute to a leg won by checkout."], "games-500": ["Darts Enthusiast", "Play 500 games."], "games-1000": ["Darts Veteran", "Play 1,000 games."], "legs-1000": ["Leg Legend", "Win 1,000 legs in total."], "darts-50k": ["Marathon Thrower", "Throw 50,000 darts in total."], "play-streak-7": ["Daily Darts", "Play on 7 consecutive days."], "match-avg-110": ["World-Class Average", "Finish a match with a 110+ average."], "match-avg-120": ["Dream Average", "Finish a match with a 120+ average."], "high-roller": ["High Roller", "Throw three 140+ visits in one match."], "two-180-row": ["Back-to-back 180", "Throw two 180s in a row."], "bull-bull": ["Bull-Bull Finish", "Check out a leg with two bulls in one visit."], "madhouse": ["Madhouse", "Finish on double 1 (from 2)."], "clutch-finish": ["Clutch Finish", "Win a match with a 100+ checkout."], "bed-breakfast": ["Bed & Breakfast", "Score exactly 26 in one visit."], "three-in-bed": ["Three in a Bed", "Hit the same number three times in one visit."], "nuller": ["Zero Visit", "Throw a visit worth 0 points (three misses)."], "weekend-warrior": ["Weekend Warrior", "Finish a game on a Saturday or Sunday."], "birthday-game": ["Birthday Game", "Play on your birthday (profile birth date)."], "clock-20": ["Clock Pro", "Finish Around the Clock in 20 darts or fewer."], "bob27-150": ["Bob Mastery", "Reach 150+ points in Bob’s 27."], "builder-goal": ["Custom Trainer", "Play a self-made exercise from the training builder."], "train-streak-7": ["Training Week", "Train on 7 consecutive days."], "team-partner-co-3": ["In Sync", "Land three partner checkouts in one doubles match."]};

const ICONS = {"win-1": "🥇", "win-10": "🏅", "win-50": "🏆", "win-100": "👑", "whitewash": "🧹", "turn-100": "💯", "turn-140": "🎯", "max-180-1": "💥", "max-180-10": "🔥", "max-180-50": "⚡", "max-180-100": "🌟", "three-180-match": "🚀", "match-avg-60": "📈", "match-avg-80": "🎯", "match-avg-100": "🏅", "co-100": "✅", "co-120": "🎯", "co-big-fish": "🐟", "nine-darter": "9️⃣", "double-master": "🎯", "games-1": "👋", "games-10": "🙂", "games-50": "📅", "games-100": "🤩", "legs-50": "🦵", "legs-250": "🏭", "train-1": "🏋️", "train-25": "💪", "train-100": "🥋", "allrounder": "🌈", "bob27-50": "🎯", "bob27-100": "🧙", "countup-400": "💣", "countup-500": "👑", "countup-180": "💥", "clock-40": "🕐", "clock-25": "⏱️", "cricket-30": "🦗", "shanghai-hit": "🏙️", "halveit-200": "⚖️", "co-challenge-1": "🎯", "co-challenge-5": "🔫", "hit-t20": "🎯", "hit-t20-50": "🔥", "first-double": "✅", "hit-bull": "🔴", "hit-bull-25": "🎯", "win-streak-3": "🔥", "lowton-501": "🧮", "darts-10k": "🎯", "early-bird": "🌅", "night-owl": "🦉", "bull-finish": "🎯", "clean-set": "🧹", "comeback": "🔄", "co-streak-5": "🎯", "shanghai-live": "🏙️", "team-win": "👥", "team-whitewash": "🧹", "team-180-leg": "💥", "team-partner-co": "🤝", "games-500": "📆", "games-1000": "🎖️", "legs-1000": "🦿", "darts-50k": "🎯", "play-streak-7": "📅", "match-avg-110": "📈", "match-avg-120": "🚀", "high-roller": "💰", "two-180-row": "🔥", "bull-bull": "🔴", "madhouse": "🏚️", "clutch-finish": "🧊", "bed-breakfast": "🍳", "three-in-bed": "🛏️", "nuller": "🫥", "weekend-warrior": "🗓️", "birthday-game": "🎂", "clock-20": "⏱️", "bob27-150": "🧙", "builder-goal": "🛠️", "train-streak-7": "🔥", "team-partner-co-3": "🤝"};

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

module.exports = { ACHIEVEMENTS, byId, catalog, satisfiedIds };
