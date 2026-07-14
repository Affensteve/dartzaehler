import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, List, ListItem, ListItemButton, ListItemText, Chip, CircularProgress } from '@mui/material';
import CastIcon from '@mui/icons-material/Cast';
import Header from '../components/Header';
import { api } from '../api/client';
import { useT, gameLabel } from '../i18n';

/** Cast-Bereich: laufende Spiele auswählen und eingabefrei als Anzeigetafel zeigen. */
export default function CastListPage() {
  const navigate = useNavigate();
  const t = useT();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listGames().then(setGames).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const running = games.filter((g) => g.status === 'playing');

  return (
    <Box>
      <Header title={t('cast.title')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('cast.intro')}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : running.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            {t('cast.none')}
          </Typography>
        ) : (
          <Paper variant="outlined">
            <List>
              {running.map((g) => (
                <ListItem key={g.id} disablePadding>
                  <ListItemButton onClick={() => navigate(`/cast/${g.id}`)}>
                    <CastIcon sx={{ mr: 1.5, color: 'text.secondary' }} />
                    <ListItemText
                      primary={`${g.tournamentId ? t('cast.match') : t('cast.game')} ${g.players && g.players.length ? g.players.join(' : ') : g.id.slice(0, 8)}`}
                      secondary={gameLabel({ mode: g.mode, format: g.format, checkout: g.checkout }) || g.updatedAt}
                    />
                    <Chip size="small" color="success" label={t('home.running')} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
