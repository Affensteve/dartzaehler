import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Stack,
  Chip,
  Button,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import Header from '../components/Header';
import { StatSections } from '../components/statsView';
import TrainingStatsView from '../components/training/TrainingStatsView';
import TimelineChart from '../components/TimelineChart';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT, useLang } from '../i18n';

function fmtDate(s) {
  if (!s) return '';
  return s.replace('T', ' ').slice(0, 16);
}

function CoRanges({ cr, t }) {
  const keys = ['2-40', '41-70', '71-100', '101-170', 'pressure'];
  if (!cr || !keys.some((k) => cr[k] && cr[k].attempts > 0)) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1 }}>{t('stats.coRanges')}</Typography>
      <Stack spacing={0.75}>
        {keys.map((k) => {
          const e = cr[k] || { hits: 0, attempts: 0, pct: 0 };
          const pressure = k === 'pressure';
          return (
            <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ width: 200, fontWeight: pressure ? 800 : 400 }} noWrap>
                {pressure ? t('stats.pressure') : `Rest ${k}`}
              </Typography>
              <Box sx={{ flex: 1, height: 14, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                <Box sx={{ width: `${Math.min(100, e.pct || 0)}%`, height: '100%', bgcolor: pressure ? ACCENT.double : ACCENT.green }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ width: 104, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {e.hits}/{e.attempts} · {(e.pct || 0).toFixed(0)} %
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

export default function PlayerStatsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const RANGES = [
    { key: 'today', label: t('common.today') },
    { key: '7d', label: t('common.7d') },
    { key: '30d', label: t('common.30d') },
    { key: 'all', label: t('common.allTime') },
  ];
  const [range, setRange] = useState('all');
  const [area, setArea] = useState('game');
  const [dartFilter, setDartFilter] = useState('all'); // 'all' oder dartId
  const [darts, setDarts] = useState([]);
  const [trainingStats, setTrainingStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState([]);

  // Benutzte Pfeile für die Filter-Chips (je Bereich); Filter zurücksetzen bei Wechsel.
  useEffect(() => {
    setDartFilter('all');
    api.playerDarts(id, area).then(setDarts).catch(() => setDarts([]));
  }, [id, area]);

  useEffect(() => {
    if (area !== 'training') { setTrainingStats(null); return; }
    api.trainingStats(id, range).then(setTrainingStats).catch(() => setTrainingStats(null));
  }, [id, area, range]);

  useEffect(() => {
    setLoading(true);
    const dartId = dartFilter === 'all' ? null : dartFilter;
    api
      .getPlayerStats(id, range, area, dartId)
      .then(setRow)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, range, area, dartFilter]);

  useEffect(() => {
    const dartId = dartFilter === 'all' ? null : dartFilter;
    api.playerTimeline(id, range, area, dartId).then(setTimeline).catch(() => setTimeline([]));
  }, [id, range, area, dartFilter]);

  useEffect(() => {
    api.getPlayerAchievements(id).then(setAchievements).catch(() => setAchievements([]));
  }, [id]);

  const dartChips = darts.filter((d) => d.dartId != null);

  return (
    <Box>
      <Header title={row ? row.name : 'Spieler'} subtitle={t('stats.subtitle')} onBack={() => navigate(-1)} />
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <ToggleButtonGroup exclusive size="small" value={area} onChange={(e, v) => v && setArea(v)}>
            <ToggleButton value="game">{t('common.gameTournament')}</ToggleButton>
            <ToggleButton value="training">{t('common.training')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <ToggleButtonGroup exclusive size="small" value={range} onChange={(e, v) => v && setRange(v)}>
            {RANGES.map((r) => (
              <ToggleButton key={r.key} value={r.key}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => navigate(`/history?player=${id}`)}>
            {t('home.history')}
          </Button>
          {row && area === 'game' && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={async () => {
                const { exportPlayerReport } = await import('../statsReport');
                exportPlayerReport({
                  player: row.name,
                  stats: row,
                  timeline,
                  rangeLabel: (RANGES.find((r) => r.key === range) || {}).label || '',
                  t,
                });
              }}
            >
              {t('stats.pdfReport')}
            </Button>
          )}
        </Stack>

        {dartChips.length > 0 && (
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip
              label={t('sv.allDarts')}
              size="small"
              color={dartFilter === 'all' ? 'primary' : 'default'}
              variant={dartFilter === 'all' ? 'filled' : 'outlined'}
              onClick={() => setDartFilter('all')}
            />
            {dartChips.map((d) => (
              <Chip
                key={d.dartId}
                label={`${d.name} · ${d.weightGrams} g (${d.games})`}
                size="small"
                color={dartFilter === d.dartId ? 'primary' : 'default'}
                variant={dartFilter === d.dartId ? 'filled' : 'outlined'}
                onClick={() => setDartFilter(d.dartId)}
              />
            ))}
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading || !row ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>{!error && <CircularProgress />}</Box>
        ) : (
          <>
            <Typography
              variant="h5"
              align="center"
              sx={{ fontWeight: 800, mb: 2, color: row.type === 'bot' ? ACCENT.bot : 'text.primary' }}
            >
              {row.name}
            </Typography>

            <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1 }}>
              {t('stats.progressWeek')}
            </Typography>
            <Box sx={{ mb: 3 }}>
              <TimelineChart data={timeline} />
            </Box>

            {achievements.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <MilitaryTechIcon fontSize="small" sx={{ color: ACCENT.double }} /> {t('stats.badges')} ({achievements.length})
                </Typography>
                <Stack spacing={0.75}>
                  {achievements.map((a) => (
                    <Box
                      key={a.id}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75 }}
                    >
                      <Box component="span" sx={{ fontSize: 22, lineHeight: 1 }}>{a.icon}</Box>
                      <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                        {lang === 'de' ? a.name : a.nameEn}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {fmtDate(a.earnedAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {area === 'training' ? (
              <>
                <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1 }}>
                  {t('stats.trainingModes')}
                </Typography>
                <TrainingStatsView stats={trainingStats} />
                {row.games > 0 && (
                  <>
                    <Typography variant="h6" align="center" sx={{ fontWeight: 800, mt: 3, mb: 1 }}>
                      {t('stats.x01countup')}
                    </Typography>
                    <StatSections rows={[row]} showRank={false} area={area} range={range} externalDart={dartFilter} />
                  </>
                )}
              </>
            ) : (
              <>
                {row.games === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ mb: 2 }}>
                    {t('stats.noGameData', { dart: dartFilter !== 'all' ? t('stats.forThisDart') : '' })}
                  </Typography>
                ) : null}
                <StatSections rows={[row]} showRank={false} area={area} range={range} externalDart={dartFilter} />
                <CoRanges cr={row.checkoutRanges} t={t} />
              </>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
