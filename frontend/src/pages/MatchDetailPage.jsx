import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Stack,
} from '@mui/material';
import Header from '../components/Header';
import { api } from '../api/client';
import { ACCENT, MONO } from '../theme';
import { useT, gameLabel } from '../i18n';

function fmtDate(s) {
  if (!s) return '';
  return s.replace('T', ' ').slice(0, 16);
}

// Visits nach Satz/Leg gruppieren, Reihenfolge beibehalten.
function groupByLeg(visits) {
  const groups = [];
  const index = new Map();
  for (const v of visits) {
    const key = `${v.setNo}-${v.legNo}`;
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ setNo: v.setNo, legNo: v.legNo, visits: [] });
    }
    groups[index.get(key)].visits.push(v);
  }
  return groups;
}

const kindColor = { checkout: 'success', bust: 'error', bulloff: 'warning' };

export default function MatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const kindChip = {
    checkout: { label: t('history.kind.checkout'), color: kindColor.checkout },
    bust: { label: t('history.kind.bust'), color: kindColor.bust },
    bulloff: { label: t('history.kind.bulloff'), color: kindColor.bulloff },
  };
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getMatch(id)
      .then(setMatch)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const hasSets = match && match.players.some((p) => p.setsWon > 0);
  const legs = match ? groupByLeg(match.visits) : [];

  return (
    <Box>
      <Header title={t('history.verlauf')} onBack={() => navigate(-1)} />
      <Container maxWidth="md" sx={{ py: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : !match ? null : (
          <>
            <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mb: 1 }}>
              {fmtDate(match.finishedAt)} · {match.format ? gameLabel({ mode: match.mode, format: match.format, checkout: match.checkout }) : `${match.mode} · ${match.formatLabel || ''}`}
              {match.isTraining ? ` · ${t('common.training')}` : ''}
            </Typography>

            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
              {match.players.map((p) => (
                <Paper
                  key={p.name}
                  variant="outlined"
                  sx={{ p: 1.5, textAlign: 'center', minWidth: 130, borderColor: p.won ? ACCENT.green : undefined }}
                >
                  <Typography sx={{ fontWeight: 800, color: p.type === 'bot' ? ACCENT.bot : 'text.primary' }}>
                    {p.name}
                    {p.won ? ' 🏆' : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {hasSets ? `${p.setsWon} ${t('history.sets')} · ` : ''}
                    {p.legsWon} {t('history.legs')} · Ø {p.average}
                  </Typography>
                </Paper>
              ))}
            </Stack>

            {legs.length === 0 ? (
              <Typography color="text.secondary" align="center">
                {t('history.noVerlauf')}
              </Typography>
            ) : (
              legs.map((leg) => (
                <Box key={`${leg.setNo}-${leg.legNo}`} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
                    {hasSets ? `${t('history.set')} ${leg.setNo} · ` : ''}
                    {t('history.leg')} {leg.legNo}
                  </Typography>
                  <Paper variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('history.round')}</TableCell>
                          <TableCell>{t('common.player')}</TableCell>
                          <TableCell>{t('history.throws')}</TableCell>
                          <TableCell align="right">{t('history.visit')}</TableCell>
                          <TableCell align="right">{t('history.rest')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {leg.visits.map((v, i) => {
                          const badge = kindChip[v.kind];
                          return (
                            <TableRow key={i}>
                              <TableCell sx={{ fontFamily: MONO }}>{v.roundNo}</TableCell>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{v.name}</TableCell>
                              <TableCell sx={{ fontFamily: MONO }}>
                                {v.darts.length ? v.darts.map((d) => d.label).join(' ') : '—'}
                                {badge && (
                                  <Chip size="small" color={badge.color} label={badge.label} sx={{ ml: 1, height: 18, fontSize: 10 }} />
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ fontFamily: MONO, fontWeight: 700 }}>
                                {v.kind === 'bust' ? 0 : v.score}
                              </TableCell>
                              <TableCell align="right" sx={{ fontFamily: MONO }}>{v.remaining}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              ))
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
