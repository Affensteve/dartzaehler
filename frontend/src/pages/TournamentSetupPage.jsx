import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Button,
  TextField,
  Divider,
  Alert,
  Paper,
  Typography,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Header from '../components/Header';
import GameConfig from '../components/GameConfig';
import PlayerSetupList, { makeHuman, makeBot } from '../components/PlayerSetupList';
import { api } from '../api/client';
import { CARD_CUT } from '../theme';
import { useT, t as tr } from '../i18n';

// Kompakter Format-Wähler für eine KO-Phase (Satz/Leg-Modus + Anzahl).
function PhaseFormat({ value, onChange }) {
  const isBestOf = value.satzLegMode === 'bestof';
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value.satzLegMode}
        onChange={(e, v) => v && onChange({ ...value, satzLegMode: v })}
      >
        <ToggleButton value="firstto">{tr('cfg.firstto')}</ToggleButton>
        <ToggleButton value="bestof">{tr('cfg.bestof')}</ToggleButton>
      </ToggleButtonGroup>
      <TextField
        size="small"
        type="number"
        label={isBestOf ? tr('tour.legs') : tr('tour.legsPerSet')}
        value={value.legs}
        onChange={(e) => onChange({ ...value, legs: Math.max(1, parseInt(e.target.value, 10) || 1) })}
        sx={{ width: 100 }}
      />
      {!isBestOf && (
        <TextField
          size="small"
          type="number"
          label={tr('tour.sets')}
          value={value.sets}
          onChange={(e) => onChange({ ...value, sets: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          sx={{ width: 90 }}
        />
      )}
    </Stack>
  );
}

export default function TournamentSetupPage() {
  const navigate = useNavigate();
  const t = useT();
  const [name, setName] = useState('Friday Night Darts');
  const [config, setConfig] = useState({
    mode: 501,
    checkIn: 'straight',
    satzLegMode: 'firstto',
    sets: 1,
    legs: 3,
    maxRounds: 20,
    inputMode: 'numpad',
  });
  const [groupCount, setGroupCount] = useState(1);
  const [koEnabled, setKoEnabled] = useState(false);
  const [koAdvance, setKoAdvance] = useState(0); // 0 = alle
  const [thirdPlace, setThirdPlace] = useState(true);
  const [koFmt, setKoFmt] = useState({ satzLegMode: 'bestof', legs: 3, sets: 1 });
  const [finalFmt, setFinalFmt] = useState({ satzLegMode: 'bestof', legs: 5, sets: 1 });

  const [players, setPlayers] = useState([makeHuman(''), makeBot('easy')]);
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [darts, setDarts] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listPlayers()
      .then((list) => setSavedPlayers(list.filter((p) => p.type === 'human')))
      .catch(() => {});
    api.listDarts().then(setDarts).catch(() => {});
  }, []);

  const resolvePlayerId = async (p, pname) => {
    if (p.type !== 'human') return null;
    if (p.id) return p.id;
    const created = await api.createPlayer({ name: pname, type: 'human' });
    return created.id;
  };

  const create = async () => {
    setError(null);
    if (players.length < 2) {
      setError(t('tour.min2'));
      return;
    }
    setBusy(true);
    try {
      const roster = [];
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const pname = p.name.trim() || (p.type === 'bot' ? p.name : t('setup.playerN', { n: i + 1 }));
        const id = await resolvePlayerId(p, pname);
        roster.push({ id: id || undefined, name: pname, type: p.type, botLevel: p.botLevel, checkoutMode: p.checkoutMode, dartId: p.dartId });
      }
      const t = await api.createTournament({
        name,
        ...config,
        groupCount,
        koEnabled,
        koAdvance,
        thirdPlace,
        phaseFormats: {
          group: { satzLegMode: config.satzLegMode, sets: config.sets, legs: config.legs },
          ko: koFmt,
          final: finalFmt,
        },
        players: roster,
      });
      navigate(`/tournament/${t.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Box>
      <Header title={t('tour.newTitle')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 2, pb: 10 }}>
        <TextField label={t('tour.name')} fullWidth value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t('tour.groupFormat')}
        </Typography>
        <GameConfig config={config} setConfig={setConfig} allowUnlimited={false} />

        <Paper variant="outlined" sx={{ p: 2, mt: 2, clipPath: CARD_CUT }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('tour.mode')}</Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ minWidth: 90 }}>{t('tour.groups')}</Typography>
            <ToggleButtonGroup exclusive size="small" value={groupCount} onChange={(e, v) => v && setGroupCount(v)}>
              <ToggleButton value={1}>{t('tour.oneGroup')}</ToggleButton>
              <ToggleButton value={2}>{t('tour.twoGroups')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ minWidth: 90 }}>{t('tour.koPhase')}</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={koEnabled ? 'yes' : 'no'}
              onChange={(e, v) => v && setKoEnabled(v === 'yes')}
            >
              <ToggleButton value="no">{t('tour.no')}</ToggleButton>
              <ToggleButton value="yes">{t('tour.yes')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {koEnabled && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{t('tour.advanceQ')}</Typography>
              <ToggleButtonGroup exclusive size="small" value={koAdvance} onChange={(e, v) => v != null && setKoAdvance(v)}>
                <ToggleButton value={0}>{t('tour.advAll')}</ToggleButton>
                <ToggleButton value={2}>{t('tour.top2')}</ToggleButton>
                <ToggleButton value={3}>{t('tour.top3')}</ToggleButton>
              </ToggleButtonGroup>

              <FormControlLabel
                sx={{ display: 'block', mt: 1 }}
                control={<Checkbox checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} />}
                label={t('tour.thirdPlace')}
              />

              <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>{t('tour.koFormat')}</Typography>
              <PhaseFormat value={koFmt} onChange={setKoFmt} />

              <Typography variant="body2" sx={{ mt: 1.5, mb: 0.5 }}>{t('tour.finalFormat')}</Typography>
              <PhaseFormat value={finalFmt} onChange={setFinalFmt} />
            </Box>
          )}
        </Paper>

        <Divider sx={{ my: 2 }} />
        <PlayerSetupList
          players={players}
          setPlayers={setPlayers}
          savedPlayers={savedPlayers}
          darts={darts}
          onRename={async (pid, newName) => {
            await api.updatePlayer(pid, { name: newName });
            setSavedPlayers((list) => list.map((sp) => (sp.id === pid ? { ...sp, name: newName } : sp)));
          }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Container>

      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          p: 2,
          bgcolor: 'background.default',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="sm" disableGutters>
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={busy || players.length < 2}
            startIcon={<EmojiEventsIcon />}
            sx={{ py: 1.5, fontSize: 18 }}
            onClick={create}
          >
            {t('tour.create')}
          </Button>
        </Container>
      </Box>
    </Box>
  );
}
