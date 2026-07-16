import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Alert, CircularProgress, Paper, Chip, Stack } from '@mui/material';
import Header from '../components/Header';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT, useLang } from '../i18n';

const CAT_COLOR = {
  Siege: '#2E9E4F',
  Scoring: '#F59E0B',
  Checkout: '#3B82F6',
  Meilensteine: '#8B5CF6',
  Training: '#14B8A6',
  Kurios: '#EC4899',
  Team: '#0EA5E9',
};

// Rundes Achievement-Bild: farbige Medaille mit Emoji; gesperrt = ausgegraut.
function Badge({ icon, color, unlocked }) {
  return (
    <Box
      sx={{
        width: 46,
        height: 46,
        borderRadius: '50%',
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        fontSize: 24,
        lineHeight: 1,
        background: unlocked
          ? `radial-gradient(circle at 35% 30%, ${color}, ${color} 60%, rgba(0,0,0,0.25))`
          : 'rgba(128,128,128,0.15)',
        boxShadow: unlocked ? `0 0 0 2px rgba(255,255,255,0.25) inset` : 'none',
        filter: unlocked ? 'none' : 'grayscale(1)',
        opacity: unlocked ? 1 : 0.45,
      }}
    >
      {icon}
    </Box>
  );
}

export default function AchievementsPage() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAchievements()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    if (!data) return [];
    const by = new Map();
    for (const a of data.catalog) {
      if (!by.has(a.cat)) by.set(a.cat, []);
      by.get(a.cat).push(a);
    }
    return [...by.entries()];
  }, [data]);

  const earnedCount = data ? data.catalog.filter((a) => (data.earners[a.id] || []).length > 0).length : 0;

  return (
    <Box>
      <Header title={t('ach.title')} onBack={() => navigate(-1)} />
      <Container maxWidth="md" sx={{ py: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading || !data ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>{!error && <CircularProgress />}</Box>
        ) : (
          <>
            <Typography color="text.secondary" align="center" sx={{ mb: 2 }}>
              {t('ach.progress', { n: earnedCount, total: data.catalog.length })}
            </Typography>
            {groups.map(([cat, list]) => (
              <Box key={cat} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                  {t('ach.cat.' + cat)}
                </Typography>
                <Stack spacing={1}>
                  {list.map((a) => {
                    const earners = data.earners[a.id] || [];
                    const unlocked = earners.length > 0;
                    return (
                      <Paper
                        key={a.id}
                        variant="outlined"
                        sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start', borderColor: unlocked ? ACCENT.green : undefined }}
                      >
                        <Badge icon={a.icon} color={CAT_COLOR[a.cat] || ACCENT.green} unlocked={unlocked} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }}>{lang === 'en' ? a.nameEn : a.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {lang === 'en' ? a.descEn : a.desc}
                          </Typography>
                          {earners.length > 0 ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                              {earners.map((e) => (
                                <Chip
                                  key={e.playerId}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  label={e.name}
                                  onClick={() => navigate(`/players/${e.playerId}`)}
                                />
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                              {t('ach.none')}
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </>
        )}
      </Container>
    </Box>
  );
}
