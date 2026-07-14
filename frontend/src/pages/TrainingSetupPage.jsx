import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Button, Divider, Alert, Typography } from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import Header from '../components/Header';
import GameConfig from '../components/GameConfig';
import PlayerSetupList, { makeHuman } from '../components/PlayerSetupList';
import { api } from '../api/client';
import { useT } from '../i18n';

/**
 * Trainings-Bereich. Aktuell: X01 im Unbegrenzt-Modus (endlos üben, Ende über
 * „Spiel beenden & werten"). Der Unbegrenzt-Modus wird nur hier angeboten.
 * Weitere Trainingsoptionen folgen später.
 */
export default function TrainingSetupPage() {
  const navigate = useNavigate();
  const t = useT();
  const [config, setConfig] = useState({
    mode: 501,
    checkIn: 'straight',
    satzLegMode: 'unlimited',
    sets: 1,
    legs: 3,
    maxRounds: 0, // kein Ausbullen-Limit beim Training
    inputMode: 'numpad',
  });
  const [players, setPlayers] = useState([makeHuman('')]);
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

  const resolvePlayerId = async (p) => {
    if (p.type !== 'human') return null;
    if (p.id) return p.id;
    const created = await api.createPlayer({ name: p.name, type: 'human' });
    return created.id;
  };

  const start = async () => {
    setError(null);
    if (players.length < 1) {
      setError(t('setup.minPlayer'));
      return;
    }
    setBusy(true);
    try {
      const roster = [];
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const name = p.name.trim() || (p.type === 'bot' ? p.name : t('setup.playerN', { n: i + 1 }));
        const id = await resolvePlayerId({ ...p, name });
        roster.push({ id: id || undefined, name, type: p.type, botLevel: p.botLevel, checkoutMode: p.checkoutMode, dartId: p.dartId });
      }
      const game = await api.createGame({ ...config, training: true, players: roster });
      navigate(`/game/${game.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Box>
      <Header title={t('train.title')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 2, pb: 10 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {t('tset.info')}
          </Typography>
        </Alert>

        <GameConfig config={config} setConfig={setConfig} allowUnlimited />

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
            disabled={busy || players.length < 1}
            startIcon={<FitnessCenterIcon />}
            sx={{ py: 1.5, fontSize: 18 }}
            onClick={start}
          >
            {t('tset.start')}
          </Button>
        </Container>
      </Box>
    </Box>
  );
}
