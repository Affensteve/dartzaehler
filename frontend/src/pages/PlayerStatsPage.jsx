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
  LinearProgress,
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
import DartboardHeatmap from '../components/DartboardHeatmap';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT, useLang } from '../i18n';

// DB-Zeitstempel werden als UTC gespeichert (SQLite datetime('now')). Als UTC
// interpretieren und in lokaler Zeit als TT.MM.JJJJ HH:MM (24h) ausgeben.
function fmtDateTime(s) {
  if (!s) return '';
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(hasTz ? iso : iso + 'Z');
  if (isNaN(d.getTime())) return s;
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
  const [achievements, setAchievements] = useState({ earned: [], progress: [] });
  const [rating, setRating] = useState(null);
  const [sectorHeat, setSectorHeat] = useState(null);

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
    api
      .getPlayerAchievements(id)
      .then((r) => setAchievements({ earned: (r && r.earned) || [], progress: (r && r.progress) || [] }))
      .catch(() => setAchievements({ earned: [], progress: [] }));
  }, [id]);

  useEffect(() => {
    api.getPlayerRating(id).then(setRating).catch(() => setRating(null));
  }, [id]);

  // Treffer-Heatmap (nur Spiel/Turnier): Sektor-Treffer je Zahl aggregieren.
  useEffect(() => {
    if (area !== 'game') { setSectorHeat(null); return; }
    const dartId = dartFilter === 'all' ? null : dartFilter;
    api
      .playerSectors(id, 'game', range)
      .then((list) => {
        const rows = dartId != null ? list.filter((d) => d.dartId === dartId) : list;
        const values = {};
        let bull = 0;
        for (const d of rows)
          for (const [k, c] of Object.entries(d.sectors || {})) {
            if (k === '0') continue;
            const num = k[0] === 'D' || k[0] === 'T' ? parseInt(k.slice(1), 10) : parseInt(k, 10);
            if (num === 25) bull += c;
            else if (num >= 1 && num <= 20) values[num] = (values[num] || 0) + c;
          }
        const total = bull + Object.values(values).reduce((a, b) => a + b, 0);
        setSectorHeat({ values, bull, total });
      })
      .catch(() => setSectorHeat(null));
  }, [id, area, range, dartFilter]);

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
                const [sectorsByDart, dbl, checkoutTable] = await Promise.all([
                  api.playerSectors(id, area, range).catch(() => []),
                  api.getPlayerDoubles(id).catch(() => ({ list: [] })),
                  api.getCheckoutTable(id).catch(() => null),
                ]);
                exportPlayerReport({
                  player: row.name,
                  stats: row,
                  timeline,
                  rangeLabel: (RANGES.find((r) => r.key === range) || {}).label || '',
                  t,
                  lang,
                  sectorsByDart,
                  doubles: (dbl && dbl.list) || [],
                  checkoutTable,
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

            {rating && rating.games > 0 && (
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Chip
                  color="primary"
                  sx={{ fontWeight: 700 }}
                  label={`${t('stats.elo')}: ${rating.elo} · ${rating.wins}–${rating.losses} · Peak ${rating.peak}`}
                />
              </Box>
            )}

            {achievements.earned.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <MilitaryTechIcon fontSize="small" sx={{ color: ACCENT.double }} /> {t('stats.badges')} ({achievements.earned.length})
                </Typography>
                <Stack spacing={0.75}>
                  {achievements.earned.map((a) => (
                    <Box
                      key={a.id}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75 }}
                    >
                      <Box component="span" sx={{ fontSize: 22, lineHeight: 1 }}>{a.icon}</Box>
                      <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                        {lang === 'de' ? a.name : a.nameEn}
                        {a.field ? ` (${a.field === 25 ? 'Bull' : a.field})` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {fmtDateTime(a.earnedAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {achievements.progress.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1 }}>
                  {t('stats.inProgress')}
                </Typography>
                <Stack spacing={0.75}>
                  {achievements.progress.map((a) => (
                    <Box
                      key={a.id}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75, opacity: 0.85 }}
                    >
                      <Box component="span" sx={{ fontSize: 22, lineHeight: 1, filter: 'grayscale(1)', opacity: 0.6 }}>{a.icon}</Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }} noWrap>{lang === 'de' ? a.name : a.nameEn}</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={a.pct}
                          sx={{ height: 6, borderRadius: 3, my: 0.5 }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {a.cur}/{a.target}
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
                {sectorHeat && sectorHeat.total > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" align="center" sx={{ fontWeight: 800, mb: 1 }}>
                      {t('stats.hitHeatmap')}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <DartboardHeatmap values={sectorHeat.values} bull={sectorHeat.bull} base={ACCENT.green} size={260} />
                    </Box>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
