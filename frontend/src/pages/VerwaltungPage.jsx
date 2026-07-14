import { useNavigate } from 'react-router-dom';
import { Box, Container, Stack, Button } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import InsightsIcon from '@mui/icons-material/Insights';
import HistoryIcon from '@mui/icons-material/History';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import Header from '../components/Header';
import PlayersPage from './PlayersPage';
import DartsPage from './DartsPage';
import { useT } from '../i18n';

// Gebündelte Verwaltung: Statistik/Historie/Achievements als Links oben,
// darunter Spieler- und Pfeil-Verwaltung nebeneinander.
export default function VerwaltungPage() {
  const navigate = useNavigate();
  const t = useT();
  const links = [
    { icon: <BarChartIcon />, label: t('home.stats'), to: '/stats' },
    { icon: <InsightsIcon />, label: t('an.open'), to: '/analysis' },
    { icon: <HistoryIcon />, label: t('home.history'), to: '/history' },
    { icon: <MilitaryTechIcon />, label: t('home.achievements'), to: '/achievements' },
    { icon: <FitnessCenterIcon />, label: t('coach.title'), to: '/coach' },
  ];
  return (
    <Box>
      <Header title={t('home.management')} onBack={() => navigate('/')} />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          {links.map((l) => (
            <Button key={l.to} variant="outlined" startIcon={l.icon} onClick={() => navigate(l.to)}>
              {l.label}
            </Button>
          ))}
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <PlayersPage embedded />
          <DartsPage embedded />
        </Box>
      </Container>
    </Box>
  );
}
