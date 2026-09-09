import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Button,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Divider,
} from '@mui/material';
import CelebrationIcon from '@mui/icons-material/Celebration';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import GavelIcon from '@mui/icons-material/Gavel';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import GolfCourseIcon from '@mui/icons-material/GolfCourse';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import Header from '../components/Header';
import PlayerSetupList, { makeHuman } from '../components/PlayerSetupList';
import { api } from '../api/client';
import { CARD_CUT } from '../theme';
import { useT } from '../i18n';

// Party-Modi (Stufe 4). Spielbar über die bestehende X01-Engine: „X01 601/701" und
// „Gotcha" (Zielzahl punktgenau = Single-Out). Killer/Baseball/Golf/Wettkampf-Trainings
// sind mit Regeln beschrieben und als eigene Engines in Vorbereitung.
export default function PartyPage() {
  const navigate = useNavigate();
  const t = useT();

  const MODES = [
    { id: 'x01hi', icon: <SportsScoreIcon />, color: '#006EC7', playable: true },
    { id: 'gotcha', icon: <GpsFixedIcon />, color: '#00A3A3', playable: true },
    { id: 'killer', icon: <GavelIcon />, color: '#C62828', playable: true },
    { id: 'baseball', icon: <SportsBaseballIcon />, color: '#7A5CC7', playable: true },
    { id: 'golf', icon: <GolfCourseIcon />, color: '#2E9E5B', playable: true },
    { id: 'shanghai', icon: <LocationCityIcon />, color: '#E0A400', playable: true },
    { id: 'clock', icon: <AccessTimeIcon />, color: '#0288D1', playable: true },
    { id: 'halveit', icon: <ContentCutIcon />, color: '#8E24AA', playable: true },
  ];

  const [sel, setSel] = useState(null); // gewählter spielbarer Modus
  const [players, setPlayers] = useState([makeHuman(''), makeHuman('')]);
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [darts, setDarts] = useState([]);
  const [startScore, setStartScore] = useState(601); // für x01hi
  const [target, setTarget] = useState(301); // für gotcha
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listPlayers().then((l) => setSavedPlayers(l.filter((p) => p.type === 'human'))).catch(() => {});
    api.listDarts().then(setDarts).catch(() => {});
  }, []);

  const resolveId = async (p) => {
    if (p.id) return p.id;
    const created = await api.createPlayer({ name: p.name, type: 'human' });
    return created.id;
  };

  const start = async () => {
    setError(null);
    if (players.length < 2) {
      setError(t('setup.minPlayer'));
      return;
    }
    setBusy(true);
    try {
      const isEngineMode = ['killer', 'baseball', 'golf', 'shanghai', 'clock', 'halveit'].includes(sel);
      const roster = [];
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const name = p.name.trim() || (p.type === 'bot' ? p.name : t('setup.playerN', { n: i + 1 }));
        const id = p.type === 'human' ? await resolveId({ ...p, name }) : undefined;
        if (isEngineMode) {
          roster.push({ id: id || undefined, name, type: p.type, botLevel: p.botLevel });
        } else {
          const checkoutMode = sel === 'gotcha' ? 'single' : p.checkoutMode || 'double';
          roster.push({ id: id || undefined, name, type: p.type, botLevel: p.botLevel, adaptivePush: p.adaptivePush, checkoutMode, dartId: p.dartId });
        }
      }
      if (isEngineMode) {
        const game = await api.createParty({ partyMode: sel, players: roster });
        navigate(`/party/game/${game.id}`);
        return;
      }
      const cfg = {
        mode: sel === 'gotcha' ? target : startScore,
        checkIn: 'straight',
        satzLegMode: 'bestof',
        sets: 1,
        legs: 3,
        maxRounds: 0,
        inputMode: 'numpad',
        partyMode: sel === 'gotcha' ? 'gotcha' : 'x01hi',
        players: roster,
      };
      const game = await api.createGame(cfg);
      navigate(`/game/${game.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  // Setup-Ansicht eines spielbaren Modus
  if (sel) {
    return (
      <Box>
        <Header title={t(`party.${sel}.name`)} onBack={() => setSel(null)} />
        <Container maxWidth="sm" sx={{ py: 3 }}>
          <Alert severity="info" icon={false} sx={{ mb: 2 }}>
            {t(`party.${sel}.rules`)}
          </Alert>

          {sel === 'x01hi' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">{t('party.startScore')}</Typography>
              <ToggleButtonGroup exclusive fullWidth size="small" value={startScore} onChange={(e, v) => v && setStartScore(v)} sx={{ mt: 0.5 }}>
                <ToggleButton value={501}>501</ToggleButton>
                <ToggleButton value={601}>601</ToggleButton>
                <ToggleButton value={701}>701</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
          {sel === 'gotcha' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">{t('party.target')}</Typography>
              <ToggleButtonGroup exclusive fullWidth size="small" value={target} onChange={(e, v) => v && setTarget(v)} sx={{ mt: 0.5 }}>
                <ToggleButton value={101}>101</ToggleButton>
                <ToggleButton value={301}>301</ToggleButton>
                <ToggleButton value={501}>501</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <PlayerSetupList
            players={players}
            setPlayers={setPlayers}
            savedPlayers={savedPlayers}
            darts={darts}
            allowBots={false}
            onRename={async (pid, newName) => {
              await api.updatePlayer(pid, { name: newName });
              setSavedPlayers((list) => list.map((sp) => (sp.id === pid ? { ...sp, name: newName } : sp)));
            }}
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Button fullWidth size="large" variant="contained" sx={{ mt: 3, py: 1.5 }} disabled={busy} onClick={start}>
            {t('party.start')}
          </Button>
        </Container>
      </Box>
    );
  }

  // Hub: Modus-Kacheln mit Regeln
  return (
    <Box>
      <Header title={t('party.title')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Typography color="text.secondary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CelebrationIcon fontSize="small" /> {t('party.subtitle')}
        </Typography>
        <Stack spacing={1.5}>
          {MODES.map((m) => (
            <Paper key={m.id} variant="outlined" sx={{ p: 2, clipPath: CARD_CUT }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', bgcolor: m.color, flexShrink: 0 }}>
                  {m.icon}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ fontWeight: 800 }}>{t(`party.${m.id}.name`)}</Typography>
                    {!m.playable && <Chip size="small" label={t('party.soon')} sx={{ height: 20 }} />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {t(`party.${m.id}.rules`)}
                  </Typography>
                  {m.playable && (
                    <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => setSel(m.id)} aria-label={t('party.start')}>
                      {t('party.play')}
                    </Button>
                  )}
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
