import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Stack, Chip } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { api } from '../api/client';
import { useT } from '../i18n';

const MODE_COLOR = { killer: '#C62828', baseball: '#7A5CC7', golf: '#2E9E5B', shanghai: '#E0A400', clock: '#0288D1', halveit: '#8E24AA' };

// Vollbild-Anzeigetafel (Cast) für Party-Spiele. Nur lesend, aktualisiert live per SSE.
export default function PartyCastPage() {
  const { id } = useParams();
  const t = useT();
  const [game, setGame] = useState(null);

  useEffect(() => {
    api.getParty(id).then(setGame).catch(() => {});
    const es = new EventSource(`/api/party/${id}/stream`);
    es.addEventListener('state', (e) => {
      try {
        setGame(JSON.parse(e.data));
      } catch (err) {
        /* ignore */
      }
    });
    return () => es.close();
  }, [id]);

  if (!game) {
    return <Box sx={{ height: '100dvh', bgcolor: '#0d1117', color: '#fff', display: 'grid', placeItems: 'center' }}>…</Box>;
  }

  const mode = game.partyMode;
  const color = MODE_COLOR[mode] || '#006EC7';
  const winner = game.players.find((p) => p.id === game.winnerId);
  const target0 = game.players[0] ? game.players[0].target : '';
  const roundLabel =
    mode === 'baseball'
      ? `${t('pg.inning')} ${game.roundNumber}/${game.roundMax}`
      : mode === 'golf'
      ? `${t('pg.hole')} ${game.roundNumber}/${game.roundMax}`
      : mode === 'shanghai'
      ? `${t('pg.round')} ${game.roundNumber}/${game.roundMax} · ${t('pg.field')} ${game.roundNumber}`
      : mode === 'halveit'
      ? `${t('pg.round')} ${game.roundNumber}/${game.roundMax} · ${t('pg.field')} ${target0}`
      : mode === 'clock'
      ? t('party.clock.name')
      : `${t('pg.round')} ${game.roundNumber}`;

  const metric = (p) => {
    if (mode === 'baseball') return { val: p.runs, label: t('pg.runs') };
    if (mode === 'golf') return { val: p.strokes, label: t('pg.strokes') };
    if (mode === 'clock') return { val: p.target, label: t('pg.target') };
    if (mode === 'killer') return null;
    return { val: p.score, label: t('pg.score') };
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#0d1117', color: '#fff', p: { xs: 2, md: 4 } }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography sx={{ fontWeight: 900, fontSize: { xs: 30, md: 46 }, color }}>{t(`party.${mode}.name`)}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 26 }, opacity: 0.85 }}>{roundLabel}</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: game.players.length > 2 ? '1fr 1fr' : '1fr' }, gap: 2, maxWidth: 1100, mx: 'auto' }}>
        {game.players.map((p, i) => {
          const activeP = i === game.currentPlayerIndex && game.status !== 'finished';
          const m = metric(p);
          return (
            <Box
              key={p.id}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 2,
                bgcolor: activeP ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: '2px solid',
                borderColor: activeP ? color : 'transparent',
                opacity: p.eliminated ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 26, md: 38 }, textDecoration: p.eliminated ? 'line-through' : 'none' }} noWrap>
                  {p.name}
                </Typography>
                {mode === 'killer' && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip label={`${t('pg.field')} ${p.target}`} sx={{ color: '#fff', borderColor: '#fff' }} variant="outlined" />
                    {p.armed && <Chip color="error" label={t('pg.armed')} />}
                  </Stack>
                )}
              </Box>
              {mode === 'killer' ? (
                <Stack direction="row" spacing={0.5}>
                  {Array.from({ length: Math.max(p.lives, 0) }).map((_, k) => (
                    <FavoriteIcon key={k} sx={{ color: '#C62828', fontSize: { xs: 30, md: 44 } }} />
                  ))}
                  {p.lives === 0 && <Typography sx={{ fontWeight: 800, opacity: 0.6 }}>{t('pg.out')}</Typography>}
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: 46, md: 72 }, lineHeight: 1 }}>{m.val}</Typography>
                  <Typography sx={{ opacity: 0.7 }}>{m.label}</Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {winner && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <EmojiEventsIcon sx={{ fontSize: 60, color }} />
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 30, md: 48 } }}>{t('pg.winner', { name: winner.name })}</Typography>
        </Box>
      )}
    </Box>
  );
}
