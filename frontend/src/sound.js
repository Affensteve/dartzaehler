// Ton-Engine (pro Gerät): Sound-Effekte + Voice-Caller (Deutsch/Englisch, m/w).
// Modi: 'generated' (Web-Audio + Browser-Sprachausgabe, offline) oder 'clips'
// (vorproduzierte Dateien aus /sounds/…, mit Fallback). Einstellungen pro Gerät
// in localStorage. Sprache/Stimme lassen sich zusätzlich je Spieler übergeben.

const KEY = 'dz.sound';
const defaults = { enabled: true, voice: true, volume: 0.7, mode: 'generated', lang: 'en', gender: 'female', voiceByLang: {}, commentary: false };

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

let settings = load();
const listeners = new Set();

export function getSoundSettings() {
  return settings;
}
export function setSoundSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(settings));
}
export function subscribeSound(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Spieler-Präferenz "de-female" | "en-male" -> { lang, gender } (oder null).
export function parseVoicePref(str) {
  if (!str || typeof str !== 'string') return null;
  const [lang, gender] = str.split('-');
  if (!lang || !gender) return null;
  return { lang, gender };
}

// --- Web-Audio-Effekte ----------------------------------------------------
let ctx = null;
function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function playNotes(notes, base = 0.25) {
  const a = audio();
  if (!a) return;
  const now = a.currentTime;
  const master = settings.volume;
  for (const n of notes) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = n.type || 'sine';
    osc.frequency.value = n.f;
    const start = now + (n.t || 0);
    const dur = n.d || 0.15;
    const peak = base * master * (n.g || 1);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(a.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}

const GENERATED = {
  bust: () => playNotes([{ f: 220, t: 0, d: 0.18, type: 'sawtooth' }, { f: 150, t: 0.14, d: 0.24, type: 'sawtooth' }]),
  bulloff: () => playNotes([{ f: 660, t: 0, d: 0.12, type: 'square' }, { f: 660, t: 0.18, d: 0.12, type: 'square' }]),
  leg: () => playNotes([{ f: 523, t: 0, d: 0.14 }, { f: 659, t: 0.12, d: 0.14 }, { f: 784, t: 0.24, d: 0.22 }]),
  match: () =>
    playNotes([
      { f: 523, t: 0, d: 0.16 }, { f: 659, t: 0.14, d: 0.16 }, { f: 784, t: 0.28, d: 0.16 },
      { f: 1047, t: 0.42, d: 0.4, g: 1.1 },
    ]),
  s180: () =>
    playNotes([
      { f: 392, t: 0, d: 0.12, type: 'square' }, { f: 587, t: 0.12, d: 0.12, type: 'square' },
      { f: 784, t: 0.24, d: 0.12, type: 'square' }, { f: 1047, t: 0.36, d: 0.45, type: 'square', g: 1.1 },
    ]),
};

// --- Sprach-Cues je Sprache ----------------------------------------------
const CUES = {
  en: {
    'game-on': 'Game on!',
    'game-shot': 'Game shot!',
    'game-shot-match': 'Game shot, and the match!',
    'no-score': 'No score.',
    'one-eighty': 'One hundred and eighty!',
  },
  de: {
    'game-on': 'Auf geht\'s!',
    'game-shot': 'Leg gewonnen!',
    'game-shot-match': 'Spiel gewonnen!',
    'no-score': 'Nichts.',
    'one-eighty': 'Einhundertachtzig!',
  },
};
const LANG_TAG = { en: 'en-GB', de: 'de-DE' };

// --- Stimmauswahl (m/w) über die installierten System-Stimmen -------------
let voices = [];
const voiceListeners = new Set();
function refreshVoices() {
  try {
    voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || [];
  } catch {
    voices = [];
  }
  voiceListeners.forEach((l) => l(voices));
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  } catch {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
}

// Auf dem Gerät verfügbare Stimmen für eine Sprache (de|en).
export function listVoices(lang) {
  if (!voices.length) refreshVoices();
  const tag = lang === 'de' ? 'de' : 'en';
  return voices
    .filter((v) => (v.lang || '').toLowerCase().startsWith(tag))
    .map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }));
}
// Auf das (asynchrone) Nachladen der Stimmenliste reagieren.
export function subscribeVoices(fn) {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
}
const FEMALE_HINTS = ['female', 'frau', 'woman', 'zira', 'anna', 'petra', 'katja', 'hedda', 'marlene',
  'sabina', 'samantha', 'victoria', 'serena', 'fiona', 'karen', 'moira', 'tessa', 'veena', 'google uk english female', 'google deutsch'];
