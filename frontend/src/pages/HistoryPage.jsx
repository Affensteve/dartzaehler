import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Container, Typography, Alert, ToggleButton, ToggleButtonGroup, CircularProgress,
  Paper, List, ListItem, ListItemButton, Chip, IconButton, Tooltip, Button, Stack,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import Header from '../components/Header';
import { api } from '../api/client';
import { useT, gameLabel } from '../i18n';

function fmtDate(s) {
  if (!s) return '';
  return s.replace('T', ' ').slice(0, 16);
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const t = useT();
  const [params] = useSearchParams();
  const player = params.get('player');
  const [range, setRange] = useState('all');
  const [area, setArea] = useState('all');
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const RANGES = [
    { key: 'today', label: t('common.today') },
    { key: '7d', label: t('common.7d') },
    { key: '30d', label: t('common.30d') },
    { key: 'all', label: t('common.allTime') },
  ];

  const reload = () => {
    setLoading(true);
    api.listMatches(range, area, player).then(setMatches).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(reload, [range, area, player]);

  const del = async (id, e) => {
    e.stopPropagation();
    try {
      await api.deleteMatch(id);
      reload();
    } catch {
      /* ignorieren */
    }
  };

  return (
    <Box>
      <Header title={t('history.title')} onBack={() => navigate(-1)} />
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <ToggleButtonGroup exclusive size="small" value={area} onChange={(e, v) => v && setArea(v)}>
            <ToggleButton value="all">{t('common.all')}</ToggleButton>
            <ToggleButton value="game">{t('common.gameTournament')}</ToggleButton>
            <ToggleButton value="training">{t('common.training')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
          <ToggleButtonGroup exclusive size="small" value={range} onChange={(e, v) => v && setRange(v)}>
            {RANGES.map((r) => (
              <ToggleButton key={r.key} value={r.key}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Stack direction="row" justifyContent="center" sx={{ mb: 2 }}>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} href={api.exportMatchesUrl(range, area, player)}>
            {t('history.csv')}
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : matches.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            {t('history.none')}
          </Typography>
        ) : (
          <Paper variant="outlined">
            <List dense>
              {matches.map((m) => (
                <ListItem
                  key={m.id}
                  disablePadding
                  secondaryAction={
                    <Tooltip title={t('history.deleteFromHistory')}>
                      <IconButton edge="end" color="error" aria-label={t('common.delete')} onClick={(e) => del(m.id, e)}>
                        <CancelIcon />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemButton onClick={() => navigate(`/history/${m.id}`)} sx={{ pr: 7 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {m.players.map((p) => `${p.name} (${p.legsWon})`).join('  vs  ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDate(m.finishedAt)} · {m.format ? gameLabel({ mode: m.mode, format: m.format, checkout: m.checkout }) : `${m.mode} · ${m.formatLabel || ''}`}
                        {m.winnerName ? ` · ${t('common.winner')}: ${m.winnerName}` : ''}
                      </Typography>
                    </Box>
                    {m.isTraining && <Chip size="small" label={t('common.training')} sx={{ mr: 1 }} />}
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
