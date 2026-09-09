import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Button, FormControlLabel, Checkbox, Divider, Alert, Tabs, Tab, Snackbar, TextField, MenuItem } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Header from '../components/Header';
import GameConfig from '../components/GameConfig';
import PlayerSetupList, { makeHuman } from '../components/PlayerSetupList';
import TeamSetupList, { makeTeam } from '../components/TeamSetupList';
import { api } from '../api/client';
import { useT } from '../i18n';

export default function SetupPage() {
  const navigate = useNavigate();
  const t = useT();
  const [tab, setTab] = useState('single'); // 'single' | 'double'
  const [leagues, setLeagues] = useState([]);
  useEffect(() => {
    api
      .listLeagues()
      .then((ls) => setLeagues((ls || []).filter((l) => l.status === 'active')))
      .catch(() => {});
  }, []);
  const [config, setConfig] = useState({
    mode: 501,
    checkIn: 'straight',
    satzLegMode: 'bestof',
    sets: 1,
    legs: 3,
    maxRounds: 20,
    inputMode: 'numpad',
    randomOrder: true,
    bullOffRandomField: false,
  });
  const [players, setPlayers] = useState([makeHuman('')]);
  const [teams, setTeams] = useState([makeTeam(), makeTeam()]);
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [savedTeams, setSavedTeams] = useState([]);
  const [msg, setMsg] = useState('');
  const [darts, setDarts] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listPlayers()
      .then((list) => setSavedPlayers(list.filter((p) => p.type === 'human')))
      .catch(() => {});
    api.listDarts().then(setDarts).catch(() => {});
    api.listSavedTeams().then(setSavedTeams).catch(() => {});
  }, []);

  // Sorgt dafür, dass ein menschlicher Spieler eine gespeicherte ID hat.
  const resolveId = async (p) => {
    if (p.id) return p.id;
    const created = await api.createPlayer({ name: p.name, type: 'human' });
    return created.id;
  };

  const namedTeams = teams.filter((tm) => tm.members.some((m) => m.name.trim())).length;
  const canStart = tab === 'single' ? players.length >= 2 : namedTeams >= 2;

  const TEAM_COLORS = ['#006EC7', '#00A3A3', '#2E7D32', '#C62828', '#F9A825', '#6A1B9A', '#EC407A', '#455A64'];
  const saveTeam = async (tm) => {
    const members = tm.members.filter((m) => m.name.trim()).map((m) => ({ id: m.id, name: m.name.trim() }));
    if (!members.length) return;
    const name = tm.name.trim() || members.map((m) => m.name).join(' & ');
    const color = tm.color || TEAM_COLORS[savedTeams.length % TEAM_COLORS.length];
    try {
      await api.createSavedTeam({ name, color, members });
      const list = await api.listSavedTeams();
      setSavedTeams(list);
      setMsg(t('ts.savedMsg'));
    } catch (e) {
      setError(e.message);
    }
  };

  const startSingle = async () => {
    const roster = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const name = p.name.trim() || (p.type === 'bot' ? p.name : t('setup.playerN', { n: i + 1 }));
      const id = p.type === 'human' ? await resolveId({ ...p, name }) : undefined;
      roster.push({ id: id || undefined, name, type: p.type, botLevel: p.botLevel, adaptivePush: p.adaptivePush, checkoutMode: p.checkoutMode, dartId: p.dartId });
    }
    return api.createGame({ ...config, players: roster });
  };

  const startDouble = async () => {
    const payload = [];
    for (const tm of teams) {
      const members = [];
      for (const m of tm.members) {
        const name = m.name.trim();
        if (!name) continue;
        const id = await resolveId({ ...m, name });
        members.push({ id, name, dartId: m.dartId, checkoutMode: m.checkoutMode });
      }
      if (members.length) payload.push({ name: tm.name.trim(), color: tm.color || null, checkoutMode: tm.checkoutMode, members });
    }
    if (payload.length < 2) {
      const err = new Error(t('setup.minTeams'));
      err.local = true;
      throw err;
    }
    return api.createGame({ ...config, teams: payload });
  };

  const start = async () => {
    setError(null);
    if (!canStart) {
      setError(tab === 'single' ? t('setup.minPlayer') : t('setup.minTeams'));
      return;
    }
    setBusy(true);
    try {
      const game = tab === 'single' ? await startSingle() : await startDouble();
      navigate(`/game/${game.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Box>
      <Header title={t('setup.title')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 2, pb: 10 }}>
        <Tabs value={tab} onChange={(e, v) => { setTab(v); setError(null); }} variant="fullWidth" sx={{ mb: 2 }}>
          <Tab value="single" label={t('setup.tabSingle')} />
          <Tab value="double" label={t('setup.tabDouble')} />
        </Tabs>

        <GameConfig config={config} setConfig={setConfig} allowUnlimited={false} />

        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Checkbox checked={config.randomOrder} onChange={(e) => setConfig((c) => ({ ...c, randomOrder: e.target.checked }))} />}
          label={t('setup.random')}
        />

        {tab === 'single' && leagues.length > 0 && (
          <TextField
            select
            fullWidth
            size="small"
            sx={{ mt: 2 }}
            label={t('cfg.league')}
            value={config.leagueId || ''}
            onChange={(e) => setConfig((c) => ({ ...c, leagueId: e.target.value || null }))}
          >
            <MenuItem value="">{t('cfg.leagueNone')}</MenuItem>
            {leagues.map((l) => (
              <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
            ))}
          </TextField>
        )}

        <Divider sx={{ my: 2 }} />

        {tab === 'single' ? (
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

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Container>

      <Box sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="sm" disableGutters>
          <Button
            variant="contained"
            color="error"
            size="large"
            fullWidth
            disabled={busy || !canStart}
            startIcon={<PlayArrowIcon />}
            sx={{ py: 1.5, fontSize: 18 }}
            onClick={start}
          >
            {t('setup.start')}
          </Button>
        </Container>
      </Box>

      <Snackbar open={Boolean(msg)} autoHideDuration={2500} onClose={() => setMsg('')} message={msg} />
    </Box>
  );
}