const MALE_HINTS = ['male', 'mann', 'david', 'daniel', 'markus', 'stefan', 'yannick', 'conrad', 'fred',
  'rishi', 'oliver', 'thomas', 'hans', 'google uk english male'];

function pickVoice(lang, gender, overrideURI) {
  if (!voices.length) refreshVoices();
  const tag = lang === 'de' ? 'de' : 'en';
  const cand = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(tag));
  if (!cand.length) return null;
  if (overrideURI) {
    const chosen = cand.find((v) => v.voiceURI === overrideURI);
    if (chosen) return chosen;
  }
  const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
  const anti = gender === 'male' ? FEMALE_HINTS : MALE_HINTS;
  const match = cand.find((v) => hints.some((h) => v.name.toLowerCase().includes(h)));
  if (match) return match;
  // sonst eine Stimme, die nicht offensichtlich zum anderen Geschlecht gehört
  const neutral = cand.find((v) => !anti.some((h) => v.name.toLowerCase().includes(h)));
  return neutral || cand[0];
}

// --- Sprachausgabe (Warteschlange) ---------------------------------------
// Ansagen werden gestapelt und nacheinander abgespielt, damit z. B. bei
// schnellen Bot-Aufnahmen keine Ansage verschluckt wird. priority=true setzt
// die Warteschlange zurück und spricht sofort (z. B. Eröffnungsansage).
let speechQueue = [];
let speaking = false;

function buildUtterance(text, { lang, gender, voiceURI, rate = 0.95, volGain = 0.2 } = {}) {
  const l = lang || settings.lang;
  const g = gender || settings.gender;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG_TAG[l] || 'en-GB';
  const v = pickVoice(l, g, voiceURI);
  if (v) u.voice = v;
  u.rate = rate;
  u.pitch = 1;
  u.volume = Math.min(1, settings.volume + volGain);
  return u;
}

