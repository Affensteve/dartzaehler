import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  TextField,
  MenuItem,
  IconButton,
  Chip,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Header from '../components/Header';
import Dartboard from '../components/training/Dartboard';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT, useLang } from '../i18n';

const RINGS = ['single', 'double', 'triple', 'bull'];
const WEEKDAYS_DE = ['—', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAYS_EN = ['—', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RING_LABEL = { single: 'S', double: 'D', triple: 'T', bull: '' };
const todayWeekday = () => ((new Date().getDay() + 6) % 7) + 1; // Mo=1 … So=7

function targetLabel(d) {
  if (d.ring === 'bull') return 'Bull';
  return `${RING_LABEL[d.ring] || ''}${d.field}`;
}
const emptyForm = { id: null, name: '', field: 20, ring: 'triple', rounds: 10, goal: 15, weekday: 0 };

export default function TrainingBuilderPage() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const WD = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_DE;

  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState('');
  const [drills, setDrills] = useState([]);
  const [bests, setBests] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');
  const [playing, setPlaying] = useState(null); // { drill, round, hits }

  useEffect(() => {
    Promise.all([api.listPlayers().catch(() => []), api.getSettings().catch(() => ({}))]).then(([list, settings]) => {
      const humans = list.filter((p) => p.type === 'human');
      setPlayers(humans);
      const stored = Number(settings['training.playerId']);
      setPlayerId(humans.some((h) => h.id === stored) ? stored : humans[0] ? humans[0].id : '');
    });
  }, []);

  const reload = (pid) => {
    if (!pid) return;
    api.listDrills(pid).then(setDrills).catch(() => setDrills([]));
    api.trainingBests(pid).then(setBests).catch(() => setBests({}));
  };
  useEffect(() => {
    reload(playerId);
  }, [playerId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!playerId) return;
    try {
      if (form.id) await api.updateDrill(form.id, form);
      else await api.createDrill({ playerId, ...form });
      setForm(emptyForm);
      reload(playerId);
      setMsg(t('common.save'));
    } catch (e) {
      setMsg(e.message);
    }
  };
  const edit = (d) => setForm({ id: d.id, name: d.name, field: d.field, ring: d.ring, rounds: d.rounds, goal: d.goal, weekday: d.weekday });
  const del = async (d) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('tb.deleteConfirm'))) return;
    await api.deleteDrill(d.id).catch(() => {});
    if (form.id === d.id) setForm(emptyForm);
    reload(playerId);
  };

  // --- Play flow (generisch: N Runden × 3 Darts aufs Ziel, Treffer zählen) ---
  const start = (d) => setPlaying({ drill: d, round: 1, hits: 0 });
  const pick = async (h) => {
    if (!playing) return;
    const nh = playing.hits + h;
    if (playing.round >= playing.drill.rounds) {
      try {
        await api.trainingRecord(playerId, `custom_${playing.drill.id}`, nh, { of: playing.drill.rounds * 3, goal: playing.drill.goal });
      } catch {
        /* ignore */
      }
      const reached = playing.drill.goal > 0 && nh >= playing.drill.goal;
      setPlaying(null);
      reload(playerId);
      setMsg(reached ? t('tb.goalReached') : `${t('tb.best')}: ${nh}`);
    } else {
      setPlaying({ ...playing, round: playing.round + 1, hits: nh });
    }
  };

  const today = todayWeekday();
  const planToday = drills.filter((d) => d.weekday === today);

  const DrillCard = ({ d }) => {
    const best = bests[`custom_${d.id}`] ?? null;
    const pct = d.goal > 0 && best != null ? Math.min(100, Math.round((best / d.goal) * 100)) : 0;
    return (
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip label={targetLabel(d)} sx={{ fontWeight: 800, bgcolor: ACCENT.green, color: '#fff' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>{d.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {d.rounds} {t('tb.rounds')} · {t('tb.goal')}: {d.goal} · {d.weekday ? WD[d.weekday] : t('tb.noDay')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => start(d)} aria-label="Start" sx={{ color: ACCENT.green }}><PlayArrowIcon /></IconButton>
          <IconButton size="small" onClick={() => edit(d)} aria-label={t('common.edit')}><EditIcon /></IconButton>
          <IconButton size="small" onClick={() => del(d)} aria-label={t('common.delete')}><DeleteIcon /></IconButton>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 84 }}>
            {t('tb.best')}: <b>{best != null ? best : '–'}</b>
          </Typography>
          {d.goal > 0 && (
            <Box sx={{ flex: 1 }}>
              <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 1 }} color={pct >= 100 ? 'success' : 'primary'} />
            </Box>
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Box>
      <Header title={t('tb.title')} onBack={() => navigate('/training')} />
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <TextField
          select
          fullWidth
          size="small"
          label={t('common.player')}
          value={playerId}
          onChange={(e) => setPlayerId(Number(e.target.value))}
          sx={{ mb: 2 }}
        >
          {players.map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
          ))}
        </TextField>

        {/* Formular: neue/bearbeitete Übung */}
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{form.id ? t('common.edit') : t('tb.new')}</Typography>
          <Stack spacing={1.5}>
            <TextField label={t('tb.name')} value={form.name} onChange={(e) => set({ name: e.target.value })} size="small" fullWidth />
            <Stack direction="row" spacing={1}>
              <TextField select label={t('tb.ring')} value={form.ring} onChange={(e) => set({ ring: e.target.value })} size="small" sx={{ flex: 1 }}>
                {RINGS.map((r) => (
                  <MenuItem key={r} value={r}>{r === 'bull' ? 'Bull' : t(`tm.${r}`)}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('tb.field')}
                value={form.ring === 'bull' ? 25 : form.field}
                onChange={(e) => set({ field: Number(e.target.value) })}
                size="small"
                sx={{ flex: 1 }}
                disabled={form.ring === 'bull'}
              >
                {(form.ring === 'bull' ? [25] : Array.from({ length: 20 }, (_, i) => i + 1)).map((n) => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField type="number" label={t('tb.rounds')} value={form.rounds} onChange={(e) => set({ rounds: e.target.value })} size="small" sx={{ flex: 1 }} inputProps={{ min: 1, max: 30 }} />
              <TextField type="number" label={t('tb.goal')} value={form.goal} onChange={(e) => set({ goal: e.target.value })} size="small" sx={{ flex: 1 }} inputProps={{ min: 0 }} />
              <TextField select label={t('tb.weekday')} value={form.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })} size="small" sx={{ flex: 1 }}>
                {WD.map((w, i) => (
                  <MenuItem key={i} value={i}>{i === 0 ? t('tb.noDay') : w}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={submit} disabled={!playerId || !form.name.trim()}>
                {form.id ? t('common.save') : t('tb.new')}
              </Button>
              {form.id && <Button onClick={() => setForm(emptyForm)}>{t('common.cancel')}</Button>}
            </Stack>
          </Stack>
        </Paper>

        {/* Wochenplan: heute */}
        {planToday.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{t('tb.plan')} · {t('tb.today')}</Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {planToday.map((d) => <DrillCard key={`today-${d.id}`} d={d} />)}
            </Stack>
            <Divider sx={{ mb: 2 }} />
          </>
        )}

        {/* Alle Übungen */}
        {drills.length === 0 ? (
          <Typography color="text.secondary">{t('tb.none')}</Typography>
        ) : (
          <Stack spacing={1}>
            {drills.map((d) => <DrillCard key={d.id} d={d} />)}
          </Stack>
        )}
      </Container>

      {/* Play-Dialog */}
      <Dialog open={Boolean(playing)} onClose={() => setPlaying(null)} maxWidth="xs" fullWidth>
        {playing && (
          <>
            <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>
              {playing.drill.name} · {targetLabel(playing.drill)}
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'center' }}>
              <Stack spacing={1.5} alignItems="center">
                <Dartboard numbers={playing.drill.ring === 'bull' ? [25] : [playing.drill.field]} ring={playing.drill.ring === 'single' ? 'number' : playing.drill.ring} size={150} />
                <Typography color="text.secondary">
                  {t('tm.roundOf', { r: playing.round, n: playing.drill.rounds })} · {t('tb.best')}: {playing.hits}
                </Typography>
                <Typography variant="body2" color="text.secondary">{t('tb.hitsThisRound')}</Typography>
                <Stack direction="row" spacing={1}>
                  {[0, 1, 2, 3].map((h) => (
                    <Button key={h} variant={h === 0 ? 'outlined' : 'contained'} size="large" onClick={() => pick(h)} sx={{ minWidth: 56, fontWeight: 800 }}>{h}</Button>
                  ))}
                </Stack>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
              <Button onClick={() => setPlaying(null)}>{t('common.cancel')}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={Boolean(msg)} autoHideDuration={2500} onClose={() => setMsg('')} message={msg} />
    </Box>
  );
}
