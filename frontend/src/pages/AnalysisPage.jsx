import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import Header from '../components/Header';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT, useLang } from '../i18n';

const RANGES = ['today', '7d', '30d', 'all'];

// Kennzahlen für die Bestenliste: key, Label (de/en), Richtung, Formatierung, Mindest-Spiele.
const METRICS = [
  { key: 'average', de: 'Ø (3-Dart)', en: '3-dart avg', dir: 'desc', fmt: (v) => v.toFixed(2) },
  { key: 'first9Avg', de: 'Erste 9 Ø', en: 'First-9 avg', dir: 'desc', fmt: (v) => v.toFixed(2) },
  { key: 's180', de: '180er', en: '180s', dir: 'desc', fmt: (v) => String(v) },
  { key: 'maxCheckout', de: 'Höchstes Checkout', en: 'Highest checkout', dir: 'desc', fmt: (v) => String(v) },
  { key: 'checkoutPct', de: 'Checkout %', en: 'Checkout %', dir: 'desc', fmt: (v) => `${v.toFixed(1)} %` },
  { key: 'wins', de: 'Siege', en: 'Wins', dir: 'desc', fmt: (v) => String(v) },
  { key: 'minDarts', de: 'Bestes Leg (Darts)', en: 'Best leg (darts)', dir: 'asc', fmt: (v) => (v ? String(v) : '–') },
];

export default function AnalysisPage() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState('leaderboard');
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    api.listPlayers().then((l) => setPlayers(l.filter((p) => p.type === 'human'))).catch(() => setPlayers([]));
  }, []);

  return (
    <Box>
      <Header title={t('an.title')} onBack={() => navigate('/verwaltung')} />
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth" sx={{ mb: 2 }}>
          <Tab value="leaderboard" label={t('an.leaderboard')} />
          <Tab value="duel" label={t('an.duel')} />
          <Tab value="period" label={t('an.period')} />
        </Tabs>

        {tab === 'leaderboard' && <Leaderboard t={t} lang={lang} />}
        {tab === 'duel' && <Duel t={t} players={players} />}
        {tab === 'period' && <PeriodCompare t={t} players={players} />}
      </Container>
    </Box>
  );
}