function pump() {
  if (speaking) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const item = speechQueue.shift();
  if (!item) return;
  speaking = true;
  try {
    const u = buildUtterance(item.text, item.opts);
    const done = () => {
      speaking = false;
      setTimeout(pump, 0);
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  } catch {
    speaking = false;
    setTimeout(pump, 0);
  }
}

function speak(text, { priority = false, ...opts } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  if (priority) {
    speechQueue = [];
    speaking = false;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  speechQueue.push({ text, opts });
  pump();
}

// --- Clip-Wiedergabe (Modus 'clips', Fallback -> generated/tts) -----------
function playClip(folder, name, fallback) {
  try {
    const el = new Audio(`/sounds/${folder}/${name}.mp3`);
    el.volume = settings.volume;
    el.addEventListener('error', () => fallback && fallback());
    const p = el.play();
    if (p && p.catch) p.catch(() => fallback && fallback());
  } catch {
    fallback && fallback();
  }
}

// --- Öffentliche API ------------------------------------------------------
export function playEffect(name) {
  if (!settings.enabled) return;
  const gen = GENERATED[name];
  if (settings.mode === 'clips') playClip('sfx', name, gen);
  else if (gen) gen();
}

// Feste Sprach-Ansage (Cue), optional mit Spieler-Stimme (pref={lang,gender}).
export function callCue(name, pref) {
  if (!settings.enabled || !settings.voice) return;
  const lang = (pref && pref.lang) || settings.lang;
  const gender = (pref && pref.gender) || settings.gender;
  const voiceURI = pref ? undefined : settings.voiceByLang[lang];
  const text = (CUES[lang] && CUES[lang][name]) || CUES.en[name] || '';
  if (settings.mode === 'clips') playClip(`voice/${lang}`, name, () => speak(text, { lang, gender, voiceURI }));
  else speak(text, { lang, gender, voiceURI });
}

// Cue-Ansage mit angehängtem Spielernamen (z. B. „Leg gewonnen, Steffen!").
// Nutzt immer die Sprachausgabe, da Namen nicht als feste Clips vorliegen.
export function sayCueWithName(name, cueName, pref) {
  if (!settings.enabled || !settings.voice) return;
  const lang = (pref && pref.lang) || settings.lang;
  const gender = (pref && pref.gender) || settings.gender;
  const voiceURI = pref ? undefined : settings.voiceByLang[lang];
  const base = (CUES[lang] && CUES[lang][cueName]) || CUES.en[cueName] || '';
  const text = name ? `${base.replace(/[!.\s]+$/, '')}, ${name}!` : base;
  speak(text, { lang, gender, voiceURI });
}

// Finish-Ansage im Stil des Callers: „Name, you require XX" / „Name benötigt noch XX".
// Wird als Aufnahme in die Warteschlange gehängt (kein Abbruch).
export function sayRequire(name, score, pref) {
  if (!settings.enabled || !settings.voice || !score) return;
  const lang = (pref && pref.lang) || settings.lang;
  const gender = (pref && pref.gender) || settings.gender;
  const voiceURI = pref ? undefined : settings.voiceByLang[lang];
  const num = lang === 'de' ? String(score) : numberWords(score);
  const text =
    lang === 'de'
      ? `${name ? name + ', ' : ''}du benötigst noch ${num}.`
      : `${name ? name + ', ' : ''}you require ${num}.`;
  speak(text, { lang, gender, voiceURI });
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function numberWords(n) {
  n = Math.round(n);
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return TENS[t] + (r ? '-' + ONES[r] : '');
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  return ONES[h] + ' hundred' + (r ? ' and ' + numberWords(r) : '');
}

// Aufnahme-Summe ansagen; 180 -> Shout + Fanfare. Optional Spieler-Stimme (pref).
export function sayScore(score, pref) {
  if (!settings.enabled) return;
  if (score === 180) {
    playEffect('s180');
    callCue('one-eighty', pref);
    return;
  }
  if (!settings.voice) return;
  const lang = (pref && pref.lang) || settings.lang;
  const gender = (pref && pref.gender) || settings.gender;
  const voiceURI = pref ? undefined : settings.voiceByLang[lang];
  const text = lang === 'de' ? String(score) : numberWords(score);
  if (settings.mode === 'clips') playClip(`voice/${lang}`, `score-${score}`, () => speak(text, { priority: false, lang, gender, voiceURI }));
  else speak(text, { priority: false, lang, gender, voiceURI });
}

// --- iOS/Mobile: Audio + Sprachausgabe beim ersten Nutzer-Tap freischalten ---
// Eröffnungs-Ansage bei Spiel-/Match-Start: nennt die Spieler + "Game on".
// Nutzt die Geräte-Standardstimme (nennt beide Spieler, daher keine Einzelstimme).
export function sayIntro(names) {
  if (!settings.enabled || !settings.voice) return;
  const list = (names || []).filter(Boolean);
  const lang = settings.lang;
  const on = (CUES[lang] && CUES[lang]['game-on']) || CUES.en['game-on'];
  if (!list.length) {
    speak(on, { priority: true, voiceURI: settings.voiceByLang[lang] });
    return;
  }
  const vs = lang === 'de' ? 'gegen' : 'versus';
  const joined = list.length === 2 ? `${list[0]} ${vs} ${list[1]}` : list.join(', ');
  speak(`${joined}. ${on}`, { priority: true, voiceURI: settings.voiceByLang[lang] });
}

// Live-Kommentar (regelbasiert, optional). Wird an die Sprach-Warteschlange
// angehängt (kein Abbruch), damit er nach der eigentlichen Ansage kommt.
export function sayCommentary(text) {
  if (!settings.enabled || !settings.voice || !settings.commentary || !text) return;
  const l = settings.lang;
  speak(text, { lang: l, gender: settings.gender, voiceURI: settings.voiceByLang[l], rate: 1.0, volGain: 0.1 });
}

let unlocked = false;
export function unlockAudio() {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  try {
    const a = audio();
    if (a) {
      const buf = a.createBuffer(1, 1, 22050);
      const src = a.createBufferSource();
      src.buffer = buf;
      src.connect(a.destination);
      src.start(0);
    }
  } catch {
    /* ignore */
  }
  try {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  const prime = () => unlockAudio();
  window.addEventListener('pointerdown', prime, { once: true, passive: true });
  window.addEventListener('touchend', prime, { once: true, passive: true });
  window.addEventListener('keydown', prime, { once: true });
}
