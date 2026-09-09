import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Stack, ToggleButton, ToggleButtonGroup, TextField, Paper } from '@mui/material';
import Dartboard from './Dartboard';
import { ACCENT, MONO } from '../../theme';
import { t as tr } from '../../i18n';

const IMPOSSIBLE = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

function Stage({ title, sub, numbers, ring, children }) {
  return (
    <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center' }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>{title}</Typography>
      {sub && <Typography color="text.secondary">{sub}</Typography>}
      <Dartboard numbers={numbers} ring={ring} size={168} />
      {children}
    </Stack>
  );
}

function NumField({ value, onChange, onEnter, label }) {
  const lbl = label || tr('tm.pointsField');
  return (
    <TextField
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
      onKeyDown={(e) => e.key === 'Enter' && onEnter()}
      label={lbl}
      autoComplete="off"
      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', style: { fontFamily: MONO, fontSize: 26, fontWeight: 700, textAlign: 'center' } }}
      sx={{ width: 180 }}
    />
  );
}

// --- Around the Clock (Richtung + Ring wählbar) ---
function ClockMode({ onFinish, onProgress, initial }) {
  const [dir, setDir] = useState(initial?.dir || 'up');
  const [ring, setRing] = useState(initial?.ring || 'single');
  const [idx, setIdx] = useState(initial?.idx ?? 0);
  const [darts, setDarts] = useState(initial?.darts ?? 0);
  const misses = useRef(initial?.missesByField || {}); // Fehlwürfe je Feld
  const curMiss = useRef(initial?.curMiss || 0);
  const base = dir === 'down' ? [...Array(20)].map((_, i) => 20 - i) : [...Array(20)].map((_, i) => i + 1);
  const targets = ring === 'triple' ? base : [...base, 'Bull'];
  const cur = targets[Math.min(idx, targets.length - 1)];
  const started = darts > 0 || idx > 0;
  useEffect(() => { onProgress && onProgress({ idx, darts, dir, ring, missesByField: misses.current, curMiss: curMiss.current }); });
  const reset = () => { setIdx(0); setDarts(0); misses.current = {}; curMiss.current = 0; };
  const label = cur === 'Bull' ? tr('tm.bull') : ring === 'double' ? 'D' + cur : ring === 'triple' ? 'T' + cur : String(cur);
  const boardRing = cur === 'Bull' ? 'bull' : ring === 'double' ? 'double' : ring === 'triple' ? 'triple' : 'number';
  const hitDart = () => {
    const d = darts + 1;
    setDarts(d);
    const field = cur === 'Bull' ? 'Bull' : String(cur);
    misses.current[field] = (misses.current[field] || 0) + curMiss.current;
    curMiss.current = 0;
    if (idx + 1 >= targets.length) onFinish({ score: d, detail: { darts: d, dir, ring, missesByField: { ...misses.current } } });
    else setIdx(idx + 1);
  };
  // n Fehlwürfe auf einmal verbuchen (z. B. alle 3 Darts einer Aufnahme daneben).
  const addMiss = (n) => { setDarts((d) => d + n); curMiss.current += n; };
  return (
    <Stage title={tr('tm.target', { t: label })} sub={tr('tm.clockSub', { i: idx, d: darts })}
      numbers={cur === 'Bull' ? [25] : [cur]} ring={boardRing}>
      <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup exclusive size="small" value={dir} disabled={started} onChange={(e, v) => v && (reset(), setDir(v))}>
          <ToggleButton value="up">{tr('tm.clockUp')}</ToggleButton>
          <ToggleButton value="down">{tr('tm.clockDown')}</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup exclusive size="small" value={ring} disabled={started} onChange={(e, v) => v && (reset(), setRing(v))}>
          <ToggleButton value="single">{tr('tm.ringSingle')}</ToggleButton>
          <ToggleButton value="double">{tr('tm.ringDouble')}</ToggleButton>
          <ToggleButton value="triple">{tr('tm.ringTriple')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
        <Button variant="contained" size="large" onClick={hitDart} sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>{tr('tm.hit')}</Button>
        <Button variant="outlined" size="large" onClick={() => addMiss(1)}>{tr('tm.miss')}</Button>
        <Button variant="outlined" size="large" onClick={() => addMiss(2)}>{tr('tm.miss2')}</Button>
        <Button variant="outlined" size="large" onClick={() => addMiss(3)}>{tr('tm.miss3')}</Button>
      </Stack>
    </Stage>
  );
}

// --- Bob's 27 ---
function Bob27Mode({ onFinish, onProgress, initial }) {
  const seq = [...Array(20)].map((_, i) => i + 1).concat(['Bull']);
  const [idx, setIdx] = useState(initial?.idx ?? 0);
  const [score, setScore] = useState(initial?.score ?? 27);
  const detail = useRef(initial?.detail || { zeroByDouble: {}, hitsByDouble: {} });
  const cur = seq[idx];
  useEffect(() => { onProgress && onProgress({ idx, score, detail: detail.current }); });
  const val = cur === 'Bull' ? 25 : cur;
  const pick = (h) => {
    const field = cur === 'Bull' ? 'Bull' : String(cur);
    detail.current.hitsByDouble[field] = h;
    detail.current.zeroByDouble[field] = h === 0 ? 1 : 0;
    const s = score + (h > 0 ? h * 2 * val : -2 * val);
    if (s < 0) { onFinish({ score: s, detail: { ...detail.current }, busted: true, at: cur }); return; }
    if (idx + 1 >= seq.length) { onFinish({ score: s, detail: { ...detail.current } }); return; }
    setScore(s);
    setIdx(idx + 1);
  };
  return (
    <Stage title={tr('tm.doubleTitle', { t: cur === 'Bull' ? 'Bull (50)' : 'D' + cur })} sub={tr('tm.bobSub', { s: score, i: idx + 1 })}
      numbers={cur === 'Bull' ? [25] : [cur]} ring={cur === 'Bull' ? 'bull' : 'double'}>
      <Typography variant="body2" color="text.secondary">{tr('tm.dartsInDouble')}</Typography>
      <Stack direction="row" spacing={1}>
        {[0, 1, 2, 3].map((h) => (
          <Button key={h} variant={h === 0 ? 'outlined' : 'contained'} size="large" onClick={() => pick(h)} sx={{ minWidth: 60, fontSize: 20, fontWeight: 800 }}>{h}</Button>
        ))}
      </Stack>
    </Stage>
  );
}

// --- Count-up ---
function CountUpMode({ onFinish, onProgress, initial }) {
  const N = 8;
  const [round, setRound] = useState(initial?.round ?? 1);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [val, setVal] = useState('');
  const [error, setError] = useState(null);
  const tally = useRef(initial?.tally || { s60: 0, s100: 0, s140: 0, s180: 0, maxTurn: 0 });
  useEffect(() => { onProgress && onProgress({ round, total, tally: tally.current }); });
  const submit = () => {
    if (val === '') return;
    const n = Number(val);
    if (n > 180 || IMPOSSIBLE.has(n)) { setError(tr('tm.invalidSum')); return; }
    const t = tally.current;
    if (n === 180) t.s180 += 1; else if (n >= 140) t.s140 += 1; else if (n >= 100) t.s100 += 1; else if (n >= 60) t.s60 += 1;
    if (n > t.maxTurn) t.maxTurn = n;
    const nt = total + n;
    if (round >= N) {
      const avg = Math.round((nt / N) * 100) / 100;
      onFinish({
        score: nt,
        detail: { avg, points: nt, darts: N * 3, ...t },
        scoring: { points: nt, darts: N * 3, s60: t.s60, s100: t.s100, s140: t.s140, s180: t.s180, maxTurn: t.maxTurn },
      });
    } else {
      setTotal(nt); setRound(round + 1); setVal(''); setError(null);
    }
  };
  return (
    <Stage title={tr('tm.roundOf', { r: round, n: N })} sub={tr('tm.totalAvg', { t: total, avg: round > 1 ? Math.round((total / (round - 1)) * 10) / 10 : 0 })}
      numbers={[20, 19, 18]} ring="triple">
      <NumField value={val} onChange={(v) => { setVal(v); setError(null); }} onEnter={submit} label={tr('tm.visitSum')} />
      {error && <Typography color="error" variant="caption">{error}</Typography>}
      <Button variant="contained" size="large" onClick={submit} disabled={val === ''} sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>
        {round >= N ? tr('tm.finish') : tr('tm.next')}
      </Button>
    </Stage>
  );
}

// --- Cricket (Solo) ---
function CricketMode({ onFinish, onProgress, initial }) {
  const targets = [20, 19, 18, 17, 16, 15, 'Bull'];
  const [marks, setMarks] = useState(() => initial?.marks || Object.fromEntries(targets.map((t) => [t, 0])));
  const [darts, setDarts] = useState(initial?.darts ?? 0);
  const [mult, setMult] = useState(1);
  const detail = useRef(initial?.detail || { marksByTarget: {}, misses: 0 });
  useEffect(() => { onProgress && onProgress({ marks, darts, detail: detail.current }); });
  const hit = (t) => {
    if (marks[t] >= 3) return;
    const add = Math.min(mult, 3 - marks[t]);
    detail.current.marksByTarget[t] = (detail.current.marksByTarget[t] || 0) + add;
    const nm = { ...marks, [t]: marks[t] + add };
    const d = darts + 1;
    setMarks(nm);
    setDarts(d);
    setMult(1);
    if (targets.every((x) => nm[x] >= 3)) onFinish({ score: d, detail: { darts: d, misses: detail.current.misses, marksByTarget: { ...detail.current.marksByTarget } } });
  };
  const miss = () => { detail.current.misses += 1; setDarts(darts + 1); setMult(1); };
  return (
    <Stage title={tr('tm.cricketTitle')} sub={tr('tm.dartsN', { d: darts })} numbers={[15, 16, 17, 18, 19, 20, 25]} ring="number">
      <ToggleButtonGroup exclusive size="small" value={mult} onChange={(e, v) => v && setMult(v)}>
        <ToggleButton value={1}>{tr('tm.single')}</ToggleButton>
        <ToggleButton value={2}>{tr('tm.double')}</ToggleButton>
        <ToggleButton value={3}>{tr('tm.triple')}</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, width: '100%', maxWidth: 340 }}>
        {targets.map((t) => (
          <Button key={t} variant={marks[t] >= 3 ? 'contained' : 'outlined'} color={marks[t] >= 3 ? 'success' : 'primary'}
            onClick={() => hit(t)} sx={{ flexDirection: 'column', py: 0.5 }}>
            <span style={{ fontWeight: 800 }}>{t === 'Bull' ? tr('tm.bull') : t}</span>
            <span style={{ fontSize: 12 }}>{'●'.repeat(marks[t])}{'○'.repeat(3 - marks[t])}</span>
          </Button>
        ))}
      </Box>
      <Button variant="text" onClick={miss}>{tr('tm.missCounts')}</Button>
    </Stage>
  );
}