function RangeToggle({ range, setRange, t }) {
  const label = { today: t('common.today'), '7d': t('common.7d'), '30d': t('common.30d'), all: t('common.allTime') };
  return (
    <ToggleButtonGroup exclusive size="small" value={range} onChange={(e, v) => v && setRange(v)} sx={{ mb: 2 }}>
      {RANGES.map((r) => (
        <ToggleButton key={r} value={r}>{label[r]}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function Leaderboard({ t, lang }) {
  const [range, setRange] = useState('all');
  const [metric, setMetric] = useState('average');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.listStats(range, 'game').then(setRows).catch(() => setRows([]));
  }, [range]);

  const m = METRICS.find((x) => x.key === metric) || METRICS[0];
  const ordered = useMemo(() => {
    const list = rows.filter((r) => (r.games || 0) > 0 && (m.key !== 'minDarts' || r.minDarts));
    list.sort((a, b) => (m.dir === 'asc' ? (a[m.key] || 0) - (b[m.key] || 0) : (b[m.key] || 0) - (a[m.key] || 0)));
    return list;
  }, [rows, m]);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <RangeToggle range={range} setRange={setRange} t={t} />
        <TextField select size="small" label={t('an.metric')} value={metric} onChange={(e) => setMetric(e.target.value)} sx={{ minWidth: 200 }}>
          {METRICS.map((x) => (
            <MenuItem key={x.key} value={x.key}>{lang === 'en' ? x.en : x.de}</MenuItem>
          ))}
        </TextField>
      </Stack>
      {ordered.length === 0 ? (
        <Typography color="text.secondary">{t('an.noData')}</Typography>
      ) : (
        <Stack spacing={0.75}>
          {ordered.map((r, i) => (
            <Paper key={r.playerId} variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontWeight: 800, width: 28, color: i === 0 ? ACCENT.green : 'text.secondary' }}>{i + 1}.</Typography>
              <Typography sx={{ flex: 1, fontWeight: 700 }} noWrap>{r.name}</Typography>
              <Typography sx={{ fontWeight: 800 }}>{m.fmt(r[m.key] || 0)}</Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function Duel({ t, players }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [res, setRes] = useState(null);

  useEffect(() => {
    if (a && b && a !== b) api.headToHead(a, b).then(setRes).catch(() => setRes(null));
    else setRes(null);
  }, [a, b]);

  const nameOf = (id) => (players.find((p) => p.id === Number(id)) || {}).name || '';
  const Sel = ({ label, value, setValue, exclude }) => (
    <TextField select size="small" label={label} value={value} onChange={(e) => setValue(e.target.value)} sx={{ flex: 1 }}>
      {players.filter((p) => p.id !== Number(exclude)).map((p) => (
        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Sel label={t('an.playerA')} value={a} setValue={setA} exclude={b} />
        <Sel label={t('an.playerB')} value={b} setValue={setB} exclude={a} />
      </Stack>
      {!res ? (
        <Typography color="text.secondary">{t('an.noData')}</Typography>
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography align="center" color="text.secondary" sx={{ mb: 1 }}>
            {t('an.h2hMatches')}: {res.matches}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'center', textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 800 }} noWrap>{nameOf(a)}</Typography>
            <Typography color="text.secondary">vs</Typography>
            <Typography sx={{ fontWeight: 800 }} noWrap>{nameOf(b)}</Typography>

            <Typography sx={{ fontSize: 30, fontWeight: 900, color: res.a.wins >= res.b.wins ? ACCENT.green : 'text.primary' }}>{res.a.wins}</Typography>
            <Typography variant="caption" color="text.secondary">{t('an.wins')}</Typography>
            <Typography sx={{ fontSize: 30, fontWeight: 900, color: res.b.wins >= res.a.wins ? ACCENT.green : 'text.primary' }}>{res.b.wins}</Typography>

            <Typography>{res.a.legs}</Typography>
            <Typography variant="caption" color="text.secondary">{t('an.legs')}</Typography>
            <Typography>{res.b.legs}</Typography>

            <Typography>{res.a.avg.toFixed(2)}</Typography>
            <Typography variant="caption" color="text.secondary">Ø</Typography>
            <Typography>{res.b.avg.toFixed(2)}</Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

function PeriodCompare({ t, players }) {
  const [pid, setPid] = useState('');
  const [rangeA, setRangeA] = useState('30d');
  const [rangeB, setRangeB] = useState('all');
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const label = { today: t('common.today'), '7d': t('common.7d'), '30d': t('common.30d'), all: t('common.allTime') };

  useEffect(() => {
    if (!pid) { setA(null); setB(null); return; }
    api.getPlayerStats(pid, rangeA, 'game').then(setA).catch(() => setA(null));
    api.getPlayerStats(pid, rangeB, 'game').then(setB).catch(() => setB(null));
  }, [pid, rangeA, rangeB]);

  const rows = [
    ['Spiele', (x) => x.games],
    ['Ø', (x) => (x.average || 0).toFixed(2)],
    ['Erste 9 Ø', (x) => (x.first9Avg || 0).toFixed(2)],
    ['Checkout %', (x) => `${(x.checkoutPct || 0).toFixed(1)} %`],
    ['180er', (x) => x.s180],
    ['Höchstes CO', (x) => x.maxCheckout],
    ['Bestes Leg', (x) => (x.minDarts ? x.minDarts : '–')],
  ];

  return (
    <Box>
      <TextField select size="small" fullWidth label={t('common.player')} value={pid} onChange={(e) => setPid(Number(e.target.value))} sx={{ mb: 2 }}>
        {players.map((p) => (<MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>))}
      </TextField>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField select size="small" label="A" value={rangeA} onChange={(e) => setRangeA(e.target.value)} sx={{ flex: 1 }}>
          {RANGES.map((r) => (<MenuItem key={r} value={r}>{label[r]}</MenuItem>))}
        </TextField>
        <TextField select size="small" label="B" value={rangeB} onChange={(e) => setRangeB(e.target.value)} sx={{ flex: 1 }}>
          {RANGES.map((r) => (<MenuItem key={r} value={r}>{label[r]}</MenuItem>))}
        </TextField>
      </Stack>
      {!a || !b ? (
        <Typography color="text.secondary">{t('an.noData')}</Typography>
      ) : (
        <Paper variant="outlined">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 800, py: 1 }}>{label[rangeA]}</Typography>
            <Box />
            <Typography sx={{ fontWeight: 800, py: 1 }}>{label[rangeB]}</Typography>
            {rows.map(([lbl, fn]) => (
              <Box key={lbl} sx={{ display: 'contents' }}>
                <Typography sx={{ py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>{fn(a)}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ py: 0.75, px: 1.5, borderTop: '1px solid', borderColor: 'divider', alignSelf: 'center' }}>{lbl}</Typography>
                <Typography sx={{ py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>{fn(b)}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
