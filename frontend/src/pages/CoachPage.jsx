import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Button,
  Chip,
  Alert,
  TextField,
  MenuItem,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Header from '../components/Header';
import { api } from '../api/client';
import { useT, useLang } from '../i18n';
import { TRAINING_MODES } from '../components/training/modes';

const LEVEL_COLOR = { hoch: 'error', mittel: 'warning', niedrig: 'success' };
const SEV_BAR = { hoch: 82, mittel: 50, niedrig: 22 };

export default function CoachPage() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const [searchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  // Vorauswahl aus der Auswertung (?player=…) übernehmen.
  const [pid, setPid] = useState(searchParams.get('player') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listPlayers()
      .then((list) => {
        const humans = list.filter((p) => p.type === 'human');
        setPlayers(humans);
        if (humans.length && !pid) setPid(String(humans[0].id));
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    setError(null);
    api
      .getCoach(pid)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pid]);

  const modeName = (id) => {
    const m = TRAINING_MODES.find((x) => x.id === id);
    return m ? (lang === 'de' ? m.name : m.nameEn) : id;
  };

  const startDrill = (mode) => navigate(`/training/play/${mode}`);

  const WeaknessCard = ({ w, highlight }) => (
    <Paper variant="outlined" sx={{ p: 1.5, borderColor: highlight ? 'primary.main' : undefined }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography sx={{ fontWeight: 800, flex: 1 }}>{t(w.titleKey)}</Typography>
        <Chip size="small" label={w.metric} variant="outlined" />
        <Chip size="small" color={LEVEL_COLOR[w.level] || 'default'} label={t('coach.level.' + w.level)} />
      </Stack>
      <LinearProgress
        variant="determinate"
        value={SEV_BAR[w.level] || 0}
        color={LEVEL_COLOR[w.level] || 'primary'}
        sx={{ height: 6, borderRadius: 3, mb: 1 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t(w.rationaleKey, w.vars)}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <Typography variant="caption" color="text.secondary">
          {t('coach.recommend', { mode: modeName(w.mode) })}
        </Typography>
        <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={() => startDrill(w.mode)}>
          {t('coach.startEx')}
        </Button>
      </Stack>
    </Paper>
  );

  const TrendIcon = data && data.trend
    ? data.trend.direction === 'up'
      ? TrendingUpIcon
      : data.trend.direction === 'down'
      ? TrendingDownIcon
      : TrendingFlatIcon
    : null;
  const trendKey = data && data.trend
    ? data.trend.direction === 'up'
      ? 'coach.trendUp'
      : data.trend.direction === 'down'
      ? 'coach.trendDown'
      : 'coach.trendFlat'
    : null;

  const planBlock =
    data && data.plan && data.plan.length > 0 ? (
      <Box>
        <Typography variant="overline" color="text.secondary">{t('coach.planTitle')}</Typography>
        <Stack spacing={1}>
          {data.plan.map((d) => (
            <Paper
              key={d.id}
              variant="outlined"
              sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderColor: d.reached ? 'success.main' : undefined }}
            >
              <Typography sx={{ flex: 1, fontWeight: 700 }} noWrap>{d.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('tb.best')}: {d.best != null ? d.best : '\u2013'}{d.goal ? ` / ${d.goal}` : ''}
              </Typography>
              {d.reached && <EmojiEventsIcon color="success" fontSize="small" />}
            </Paper>
          ))}
        </Stack>
      </Box>
    ) : null;

  return (
    <Box>
      <Header title={t('coach.title')} onBack={() => navigate(-1)} />
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <TextField
          select
          fullWidth
          size="small"
          label={t('coach.pick')}
          value={pid}
          onChange={(e) => setPid(e.target.value)}
          sx={{ mb: 2 }}
        >
          {players.map((p) => (
            <MenuItem key={p.id} value={String(p.id)}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : !data ? null : !data.hasData ? (
          <Stack spacing={2}>
            <Alert severity="info">{t('coach.noData', { n: data.minGames })}</Alert>
            {planBlock}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {planBlock}
            {data.trend && trendKey && (
              <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                {TrendIcon && <TrendIcon color={data.trend.direction === 'down' ? 'error' : 'success'} />}
                <Typography variant="body2">
                  {t(trendKey, { from: data.trend.fromAvg, to: data.trend.toAvg })}
                </Typography>
              </Paper>
            )}

            {data.focus && (
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <FitnessCenterIcon fontSize="small" /> {t('coach.focus')}
                </Typography>
                <WeaknessCard w={data.focus} highlight />
              </Box>
            )}

            {data.strength && (
              <Paper variant="outlined" sx={{ p: 1.5, borderColor: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEventsIcon color="success" />
                <Typography variant="body2">
                  <b>{t('coach.strength')}:</b> {t(data.strength.titleKey)} ({data.strength.metric})
                </Typography>
              </Paper>
            )}

            <Box>
              <Typography variant="overline" color="text.secondary">
                {t('coach.weaknesses')}
              </Typography>
              <Stack spacing={1.5}>
                {data.weaknesses.map((w) => (
                  <WeaknessCard key={w.id} w={w} />
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