// --- Shanghai ---
function ShanghaiMode({ onFinish, onProgress, initial }) {
  const [round, setRound] = useState(initial?.round ?? 1);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [darts, setDarts] = useState(['m', 'm', 'm']);
  const agg = useRef(initial?.agg || { singles: 0, doubles: 0, triples: 0, misses: 0, shanghais: 0 });
  useEffect(() => { onProgress && onProgress({ round, total, agg: agg.current }); });
  const setDart = (i, v) => setDarts((d) => d.map((x, j) => (j === i ? v : x)));
  const multOf = (v) => (v === 's' ? 1 : v === 'd' ? 2 : v === 't' ? 3 : 0);
  const roundScore = darts.reduce((s, v) => s + multOf(v) * round, 0);
  const confirm = () => {
    const a = agg.current;
    darts.forEach((v) => {
      if (v === 's') a.singles += 1; else if (v === 'd') a.doubles += 1; else if (v === 't') a.triples += 1; else a.misses += 1;
    });
    const shanghai = darts.includes('s') && darts.includes('d') && darts.includes('t');
    const nt = total + roundScore;
    if (shanghai) { a.shanghais += 1; onFinish({ score: nt, detail: { ...a }, shanghai: true, round }); return; }
    if (round >= 7) { onFinish({ score: nt, detail: { ...a } }); return; }
    setTotal(nt); setRound(round + 1); setDarts(['m', 'm', 'm']);
  };
  return (
    <Stage title={tr('tm.shanghaiTitle', { r: round })} sub={tr('tm.shanghaiSub', { t: total, rs: roundScore })} numbers={[round]} ring="number">
      <Stack spacing={1}>
        {darts.map((v, i) => (
          <ToggleButtonGroup key={i} exclusive size="small" value={v} onChange={(e, nv) => nv && setDart(i, nv)}>
            <ToggleButton value="m">{tr('tm.missShort')}</ToggleButton>
            <ToggleButton value="s">{tr('tm.single')}</ToggleButton>
            <ToggleButton value="d">{tr('tm.double')}</ToggleButton>
            <ToggleButton value="t">{tr('tm.triple')}</ToggleButton>
          </ToggleButtonGroup>
        ))}
      </Stack>
      <Button variant="contained" size="large" onClick={confirm} sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>
        {round >= 7 ? tr('tm.finish') : tr('tm.confirmRound')}
      </Button>
    </Stage>
  );
}

