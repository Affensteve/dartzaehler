import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, ButtonBase, Stack, TextField, MenuItem, Chip, Avatar } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import InsightsIcon from '@mui/icons-material/Insights';
import HistoryIcon from '@mui/icons-material/History';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import Header from '../components/Header';
import { api } from '../api/client';
import { CARD_CUT } from '../theme';
import { useT, useLang } from '../i18n';

// Relative Zeit („vor 3 Tagen") aus einem UTC-Zeitstempel.
function relTime(ts, lang) {
  if (!ts) return null;
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (lang === 'en') return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return days <= 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`;
}

export default function AuswertungPage() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();

  const [players, setPlayers] = useState([]);
  const [pid, setPid] = useState(() => localStorage.getItem('ausw.player') || '');
  const [metrics, setMetrics] = useState({});
  const [achTotal, setAchTotal] = useState(0);

  useEffect(() => {
    api.listPlayers().then((l) => setPlayers((l || []).filter((p) => p.type !== 'bot'))).catch(() => {});
    api.getAchievements().then((r) => setAchTotal(((r && r.catalog) || []).length)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pid) {
      setMetrics({});
      return;
    }
    localStorage.setItem('ausw.player', String(pid));
    let alive = true;
    const m = {};
    Promise.allSettled([
      api.getPlayerStats(pid, 'all', 'game'),
      api.getPlayerAchievements(pid),
      api.listMatches('all', 'all', pid),
    ]).then(([st, ac, mh]) => {
      if (!alive) return;
      if (st.status === 'fulfilled' && st.value) {
        const avg = st.value.average ?? st.value.avg;
        if (avg != null) m.avg = Math.round(avg * 100) / 100;
        if (st.value.games != null) m.games = st.value.games;
      }
      if (ac.status === 'fulfilled' && ac.value) m.ach = ((ac.value.earned) || []).length;
      if (mh.status === 'fulfilled' && Array.isArray(mh.value) && mh.value.length) {
        m.last = relTime(mh.value[0].finishedAt || mh.value[0].finished_at, lang);
      }
      setMetrics(m);
    });
    return () => {
      alive = false;
    };
  }, [pid, lang]);

  const player = useMemo(() => players.find((p) => String(p.id) === String(pid)), [players, pid]);

  const cards = [
    { key: 'stats', icon: <BarChartIcon />, label: t('home.stats'), desc: t('ausw.statsDesc'), color: '#006EC7', to: pid ? `/players/${pid}` : '/stats', metric: metrics.avg != null ? `Ø ${metrics.avg}` : null },
    { key: 'analysis', icon: <InsightsIcon />, label: t('an.open'), desc: t('ausw.analysisDesc'), color: '#00A3A3', to: '/analysis', metric: metrics.games != null ? `${metrics.games} ${t('league.games')}` : null },
    { key: 'history', icon: <HistoryIcon />, label: t('home.history'), desc: t('ausw.historyDesc'), color: '#7A5CC7', to: '/history', metric: metrics.last || null },
    { key: 'ach', icon: <MilitaryTechIcon />, label: t('home.achievements'), desc: t('ausw.achDesc'), color: '#E0A400', to: '/achievements', metric: metrics.ach != null && achTotal ? `${metrics.ach}/${achTotal}` : null },
    { key: 'coach', icon: <FitnessCenterIcon />, label: t('coach.title'), desc: t('ausw.coachDesc'), color: '#2E9E5B', to: pid ? `/coach?player=${pid}` : '/coach', metric: null },
  ];

  return (
    <Box>
      <Header title={t('ausw.title')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>{t('ausw.subtitle')}</Typography>

        {players.length > 0 && (
          <TextField
            select
            fullWidth
            size="small"
            label={t('ausw.player')}
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            sx={{ mb: 2 }}
          >
            <MenuItem value="">{t('ausw.allPlayers')}</MenuItem>
            {players.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar src={p.photo || undefined} sx={{ width: 22, height: 22, fontSize: 12 }}>
                    {(p.name || '?').slice(0, 1)}
                  </Avatar>
                  {p.name}
                </Stack>
              </MenuItem>
            ))}
          </TextField>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          {cards.map((c) => (
            <ButtonBase
              key={c.key}
              onClick={() => navigate(c.to)}
              aria-label={c.label + (c.metric ? ` – ${c.metric}` : '')}
              sx={{ textAlign: 'left', borderRadius: 1, display: 'block' }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  height: '100%',
                  clipPath: CARD_CUT,
                  transition: 'border-color 120ms ease, transform 120ms ease',
                  '&:hover': { borderColor: c.color, transform: 'translateY(-2px)' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', bgcolor: c.color, flexShrink: 0 }}>
                    {c.icon}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Typography sx={{ fontWeight: 800 }} noWrap>{c.label}</Typography>
                      {player && c.metric && (
                        <Chip size="small" label={c.metric} sx={{ height: 20, fontWeight: 700 }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25 }}>
                      {c.desc}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </ButtonBase>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
