import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  Chip,
  TextField,
  MenuItem,
  Collapse,
  Alert,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import TuneIcon from '@mui/icons-material/Tune';
import Header from '../components/Header';
import Dartboard from '../components/training/Dartboard';
import { TRAINING_MODES, localizeMode } from '../components/training/modes';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT, useLang } from '../i18n';

export default function TrainingPage() {
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const [players, setPlayers] = useState([]);
  const [darts, setDarts] = useState([]);
  const [playerId, setPlayerId] = useState('');
  const [dartId, setDartId] = useState('');
  const [bests, setBests] = useState({});
  const [openId, setOpenId] = useState(TRAINING_MODES[0].id);
  const initialDart = useRef(null); // aus den gespeicherten Einstellungen

  // Initial: Spieler, Pfeile und gespeicherte Auswahl laden.
  useEffect(() => {
    Promise.all([
      api.listPlayers().catch(() => []),
      api.listDarts().catch(() => []),
      api.getSettings().catch(() => ({})),
    ]).then(([list, dartList, settings]) => {
      const humans = list.filter((p) => p.type === 'human');
      setPlayers(humans);
      setDarts(dartList);
      const storedP = Number(settings['training.playerId']);
      setPlayerId(humans.some((h) => h.id === storedP) ? storedP : humans[0] ? humans[0].id : '');
      const storedD = Number(settings['training.dartId']);
      initialDart.current = dartList.some((d) => d.id === storedD) ? storedD : null;
    });
  }, []);

  // Pfeil-Vorauswahl + Bestwerte je gewähltem Spieler.
  useEffect(() => {
    if (!playerId) return;
    const p = players.find((x) => x.id === playerId);
    if (initialDart.current && darts.some((d) => d.id === initialDart.current)) setDartId(initialDart.current);
    else if (p && p.dartId) setDartId(p.dartId);
    else if (darts.length) setDartId(darts[0].id);
    initialDart.current = null;
    api.trainingBests(playerId).then(setBests).catch(() => setBests({}));
  }, [playerId, players, darts]);

  // Auswahl persistieren (geräteweit in der DB).
  const changePlayer = (id) => {
    setPlayerId(id);
    api.setSetting('training.playerId', id).catch(() => {});
  };
  const changeDart = (id) => {
    setDartId(id);
    api.setSetting('training.dartId', id).catch(() => {});
  };

  const canStart = Boolean(playerId);
  const start = (mode) => {
    if (!canStart) return;
    navigate(`/training/play/${mode}?player=${playerId}&dart=${dartId || ''}`);
  };

  return (
    <Box>
      <Header title={t('train.title')} onBack={() => navigate('/')} />
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Button variant="outlined" startIcon={<TuneIcon />} onClick={() => navigate('/training/builder')} sx={{ mb: 2 }}>
          {t('tb.open')}
        </Button>
        {players.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('train.needPlayer')}
          </Alert>
        ) : (
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <TextField select size="small" label={t('psl.player')} value={playerId} onChange={(e) => changePlayer(Number(e.target.value))} sx={{ minWidth: 160 }}>
              {players.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>
            {darts.length > 0 && (
              <TextField select size="small" label={t('common.dart')} value={darts.some((d) => d.id === dartId) ? dartId : ''} onChange={(e) => changeDart(Number(e.target.value))} sx={{ minWidth: 160 }}>
                {darts.map((d) => (
                  <MenuItem key={d.id} value={d.id}>{d.name} · {d.weightGrams} g</MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {TRAINING_MODES.map((raw) => {
            const m = localizeMode(raw, lang);
            const open = openId === m.id;
            const best = bests[m.id];
            return (
              <Paper key={m.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ fontWeight: 800, flex: 1 }}>{m.name}</Typography>
                  <Chip size="small" label={m.difficulty} variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip size="small" label={m.category} sx={{ bgcolor: ACCENT.green, color: '#fff', height: 20, fontSize: 11 }} />
                  {best != null && (
                    <Chip size="small" variant="outlined" label={`${t('train.best')}: ${best} ${m.unit}`} sx={{ height: 20, fontSize: 11 }} />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{m.short}</Typography>

                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Button size="small" startIcon={<PlayArrowIcon />} variant="contained" disabled={!canStart} onClick={() => start(m.id)}
                    sx={{ bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}>
                    {t('train.start')}
                  </Button>
                  <Button size="small" endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
                    onClick={() => setOpenId(open ? null : m.id)}>
                    {t('train.guide')}
                  </Button>
                </Stack>

                <Collapse in={open} unmountOnExit>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: '0 0 auto' }}>
                      <Dartboard numbers={m.board.numbers} ring={m.board.ring} size={150} />
                    </Box>
                    <Box component="ol" sx={{ pl: 2.5, m: 0, flex: 1, minWidth: 200 }}>
                      {m.rules.map((r, i) => (
                        <Typography component="li" key={i} variant="body2" sx={{ mb: 0.5 }}>{r}</Typography>
                      ))}
                    </Box>
                  </Box>
                </Collapse>
              </Paper>
            );
          })}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AllInclusiveIcon sx={{ color: ACCENT.green }} />
              <Typography sx={{ fontWeight: 800, flex: 1 }}>{t('train.x01')}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('train.x01text')}
            </Typography>
            <Button size="small" startIcon={<PlayArrowIcon />} variant="contained" sx={{ mt: 1.5, bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green } }}
              onClick={() => navigate('/training/x01')}>
              {t('train.start')}
            </Button>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
