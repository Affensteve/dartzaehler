import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Button,
  Stack,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Header from '../components/Header';
import { StatSections } from '../components/statsView';
import { api } from '../api/client';
import { useT } from '../i18n';



export default function StatsPage() {
  const navigate = useNavigate();
  const t = useT();
  const RANGES = [
    { key: 'today', label: t('common.today') },
    { key: '7d', label: t('common.7d') },
    { key: '30d', label: t('common.30d') },
    { key: 'all', label: t('common.allTime') },
  ];
  const [range, setRange] = useState('all');
  const [area, setArea] = useState('game'); // 'game' = Spiel & Turnier, 'training'
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listStats(range, area)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range, area]);

  const ordered = useMemo(
    () =>
      [...rows].sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name)),
    [rows]
  );

  return (
    <Box>
      <Header title={t('stats.title')} onBack={() => navigate(-1)} />
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }} className="no-print">
          <ToggleButtonGroup exclusive size="small" value={area} onChange={(e, v) => v && setArea(v)}>
            <ToggleButton value="game">{t('common.gameTournament')}</ToggleButton>
            <ToggleButton value="training">{t('common.training')}</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }} className="no-print">
          <ToggleButtonGroup exclusive size="small" value={range} onChange={(e, v) => v && setRange(v)}>
            {RANGES.map((r) => (
              <ToggleButton key={r.key} value={r.key}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Stack direction="row" spacing={1} justifyContent="center" className="no-print" sx={{ mb: 3 }}>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} href={api.exportStatsUrl(range, area)}>
            {t('stats.csv')}
          </Button>
          <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => window.print()}>
            {t('stats.pdf')}
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
        ) : ordered.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            {t('common.loadingNone')}
          </Typography>
        ) : (
          <StatSections
            rows={ordered}
            onNameClick={(r) => navigate(`/players/${r.playerId}`)}
            area={area}
            range={range}
            enableSectorDartFilter
          />
        )}
      </Container>
    </Box>
  );
}
