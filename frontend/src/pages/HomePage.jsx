import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  ButtonBase,
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
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import InsightsIcon from '@mui/icons-material/Insights';
import CelebrationIcon from '@mui/icons-material/Celebration';
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

  const primary = { icon: <SportsIcon />, label: t('home.newGame'), to: '/setup', color: '#006EC7' };
  const NAV = [
    { icon: <CelebrationIcon />, label: t('home.party'), to: '/party', color: '#EC407A' },
    { icon: <EmojiEventsIcon />, label: t('home.newTournament'), to: '/tournament/new', color: '#E0A400' },
    { icon: <FitnessCenterIcon />, label: t('home.training'), to: '/training', color: '#2E9E5B' },
    { icon: <InsightsIcon />, label: t('home.auswertung'), to: '/auswertung', color: '#7A5CC7' },
    { icon: <LeaderboardIcon />, label: t('home.leagues'), to: '/leagues', color: '#00A3A3' },
    { icon: <ManageAccountsIcon />, label: t('home.management'), to: '/verwaltung', color: '#455A64' },
    { icon: <CastIcon />, label: t('home.cast'), to: '/cast', color: '#5C6BC0' },
  ];

  return (
    <Box>
      <Header title={t('app.title')} back={false} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Stack spacing={2}>
          <ButtonBase
            onClick={() => navigate(primary.to)}
            aria-label={primary.label}
            sx={{ display: 'block', borderRadius: 1 }}
          >
            <Paper sx={{ p: 2.5, clipPath: CARD_CUT, bgcolor: primary.color, color: '#fff', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,0.2)' }}>
                {primary.icon}
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{primary.label}</Typography>
            </Paper>
          </ButtonBase>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {NAV.map((b) => (
              <ButtonBase
                key={b.to}
                onClick={() => navigate(b.to)}
                aria-label={b.label}
                sx={{ display: 'block', borderRadius: 1 }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    height: '100%',
                    clipPath: CARD_CUT,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    transition: 'border-color 120ms ease, transform 120ms ease',
                    '&:hover': { borderColor: b.color, transform: 'translateY(-2px)' },
                  }}
                >
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', bgcolor: b.color }}>
                    {b.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700 }}>{b.label}</Typography>
                </Paper>
              </ButtonBase>
            ))}
          </Box>

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
