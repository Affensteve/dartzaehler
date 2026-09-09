import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  IconButton,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CastIcon from '@mui/icons-material/Cast';
import Header from '../components/Header';
import BoardInput from '../components/BoardInput';
import { api } from '../api/client';
import { useT, useLang } from '../i18n';
import { ACCENT } from '../theme';

const MODE_COLOR = { killer: '#C62828', baseball: '#7A5CC7', golf: '#2E9E5B', shanghai: '#E0A400', clock: '#0288D1', halveit: '#8E24AA' };

export default function PartyGamePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const busy = useRef(false);

  const reload = useCallback(() => {
    api.getParty(id).then(setGame).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    reload();
    const es = new EventSource(`/api/party/${id}/stream`);
    es.addEventListener('state', (e) => {
      try {
        setGame(JSON.parse(e.data));
      } catch (err) {
        /* ignore */
      }
    });
    es.addEventListener('deleted', () => setError(t('pg.deleted')));
    return () => es.close();
  }, [id, reload, t]);

  const act = async (fn) => {
    if (busy.current) return;
    busy.current = true;
    try {
      setGame(await fn());
    } catch (e) {
      setError(e.message);
    } finally {
      busy.current = false;
    }
  };
  const onThrow = (dart) => act(() => api.throwParty(id, dart));
  const onMisses = async (n) => {
    for (let i = 0; i < Math.max(1, n); i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(() => api.throwParty(id, { segment: 0, multiplier: 1 }));
    }
  };
  const onUndo = () => act(() => api.undoParty(id));

  if (!game) {
    return (
      <Box>
        <Header title={t('party.title')} onBack={() => navigate('/party')} />
        <Container sx={{ py: 4 }}>
          <Typography color={error ? 'error' : 'text.secondary'}>{error || '…'}</Typography>
        </Container>
      </Box>
    );
  }

  const mode = game.partyMode;
  const color = MODE_COLOR[mode] || ACCENT.blue;
  const finished = game.status === 'finished';
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
    if (mode === 'killer') return null;
    if (mode === 'baseball') return { val: p.runs, label: t('pg.runs') };
    if (mode === 'golf') return { val: p.strokes, label: t('pg.strokes') };
    if (mode === 'clock') return { val: p.target, label: t('pg.target') };
    return { val: p.score, label: t('pg.score') };
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <Header
        title={t(`party.${mode}.name`)}
        onBack={() => navigate('/party')}
        right={
          <Tooltip title={t('pg.cast')}>
            <IconButton color="inherit" onClick={() => window.open(`/party/cast/${id}`, '_blank')} aria-label={t('pg.cast')}>
              <CastIcon />
            </IconButton>
          </Tooltip>
        }
      />

      <Box sx={{ textAlign: 'center', py: 0.75, fontWeight: 800, bgcolor: color, color: '#fff' }}>
        {roundLabel}
      </Box>

      <Container maxWidth="sm" sx={{ py: 2, flex: 1 }}>
        <Stack spacing={1}>
          {game.players.map((p, i) => {
            const activeP = i === game.currentPlayerIndex && !finished;
            const m = metric(p);
            return (
              <Paper
                key={p.id}
                variant="outlined"
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  borderColor: activeP ? color : 'divider',
                  borderWidth: activeP ? 2 : 1,
                  opacity: p.eliminated ? 0.5 : 1,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, textDecoration: p.eliminated ? 'line-through' : 'none' }} noWrap>
                    {p.name}
                    {activeP && <Chip size="small" label={t('pg.turn')} sx={{ ml: 1, height: 18, bgcolor: color, color: '#fff' }} />}
                  </Typography>
                  {mode === 'killer' && (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                      <Chip size="small" label={`${t('pg.field')} ${p.target}`} sx={{ height: 20 }} />
                      <Chip size="small" color={p.armed ? 'error' : 'default'} label={p.armed ? t('pg.armed') : t('pg.notArmed')} sx={{ height: 20 }} />
                    </Stack>
                  )}
                </Box>
                {mode === 'killer' ? (
                  <Stack direction="row" spacing={0.25} aria-label={`${p.lives} ${t('pg.lives')}`}>
                    {Array.from({ length: game.players.length && Math.max(p.lives, 0) }).map((_, k) => (
                      <FavoriteIcon key={k} sx={{ color: '#C62828', fontSize: 22 }} />
                    ))}
                    {p.lives === 0 && <Typography sx={{ fontWeight: 800, color: 'text.disabled' }}>{t('pg.out')}</Typography>}
                  </Stack>
                ) : (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 30, lineHeight: 1 }}>{m.val}</Typography>
                    <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>

        {/* aktuelle Aufnahme */}
        <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ mt: 1.5, minHeight: 30 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{ minWidth: 44, px: 1, py: 0.25, textAlign: 'center', borderRadius: 1, bgcolor: (th) => (th.palette.mode === 'dark' ? '#2b3140' : '#e2e6ec'), fontWeight: 700 }}
            >
              {game.turnDarts[i] ? game.turnDarts[i].label : ''}
            </Box>
          ))}
        </Stack>
      </Container>

      {!finished && (
        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <BoardInput onThrow={onThrow} onMisses={onMisses} onUndo={onUndo} dartsThisTurn={game.turnDarts.length} />
        </Box>
      )}

      <Dialog open={finished} onClose={() => {}}>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
            {winner ? t('pg.winner', { name: winner.name }) : t('game.over')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {(game.achievementsEarned || []).map((e) => (
            <Box key={e.dbId} sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">{e.playerName}</Typography>
              <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                {e.items.map((a) => (
                  <Tooltip key={a.id} title={(lang === 'de' ? a.desc : a.descEn) || ''} arrow>
                    <Chip size="small" label={`${a.icon} ${lang === 'de' ? a.name : a.nameEn}`} />
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button onClick={() => navigate('/party')}>{t('pg.newParty')}</Button>
          <Button variant="contained" onClick={() => navigate('/')}>{t('pg.home')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