// --- Halve-it ---
function HalveItMode({ onFinish, onProgress, initial }) {
  const seq = [
    { label: '15', numbers: [15], ring: 'number' },
    { label: '16', numbers: [16], ring: 'number' },
    { label: tr('tm.anyDouble'), numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], ring: 'double' },
    { label: '17', numbers: [17], ring: 'number' },
    { label: '18', numbers: [18], ring: 'number' },
    { label: tr('tm.anyTriple'), numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], ring: 'triple' },
    { label: '19', numbers: [19], ring: 'number' },
    { label: '20', numbers: [20], ring: 'number' },
    { label: tr('tm.bull'), numbers: [25], ring: 'bull' },
  ];
  const [i, setI] = useState(initial?.i ?? 0);
  const [score, setScore] = useState(initial?.score ?? 0);
  const [val, setVal] = useState('');
  const halved = useRef(initial?.halved || {});
  const cur = seq[i];
  useEffect(() => { onProgress && onProgress({ i, score, halved: halved.current }); });
  const submit = () => {
    const n = Number(val || 0);
    halved.current[cur.label] = n > 0 ? 0 : 1;
    const ns = n > 0 ? score + n : Math.floor(score / 2);
    if (i + 1 >= seq.length) { onFinish({ score: ns, detail: { halvedByTarget: { ...halved.current } } }); return; }
    setScore(ns); setI(i + 1); setVal('');
  };
  return (
    <Stage title={tr('tm.halveTitle', { label: cur.label })} sub={tr('tm.halveSub', { s: score, i: i + 1, n: seq.length })} numbers={cur.numbers} ring={cur.ring}>
      <NumField value={val} onChange={setVal} onEnter={submit} label={tr('tm.pointsOnTarget')} />
      <Typography variant="caption" color="text.secondary">{tr('tm.halveHint')}</Typography>
      <Button variant="contained" size="large" onClick={submit} sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>
        {i + 1 >= seq.length ? tr('tm.finish') : tr('tm.next')}
      </Button>
    </Stage>
  );
}

