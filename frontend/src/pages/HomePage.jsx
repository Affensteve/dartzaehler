import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
} from '@mui/material';
import SportsIcon from '@mui/icons-material/SportsScore';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import GroupIcon from '@mui/icons-material/Group';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import BarChartIcon from '@mui/icons-material/BarChart';
import HistoryIcon from '@mui/icons-material/History';
import CastIcon from '@mui/icons-material/Cast';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import Header from '../components/Header';
import { api } from '../api/client';
import { CARD_CUT } from '../theme';
import { useT, gameLabel } from '../i18n';

export default function HomePage() {
  const navigate = useNavigate();
  const t = useT();
  const [games, setGames] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [confirm, setConfirm] = useState(null); // { type, id, label }

  const reload = useCallback(() => {
    api.listGames().then(setGames).catch(() => {});
    api.listTournaments().then(setTournaments).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const doDelete = async () => {
    if (!confirm) return;
    try {
      if (confirm.type === 'game') await api.deleteGame(confirm.id);
      else await api.deleteTournament(confirm.id);
    } catch {
      /* ignorieren */
    }
    setConfirm(null);
    reload();
  };

  const openGames = games.filter((g) => g.status === 'playing' && !g.tournamentId).slice(0, 8);
  const activeTournaments = tournaments.filter((t2) => t2.status === 'active').slice(0, 8);

  const gameTitle = (g) =>
    g.players && g.players.length ? `${t('home.game')} ${g.players.join(' : ')}` : `${t('home.game')} ${g.id.slice(0, 8)}`;

  const NAV = [
    { icon: <SportsIcon />, label: t('home.newGame'), to: '/setup', variant: 'contained' },
    { icon: <EmojiEventsIcon />, label: t('home.newTournament'), to: '/tournament/new' },
    { icon: <FitnessCenterIcon />, label: t('home.training'), to: '/training' },
    { icon: <ManageAccountsIcon />, label: t('home.management'), to: '/verwaltung' },
    { icon: <CastIcon />, label: t('home.cast'), to: '/cast' },
  ];

  return (
    <Box>
      <Header title={t('app.title')} back={false} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={2}>
          {NAV.map((b) => (
            <Button
              key={b.to}
              size="large"
              variant={b.variant || 'outlined'}
              startIcon={b.icon}
              sx={{ py: 2, fontSize: 18 }}
              onClick={() => navigate(b.to)}
            >
              {b.label}
            </Button>
          ))}

          {openGames.length > 0 && (
            <Paper variant="outlined" sx={{ clipPath: CARD_CUT }}>
              <Typography sx={{ p: 1.5, pb: 0.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('home.runningGames')}
              </Typography>
              <List dense>
                {openGames.map((g) => (
                  <ListItem
                    key={g.id}
                    disablePadding
                    secondaryAction={
                      <Tooltip title={t('home.abortGame')}>
                        <IconButton
                          edge="end"
                          color="error"
                          aria-label={t('home.abortGame')}
                          onClick={() => setConfirm({ type: 'game', id: g.id, label: gameTitle(g) })}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemButton onClick={() => navigate(`/game/${g.id}`)} sx={{ pr: 7 }}>
                      <ListItemText
                        primary={gameTitle(g)}
                        secondary={gameLabel({ mode: g.mode, format: g.format, checkout: g.checkout }) || g.updatedAt}
                      />
                      <Chip size="small" color="success" label={t('home.running')} sx={{ mr: 1 }} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}

          {activeTournaments.length > 0 && (
            <Paper variant="outlined" sx={{ clipPath: CARD_CUT }}>
              <Typography sx={{ p: 1.5, pb: 0.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('home.activeTournaments')}
              </Typography>
              <List dense>
                {activeTournaments.map((tn) => (
                  <ListItem
                    key={tn.id}
                    disablePadding
                    secondaryAction={
                      <Tooltip title={t('home.deleteTournament')}>
                        <IconButton
                          edge="end"
                          color="error"
                          aria-label={t('home.deleteTournament')}
                          onClick={() =>
                            setConfirm({ type: 'tournament', id: tn.id, label: `${t('home.tournament')} ${tn.id.slice(0, 8)}` })
                          }
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemButton onClick={() => navigate(`/tournament/${tn.id}`)} sx={{ pr: 7 }}>
                      <ListItemText primary={`${t('home.tournament')} ${tn.id.slice(0, 8)}`} secondary={tn.updatedAt} />
                      <Chip size="small" color="warning" label={t('home.active')} sx={{ mr: 1 }} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Stack>
      </Container>

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm?.type === 'tournament' ? t('home.deleteTournamentQ') : t('home.abortGameQ')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('home.discardText', { label: confirm?.label || '' })}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>{t('home.continuePlay')}</Button>
          <Button color="error" variant="contained" onClick={doDelete}>
            {confirm?.type === 'tournament' ? t('common.delete') : t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
