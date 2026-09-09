import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  ButtonBase,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import Header from '../components/Header';
import { api } from '../api/client';
import { CARD_CUT } from '../theme';
import { useT } from '../i18n';

// Verwaltung als Hub: zwei Bereiche (Spieler, Pfeile) als Icon-Kacheln, darunter
// eine Übersicht mit dem empfohlenen Pfeil je Spieler (nach bestem Average).
export default function VerwaltungPage() {
  const navigate = useNavigate();
  const t = useT();
  const [rec, setRec] = useState([]);

  useEffect(() => {
    api.dartRecommendations().then(setRec).catch(() => setRec([]));
  }, []);

  const cards = [
    { icon: <GroupIcon />, label: t('pl.title'), desc: t('vw.playersDesc'), to: '/players', color: '#006EC7' },
    { icon: <GpsFixedIcon />, label: t('darts.title'), desc: t('vw.dartsDesc'), to: '/darts', color: '#00A3A3' },
  ];

  return (
    <Box>
      <Header title={t('home.management')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
          {cards.map((c) => (
            <ButtonBase key={c.to} onClick={() => navigate(c.to)} aria-label={c.label} sx={{ textAlign: 'left', borderRadius: 1, display: 'block' }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  height: '100%',
                  clipPath: CARD_CUT,
                  transition: 'border-color 120ms ease, transform 120ms ease',
                  '&:hover': { borderColor: c.color, transform: 'translateY(-2px)' },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', bgcolor: c.color, flexShrink: 0 }}>
                    {c.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }} noWrap>{c.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.desc}</Typography>
                  </Box>
                </Stack>
              </Paper>
            </ButtonBase>
          ))}
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>{t('vw.recTitle')}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{t('vw.recDesc')}</Typography>
        {rec.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>{t('vw.noData')}</Typography>
        ) : (
          <Paper variant="outlined" sx={{ clipPath: CARD_CUT }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('vw.colPlayer')}</TableCell>
                  <TableCell>{t('vw.colDart')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rec.map((r) => (
                  <TableRow key={r.playerId} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/players/${r.playerId}`)}>
                    <TableCell sx={{ fontWeight: 700 }}>{r.name}</TableCell>
                    <TableCell>
                      {r.dartName} <Box component="span" sx={{ color: 'text.secondary' }}>(Ø {r.average})</Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
