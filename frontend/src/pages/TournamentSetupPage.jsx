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
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Header from '../components/Header';
import GameConfig from '../components/GameConfig';
import PlayerSetupList, { makeHuman, makeBot } from '../components/PlayerSetupList';
import TeamSetupList, { makeTeam } from '../components/TeamSetupList';
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
    satzLegMode: 'bestof',
    sets: 1,
    legs: 3,
    maxRounds: 20,
    inputMode: 'numpad',
    bullOffRandomField: false,
  });
  const [groupCount, setGroupCount] = useState(1);
  const [koEnabled, setKoEnabled] = useState(false);
  const [koAdvance, setKoAdvance] = useState(0); // 0 = alle
  const [thirdPlace, setThirdPlace] = useState(true);
  const [koFmt, setKoFmt] = useState({ satzLegMode: 'bestof', legs: 3, sets: 1 });
  const [finalFmt, setFinalFmt] = useState({ satzLegMode: 'bestof', legs: 5, sets: 1 });
  const [seedByElo, setSeedByElo] = useState(false);

  const [players, setPlayers] = useState([makeHuman(''), makeBot('easy')]);
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [darts, setDarts] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('single'); // 'single' | 'double'
  const [teams, setTeams] = useState([makeTeam(), makeTeam()]);
  const [savedTeams, setSavedTeams] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .listPlayers()
      .then((list) => setSavedPlayers(list.filter((p) => p.type === 'human')))
      .catch(() => {});
    api.listDarts().then(setDarts).catch(() => {});
    api.listSavedTeams().then(setSavedTeams).catch(() => {});
  }, []);

  const TEAM_COLORS = ['#006EC7', '#00A3A3', '#2E7D32', '#C62828', '#F9A825', '#6A1B9A', '#EC407A', '#455A64'];
  const saveTeam = async (tm) => {
    const members = tm.members.filter((m) => m.name.trim()).map((m) => ({ id: m.id, name: m.name.trim() }));
    if (!members.length) return;
    const nm = tm.name.trim() || members.map((m) => m.name).join(' & ');
    const color = tm.color || TEAM_COLORS[savedTeams.length % TEAM_COLORS.length];
    try {
      await api.createSavedTeam({ name: nm, color, members });
      setSavedTeams(await api.listSavedTeams());
      setMsg(t('ts.savedMsg'));
    } catch (e) {
      setError(e.message);
    }
  };
  const namedTeams = teams.filter((tm) => tm.members.some((m) => m.name.trim())).length;

  const resolvePlayerId = async (p, pname) => {
    if (p.type !== 'human') return null;
    if (p.id) return p.id;
    const created = await api.createPlayer({ name: pname, type: 'human' });
    return created.id;
  };

  const create = async () => {
    setError(null);
    if (mode === 'single' ? players.length < 2 : namedTeams < 2) {
      setError(mode === 'single' ? t('tour.min2') : t('tour.min2teams'));
      return;
    }
    setBusy(true);
    try {
      const common = {
        name,
        ...config,
        groupCount,
        koEnabled,
        koAdvance,
        thirdPlace,
        seedByElo,
        phaseFormats: {
          group: { satzLegMode: config.satzLegMode, sets: config.sets, legs: config.legs },
          ko: koFmt,
          final: finalFmt,
        },
      };
      let created;
      if (mode === 'double') {
        const teamPayload = [];
        for (const tm of teams) {
          const members = [];
          for (const m of tm.members) {
            const nm = m.name.trim();
            if (!nm) continue;
            const id = await resolvePlayerId({ ...m, type: 'human' }, nm);
            members.push({ id, name: nm, dartId: m.dartId, checkoutMode: m.checkoutMode });
          }
          if (members.length) teamPayload.push({ name: tm.name.trim(), color: tm.color || null, checkoutMode: tm.checkoutMode, members });
        }
        if (teamPayload.length < 2) {
          setError(t('tour.min2teams'));
          setBusy(false);
          return;
        }
        created = await api.createTournament({ ...common, teams: teamPayload });
      } else {
        const roster = [];
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          const pname = p.name.trim() || (p.type === 'bot' ? p.name : t('setup.playerN', { n: i + 1 }));
          const id = await resolvePlayerId(p, pname);
          roster.push({ id: id || undefined, name: pname, type: p.type, botLevel: p.botLevel, checkoutMode: p.checkoutMode, dartId: p.dartId });
        }
        created = await api.createTournament({ ...common, players: roster });
      }
      navigate(`/tournament/${created.id}`);
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

        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Checkbox checked={seedByElo} onChange={(e) => setSeedByElo(e.target.checked)} />}
          label={
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              {t('tour.seedElo')}
              <Tooltip title={t('tour.seedEloInfo')} enterTouchDelay={0} leaveTouchDelay={6000} arrow>
                <InfoOutlinedIcon sx={{ fontSize: 16, cursor: 'help', color: 'text.secondary' }} />
              </Tooltip>
            </Box>
          }
        />

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
        <Tabs value={mode} onChange={(e, v) => v && setMode(v)} variant="fullWidth" sx={{ mb: 1.5 }}>
          <Tab value="single" label={t('setup.tabSingle')} />
          <Tab value="double" label={t('setup.tabDouble')} />
        </Tabs>
        {mode === 'single' ? (
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
        ) : (
          <TeamSetupList teams={teams} setTeams={setTeams} savedPlayers={savedPlayers} savedTeams={savedTeams} onSaveTeam={saveTeam} />
        )}
        {msg && (
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setMsg('')}>
            {msg}
          </Alert>
        )}
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
            disabled={busy || (mode === 'single' ? players.length < 2 : namedTeams < 2)}
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