// --- Checkout / 121 ---
function CheckoutMode({ onFinish, onProgress, initial }) {
  const N = 10;
  const [round, setRound] = useState(initial?.round ?? 1);
  const [ok, setOk] = useState(initial?.ok ?? 0);
  useEffect(() => { onProgress && onProgress({ round, ok }); });
  const done = (success) => {
    const no = ok + (success ? 1 : 0);
    if (round >= N) { onFinish({ score: no, detail: { successes: no, attempts: N }, of: N }); return; }
    setOk(no); setRound(round + 1);
  };
  return (
    <Stage title={tr('tm.checkoutTitle')} sub={tr('tm.checkoutSub', { r: round, n: N, ok })} numbers={[20, 11, 14]} ring="double">
      <Paper variant="outlined" sx={{ p: 1, mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{tr('tm.suggestion')}: <b>T20 · T11 · D14</b></Typography>
      </Paper>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" size="large" onClick={() => done(true)} sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>{tr('tm.made')}</Button>
        <Button variant="outlined" size="large" onClick={() => done(false)}>{tr('tm.notMade')}</Button>
      </Stack>
    </Stage>
  );
}

// --- Checkout-Trainer (Praxis-Drill) ---
const FINISHES = [41, 50, 60, 64, 71, 81, 90, 96, 100, 110, 116, 120, 121, 130, 141, 150, 161, 167, 170];
const DOUBLE_RESTS = [...Array(20)].map((_, i) => (i + 1) * 2).concat([50]); // D1..D20, Bull(50)
function shuffleArr(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function CheckoutDrillMode({ onFinish, onProgress, initial }) {
  const N = 9;
  const [phase, setPhase] = useState(initial ? 'play' : 'config');
  const [onlyDoubles, setOnlyDoubles] = useState(initial?.onlyDoubles ?? false);
  const [pressure, setPressure] = useState(initial?.pressure ?? false);
  const [rests, setRests] = useState(initial?.rests || []);
  const [round, setRound] = useState(initial?.round ?? 0);
  const [ok, setOk] = useState(initial?.ok ?? 0);
  const detail = useRef(initial?.detail || { successes: 0, attempts: 0, dartsUsed: 0 });
  useEffect(() => {
    if (phase === 'play') onProgress && onProgress({ phase: 'play', onlyDoubles, pressure, rests, round, ok, detail: detail.current });
  });

  const begin = () => {
    const pool = onlyDoubles ? DOUBLE_RESTS : FINISHES;
    let rs;
    if (pressure) {
      const r = pool[Math.floor(Math.random() * pool.length)];
      rs = Array(N).fill(r);
    } else {
      const sh = shuffleArr(pool);
      rs = Array.from({ length: N }, (_, i) => sh[i % sh.length]);
    }
    setRests(rs);
    setRound(0);
    setOk(0);
    detail.current = { successes: 0, attempts: 0, dartsUsed: 0 };
    setPhase('play');
  };
  const answer = (darts) => {
    detail.current.attempts += 1;
    if (darts) {
      detail.current.successes += 1;
      detail.current.dartsUsed += darts;
    }
    const no = ok + (darts ? 1 : 0);
    if (round + 1 >= N) {
      onFinish({ score: no, detail: { ...detail.current }, of: N });
      return;
    }
    setOk(no);
    setRound(round + 1);
  };

  if (phase === 'config') {
    return (
      <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{tr('tm.options')}</Typography>
        <Stack direction="row" spacing={1}>
          <ToggleButton value="d" selected={onlyDoubles} onChange={() => setOnlyDoubles((v) => !v)} size="small">{tr('tm.onlyDoubles')}</ToggleButton>
          <ToggleButton value="p" selected={pressure} onChange={() => setPressure((v) => !v)} size="small">{tr('tm.underPressure')}</ToggleButton>
        </Stack>
        <Button variant="contained" size="large" onClick={begin} sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>{tr('tm.start')}</Button>
      </Stack>
    );
  }
  const rest = rests[round];
  return (
    <Stage
      title={tr('tm.rest', { n: rest === 50 ? tr('tm.bull') : rest })}
      sub={`${tr('tm.roundOf', { r: round + 1, n: N })} · ${tr('tm.hitsTotal', { n: ok })}`}
      numbers={rest === 50 ? [25] : [...Array(20)].map((_, i) => i + 1)}
      ring="double"
    >
      <Typography variant="body2" color="text.secondary">{tr('tm.dartsToFinish')}</Typography>
      <Stack direction="row" spacing={1}>
        {[1, 2, 3].map((d) => (
          <Button key={d} variant="contained" size="large" onClick={() => answer(d)} sx={{ minWidth: 56, fontWeight: 800, bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>{d}</Button>
        ))}
        <Button variant="outlined" size="large" onClick={() => answer(0)}>{tr('tm.miss')}</Button>
      </Stack>
    </Stage>
  );
}

// --- Doppel-Rundlauf (D1 -> D20 -> Bull) ---
function DoublesRoundMode({ onFinish, onProgress, initial }) {
  const seq = [...Array(20)].map((_, i) => i + 1).concat(['Bull']);
  const [idx, setIdx] = useState(initial?.idx ?? 0);
  const [hits, setHits] = useState(initial?.hits ?? 0);
  const detail = useRef(initial?.detail || { hitsByDouble: {} });
  useEffect(() => { onProgress && onProgress({ idx, hits, detail: detail.current }); });
  const cur = seq[idx];
  const pick = (h) => {
    detail.current.hitsByDouble[cur === 'Bull' ? 'Bull' : String(cur)] = h;
    const nh = hits + h;
    if (idx + 1 >= seq.length) { onFinish({ score: nh, detail: { ...detail.current }, of: seq.length * 3 }); return; }
    setHits(nh);
    setIdx(idx + 1);
  };
  return (
    <Stage
      title={cur === 'Bull' ? 'Bull' : `D${cur}`}
      sub={`${tr('tm.hitsTotal', { n: hits })} · ${tr('tm.roundOf', { r: idx + 1, n: seq.length })}`}
      numbers={cur === 'Bull' ? [25] : [cur]}
      ring={cur === 'Bull' ? 'bull' : 'double'}
    >
      <Typography variant="body2" color="text.secondary">{tr('tm.hitsThisRound')}</Typography>
      <Stack direction="row" spacing={1}>
        {[0, 1, 2, 3].map((h) => (
          <Button key={h} variant={h === 0 ? 'outlined' : 'contained'} size="large" onClick={() => pick(h)} sx={{ minWidth: 56, fontWeight: 800 }}>{h}</Button>
        ))}
      </Stack>
    </Stage>
  );
}

// --- Bull-Training ---
function BullTrainMode({ onFinish, onProgress, initial }) {
  const N = 10;
  const [round, setRound] = useState(initial?.round ?? 1);
  const [hits, setHits] = useState(initial?.hits ?? 0);
  useEffect(() => { onProgress && onProgress({ round, hits }); });
  const pick = (h) => {
    const nh = hits + h;
    if (round >= N) { onFinish({ score: nh, detail: { bull: { hits: nh, attempts: N * 3 } }, of: N * 3 }); return; }
    setHits(nh);
    setRound(round + 1);
  };
  return (
    <Stage title={tr('tm.bull')} sub={`${tr('tm.roundOf', { r: round, n: N })} · ${tr('tm.hitsTotal', { n: hits })}`} numbers={[25]} ring="bull">
      <Typography variant="body2" color="text.secondary">{tr('tm.hitsThisRound')}</Typography>
      <Stack direction="row" spacing={1}>
        {[0, 1, 2, 3].map((h) => (
          <Button key={h} variant={h === 0 ? 'outlined' : 'contained'} size="large" onClick={() => pick(h)} sx={{ minWidth: 56, fontWeight: 800 }}>{h}</Button>
        ))}
      </Stack>
    </Stage>
  );
}

// --- Scoring-Drill: Triple-Fokus (T20/T19) ---
function ScoringHitMode({ target, onFinish, onProgress, initial }) {
  const N = 10;
  const [round, setRound] = useState(initial?.round ?? 1);
  const [hits, setHits] = useState(initial?.hits ?? 0);
  useEffect(() => { onProgress && onProgress({ round, hits, target }); });
  const pick = (h) => {
    const nh = hits + h;
    if (round >= N) { onFinish({ score: nh, detail: { tripleHits: { [target]: nh }, attempts: N * 3 }, of: N * 3 }); return; }
    setHits(nh);
    setRound(round + 1);
  };
  return (
    <Stage title={`T${target}`} sub={`${tr('tm.roundOf', { r: round, n: N })} · ${tr('tm.hitsTotal', { n: hits })}`} numbers={[target]} ring="triple">
      <Typography variant="body2" color="text.secondary">{tr('tm.hitsThisRound')}</Typography>
      <Stack direction="row" spacing={1}>
        {[0, 1, 2, 3].map((h) => (
          <Button key={h} variant={h === 0 ? 'outlined' : 'contained'} size="large" onClick={() => pick(h)} sx={{ minWidth: 56, fontWeight: 800 }}>{h}</Button>
        ))}
      </Stack>
    </Stage>
  );
}

// --- Scoring-Drill: 100+/140+ Aufnahmen zählen ---
function ScoringSumMode({ threshold, onFinish, onProgress, initial }) {
  const N = 10;
  const [round, setRound] = useState(initial?.round ?? 1);
  const [count, setCount] = useState(initial?.count ?? 0);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [val, setVal] = useState('');
  const [error, setError] = useState(null);
  const tally = useRef(initial?.tally || { s60: 0, s100: 0, s140: 0, s180: 0, maxTurn: 0 });
  useEffect(() => { onProgress && onProgress({ round, count, total, threshold, tally: tally.current }); });
  const submit = () => {
    if (val === '') return;
    const n = Number(val);
    if (n > 180 || IMPOSSIBLE.has(n)) { setError(tr('tm.invalidSum')); return; }
    const tl = tally.current;
    if (n === 180) tl.s180 += 1; else if (n >= 140) tl.s140 += 1; else if (n >= 100) tl.s100 += 1; else if (n >= 60) tl.s60 += 1;
    if (n > tl.maxTurn) tl.maxTurn = n;
    const nc = count + (n >= threshold ? 1 : 0);
    const nt = total + n;
    if (round >= N) {
      const avg = Math.round((nt / N) * 100) / 100;
      onFinish({
        score: nc,
        detail: { avg, count: nc, threshold },
        of: N,
        scoring: { points: nt, darts: N * 3, s60: tl.s60, s100: tl.s100, s140: tl.s140, s180: tl.s180, maxTurn: tl.maxTurn },
      });
      return;
    }
    setCount(nc); setTotal(nt); setRound(round + 1); setVal(''); setError(null);
  };
  return (
    <Stage title={tr('tm.roundOf', { r: round, n: N })} sub={`${tr('tm.countSub', { c: count, n: N })} · ${threshold}+`} numbers={[20, 19, 18]} ring="triple">
      <NumField value={val} onChange={(v) => { setVal(v); setError(null); }} onEnter={submit} label={tr('tm.visitSum')} />
      {error && <Typography color="error" variant="caption">{error}</Typography>}
      <Button variant="contained" size="large" onClick={submit} disabled={val === ''} sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>
        {round >= N ? tr('tm.finish') : tr('tm.next')}
      </Button>
    </Stage>
  );
}

const ScoringHit20 = (p) => <ScoringHitMode target={20} {...p} />;
const ScoringHit19 = (p) => <ScoringHitMode target={19} {...p} />;
const Scoring100 = (p) => <ScoringSumMode threshold={100} {...p} />;
const Scoring140 = (p) => <ScoringSumMode threshold={140} {...p} />;

// --- Triple-Rundlauf (T1 -> T20) ---
function TriplesRoundMode({ onFinish, onProgress, initial }) {
  const seq = [...Array(20)].map((_, i) => i + 1);
  const [idx, setIdx] = useState(initial?.idx ?? 0);
  const [hits, setHits] = useState(initial?.hits ?? 0);
  const detail = useRef(initial?.detail || { hitsByTriple: {} });
  useEffect(() => { onProgress && onProgress({ idx, hits, detail: detail.current }); });
  const cur = seq[idx];
  const pick = (h) => {
    detail.current.hitsByTriple[String(cur)] = h;
    const nh = hits + h;
    if (idx + 1 >= seq.length) { onFinish({ score: nh, detail: { ...detail.current }, of: seq.length * 3 }); return; }
    setHits(nh);
    setIdx(idx + 1);
  };
  return (
    <Stage title={`T${cur}`} sub={`${tr('tm.hitsTotal', { n: hits })} · ${tr('tm.roundOf', { r: idx + 1, n: seq.length })}`} numbers={[cur]} ring="triple">
      <Typography variant="body2" color="text.secondary">{tr('tm.hitsThisRound')}</Typography>
      <Stack direction="row" spacing={1}>
        {[0, 1, 2, 3].map((h) => (
          <Button key={h} variant={h === 0 ? 'outlined' : 'contained'} size="large" onClick={() => pick(h)} sx={{ minWidth: 56, fontWeight: 800 }}>{h}</Button>
        ))}
      </Stack>
    </Stage>
  );
}

export const MODE_COMPONENTS = {
  clock: ClockMode,
  bob27: Bob27Mode,
  countup: CountUpMode,
  cricket: CricketMode,
  shanghai: ShanghaiMode,
  halveit: HalveItMode,
  checkout: CheckoutMode,
  checkoutdrill: CheckoutDrillMode,
  doublesround: DoublesRoundMode,
  triplesround: TriplesRoundMode,
  bulltrain: BullTrainMode,
  drill20: ScoringHit20,
  drill19: ScoringHit19,
  drill100: Scoring100,
  drill140: Scoring140,
};
