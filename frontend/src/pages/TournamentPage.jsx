import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Paper,
  Stack,
  Button,
  Chip,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AdjustIcon from '@mui/icons-material/Adjust';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Header from '../components/Header';
import TournamentTable from '../components/TournamentTable';
import { api } from '../api/client';
import { ACCENT, MONO } from '../theme';
import { useT, t as tr, gameLabel } from '../i18n';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Große Live-Anzeige einer laufenden Paarung (oben über den Gruppen). */
function LiveScore({ m, onOpen }) {
  const lv = m.live || {};
  const p1Active = lv.currentId === m.p1;
  const p2Active = lv.currentId === m.p2;
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 1, mt: 0.5 }}>
        <Typography noWrap sx={{ fontWeight: p1Active ? 800 : 600, color: p1Active ? ACCENT.green : 'text.primary' }}>
          {m.p1Name}
        </Typography>
        <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 22, textAlign: 'center' }}>
          {lv.p1Score} : {lv.p2Score}
        </Typography>
        <Typography noWrap sx={{ fontWeight: p2Active ? 800 : 600, color: p2Active ? ACCENT.green : 'text.primary', textAlign: 'right' }}>
          {m.p2Name}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {tr('tour.legs')} {lv.p1Legs}:{lv.p2Legs}
        </Typography>
        <Button size="small" variant="contained" onClick={() => onOpen(m)}>
          {tr('common.continue')}
        </Button>
      </Box>
    </>
  );
}

/** Ein Match: Live-Score / Start / Ergebnis / Bull-off je nach Status. */
function MatchItem({ m, onStart, onOpen, onBulloff }) {
  const strike = (name, id) =>
    m.status === 'done' && m.winnerId && id && id !== m.winnerId ? (
      <s style={{ opacity: 0.6 }}>{name}</s>
    ) : (
      <span style={{ fontWeight: m.winnerId === id ? 800 : 500 }}>{name}</span>
    );

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75, gap: 1 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap component="div">
          {strike(m.p1Name, m.p1)} <span style={{ opacity: 0.5 }}>vs.</span> {strike(m.p2Name, m.p2)}
        </Typography>
        {m.status === 'playing' && m.live && (
          <Typography variant="caption" color="text.secondary">
            {m.live.p1Score} : {m.live.p2Score} · {tr('tour.legs')} {m.live.p1Legs}:{m.live.p2Legs}
          </Typography>
        )}
        {m.status === 'done' && m.result && m.result.p1 && (
          <Typography variant="caption" color="text.secondary">
            {tr('tour.legs')} {m.result.p1.legs}:{m.result.p2.legs}
            {m.bulloff ? ' (Bull-off)' : ''}
          </Typography>
        )}
      </Box>

      {m.status === 'done' ? (
        <Chip size="small" label={`${tr('common.winner')}: ${m.winnerName}`} sx={{ bgcolor: ACCENT.green, color: '#fff' }} />
      ) : m.status === 'playing' ? (
        <Button size="small" variant="contained" onClick={() => onOpen(m)}>
          {tr('common.continue')}
        </Button>
      ) : m.bulloff ? (
        <Button
          size="small"
          variant="outlined"
          startIcon={<AdjustIcon />}
          disabled={!m.p1 || !m.p2}
          onClick={() => onBulloff(m)}
        >
          Bull-off
        </Button>
      ) : m.p1 && m.p2 ? (
        <Button size="small" variant="contained" color="error" startIcon={<PlayArrowIcon />} onClick={() => onStart(m)}>
          {tr('common.start')}
        </Button>
      ) : (
        <Chip size="small" variant="outlined" label={tr('tour.open')} />
      )}
    </Stack>
  );
}

// --- Klassischer KO-Baum -------------------------------------------------

// Geometrie der Verbindungslinien (muss zusammenpassen: STUB = GAP/2 + PAD).
const KO_GAP = 36; // Abstand zwischen den Runden-Spalten (Flex-Gap)
const KO_PAD = 10; // horizontales Innen-Padding der Runden-Spalte
const KO_STUB = KO_GAP / 2 + KO_PAD; // Länge der horizontalen Anschluss-Linie
const KO_CARD = 210; // Breite einer Match-Karte
const KO_SLOT_MIN = 120; // Mindesthöhe je Paarung → Abstand + längere Linien

/** Eine Spielerzeile in der KO-Karte: Name links, Legs im dunklen Kasten rechts. */
function KoRow({ name, id, legs, m, active }) {
  const isWinner = m.status === 'done' && m.winnerId && id && m.winnerId === id;
  const isLoser = m.status === 'done' && m.winnerId && id && m.winnerId !== id;
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 30 }}>
      <Box sx={{ flex: 1, minWidth: 0, px: 1, display: 'flex', alignItems: 'center' }}>
        <Typography
          noWrap
          sx={{
            fontSize: 13,
            fontWeight: isWinner ? 800 : 600,
            textDecoration: isLoser ? 'line-through' : 'none',
            opacity: isLoser ? 0.55 : 1,
            color: active ? ACCENT.green : 'text.primary',
          }}
        >
          {name || '—'}
        </Typography>
      </Box>
      <Box
        sx={{
          width: 30,
          display: 'grid',
          placeItems: 'center',
          bgcolor: isWinner ? ACCENT.green : 'text.primary',
          color: 'background.paper',
        }}
      >
        <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 800 }}>
          {legs == null ? '' : legs}
        </Typography>
      </Box>
    </Box>
  );
}

/** Eine KO-Paarung als Karte inkl. Aktions-Button je nach Status. */
function KoMatchCard({ m, onStart, onOpen, onBulloff }) {
  const lv = m.live || {};
  const res = m.result || {};
  const p1Legs =
    m.status === 'done' ? (res.p1 ? res.p1.legs : null) : m.status === 'playing' ? lv.p1Legs : null;
  const p2Legs =
    m.status === 'done' ? (res.p2 ? res.p2.legs : null) : m.status === 'playing' ? lv.p2Legs : null;
  const active1 = m.status === 'playing' && lv.currentId === m.p1;
  const active2 = m.status === 'playing' && lv.currentId === m.p2;

  let action = null;
  if (m.status === 'playing') {
    action = (
      <Button fullWidth size="small" variant="contained" onClick={() => onOpen(m)}>
        {tr('common.continue')}
      </Button>
    );
  } else if (m.status === 'pending' && m.bulloff) {
    action = (
      <Button fullWidth size="small" variant="outlined" startIcon={<AdjustIcon />} disabled={!m.p1 || !m.p2} onClick={() => onBulloff(m)}>
        Bull-off
      </Button>
    );
  } else if (m.status === 'pending' && m.p1 && m.p2) {
    action = (
      <Button fullWidth size="small" variant="contained" color="error" startIcon={<PlayArrowIcon />} onClick={() => onStart(m)}>
        {tr('common.start')}
      </Button>
    );
  }

  return (
    <Paper variant="outlined" sx={{ width: KO_CARD, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <KoRow name={m.p1Name} id={m.p1} legs={p1Legs} m={m} active={active1} />
      <Divider />
      <KoRow name={m.p2Name} id={m.p2} legs={p2Legs} m={m} active={active2} />
      {action && (
        <Box sx={{ p: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>{action}</Box>
      )}
    </Paper>
  );
}

/** Verbindungslinien-Styles für einen Match-Slot (klassischer Elbow-Baum). */
function koConnectors(mi, firstRound, lastRound) {
  const sx = {};
  const line = { borderColor: 'divider' };
  if (!firstRound) {
    sx['&::before'] = {
      content: '""',
      position: 'absolute',
      top: 'calc(50% - 1px)',
      right: '100%',
      width: KO_STUB,
      height: '2px',
      bgcolor: 'divider',
    };
  }
  if (!lastRound) {
    const top = mi % 2 === 0; // gerade Indizes = obere Hälfte des Paares
    sx['&::after'] = {
      content: '""',
      position: 'absolute',
      left: '100%',
      width: KO_STUB,
      borderRight: '2px solid',
      ...line,
      ...(top
        ? { top: '50%', bottom: 0, borderTop: '2px solid' }
        : { top: 0, bottom: '50%', borderBottom: '2px solid' }),
    };
  }
  return sx;
}

export default function TournamentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const tl = useT();
  const roundLabel = (r) => {
    if (!r || !r.key) return r ? r.name : '';
    if (r.key.indexOf('roundOf:') === 0) return tl('ko.roundOf', { n: r.key.split(':')[1] });
    return tl('ko.' + r.key);
  };
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [bullOff, setBullOff] = useState(null); // {kind:'match'|'group', ...}
  const busy = useRef(false);

  const load = useCallback(async () => {
    try {
      setT(await api.getTournament(id));
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    let closed = false;
    load();
    const es = new EventSource(`/api/tournaments/${id}/stream`);
    es.addEventListener('state', (e) => {
      if (closed) return;
      try {
        setT(JSON.parse(e.data));
      } catch (err) {
        /* ignore */
      }
    });
    es.addEventListener('deleted', () => {
      if (!closed) setError(tl('tour.deleted'));
    });
    return () => {
      closed = true;
      es.close();
    };
  }, [id, load]);

  const startMatch = async (m) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { gameId } = await api.startMatch(id, m.id);
      navigate(`/game/${gameId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      busy.current = false;
    }
  };

  const startKo = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setT(await api.startKo(id));
    } catch (e) {
      setError(e.message);
    } finally {
      busy.current = false;
    }
  };

  const resolveBullOff = async (body) => {
    try {
      setT(await api.tournamentBulloff(id, body));
      setBullOff(null);
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) {
    return (
      <Box>
        <Header title={tl('home.tournament')} onBack={() => navigate('/')} />
        <Container sx={{ py: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }
  if (!t) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const openGame = (m) => navigate(`/game/${m.gameId}`);
  const isKo = t.stage === 'ko';

  // Modell für den Baum-Export (inkl. Endstand bei beendetem Turnier).
  const buildExportModel = (mem) => {
    const bv = t.bestValues;
    const best = [];
    if (bv) {
      if (bv.bestAvg) best.push(`${tl('tour.bestAvg')}: ${bv.bestAvg.name} (${bv.bestAvg.value})`);
      if (bv.bestFinish) best.push(`${tl('tour.bestFinish')}: ${bv.bestFinish.name} (${bv.bestFinish.value})`);
      if (bv.most180) best.push(`${tl('tour.most180')}: ${bv.most180.name} (${bv.most180.value})`);
      else if (bv.mostMisses) best.push(`${tl('tour.mostMisses')}: ${bv.mostMisses.name} (${bv.mostMisses.value})`);
    }
    const finished = t.status === 'finished' && t.podium && t.podium.length > 0;
    return {
      title: t.name,
      subtitle: gameLabel({ mode: t.mode, format: t.format }),
      date: `${tl('tour.exportedBy')} ${new Date().toLocaleString()}`,
      rounds: (t.bracket || []).map((r) => ({
        name: roundLabel(r),
        matches: (r.matches || []).map(mem),
      })),
      third: t.thirdPlaceMatch
        ? { title: tl('tour.thirdPlaceShort'), match: mem(t.thirdPlaceMatch) }
        : null,
      standings: finished
        ? { title: tl('tour.finalStandings'), places: t.podium.map((p) => ({ name: p.name })), best }
        : null,
    };
  };
  const fileBase = (t.name || 'turnier').replace(/[^\w\-]+/g, '_');
  const doExport = async (kind) => {
    try {
      const mod = await import('../tournamentExport');
      const model = buildExportModel(mod.matchExportModel);
      await (kind === 'png' ? mod.exportTournamentPng : mod.exportTournamentPdf)(model, fileBase);
    } catch (e) {
      setError(e.message);
    }
  };
  const doExportPng = () => doExport('png');
  const doExportPdf = () => doExport('pdf');
  const playingMatches = [
    ...(t.groups || []).flatMap((g) => g.matches || []),
    ...(t.bracket || []).flatMap((r) => r.matches || []),
  ].filter((m) => m.status === 'playing');

  return (
    <Box>
      <Header title={t.name} subtitle={gameLabel({ mode: t.mode, format: t.format })} onBack={() => navigate('/')} />
      <Container maxWidth="lg" sx={{ py: 2 }}>
        {/* Abschluss: Podium + Bestwerte */}
        {t.status === 'finished' && t.podium && t.podium.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEventsIcon sx={{ color: ACCENT.double }} /> {tl('tour.finalStandings')}
            </Typography>
            <Stack spacing={0.5} sx={{ mb: t.bestValues ? 1.5 : 0 }}>
              {t.podium.map((p, i) => (
                <Typography key={p.playerId} sx={{ fontWeight: i === 0 ? 800 : 600 }}>
                  {MEDALS[i]} {p.name}
                </Typography>
              ))}
            </Stack>
            {t.bestValues && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {t.bestValues.bestAvg && (
                  <Chip size="small" variant="outlined" label={`${tl('tour.bestAvg')}: ${t.bestValues.bestAvg.name} (${t.bestValues.bestAvg.value})`} />
                )}
                {t.bestValues.bestFinish && (
                  <Chip size="small" variant="outlined" label={`${tl('tour.bestFinish')}: ${t.bestValues.bestFinish.name} (${t.bestValues.bestFinish.value})`} />
                )}
                {t.bestValues.most180 ? (
                  <Chip size="small" variant="outlined" label={`${tl('tour.most180')}: ${t.bestValues.most180.name} (${t.bestValues.most180.value})`} />
                ) : t.bestValues.mostMisses ? (
                  <Chip size="small" variant="outlined" label={`${tl('tour.mostMisses')}: ${t.bestValues.mostMisses.name} (${t.bestValues.mostMisses.value})`} />
                ) : null}
              </Stack>
            )}
          </Paper>
        )}

        {/* Offene Bull-off-Entscheidungen (Gruppen-Gleichstand) */}
        {t.pendingBullOffs && t.pendingBullOffs.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{tl('tour.bulloffNeeded')}</Typography>
            <Stack spacing={1}>
              {t.pendingBullOffs.map((tie) => (
                <Stack key={tie.group + tie.aId + tie.bId} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2">
                    {tl('tour.group')} {tie.group}: {tie.aName} vs. {tie.bName} –
                  </Typography>
                  <Button size="small" variant="outlined" onClick={() => resolveBullOff({ aId: tie.aId, bId: tie.bId, winnerId: tie.aId })}>
                    {tie.aName} {tl('tour.winsShort')}
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => resolveBullOff({ aId: tie.aId, bId: tie.bId, winnerId: tie.bId })}>
                    {tie.bName} {tl('tour.winsShort')}
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Alert>
        )}

        {/* Laufende Paarung(en) – oben, bei zwei aktiven 50/50 nebeneinander */}
        {playingMatches.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: playingMatches.length > 1 ? '1fr 1fr' : '1fr' },
              gap: 2,
              mb: 2,
            }}
          >
            {playingMatches.map((m) => (
              <Paper key={m.id} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {tl('tour.running')}{m.group ? ` · ${tl('tour.group')} ${m.group}` : ''}
                </Typography>
                <LiveScore m={m} onOpen={openGame} />
              </Paper>
            ))}
          </Box>
        )}

        {/* GRUPPENPHASE */}
        {!isKo && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: t.groups.length > 1 ? '1fr 1fr' : '1fr' },
                gap: 2,
              }}
            >
              {t.groups.map((g) => {
                const pending = g.matches.filter((m) => m.status === 'pending');
                const done = g.matches.filter((m) => m.status === 'done');
                return (
                  <Paper key={g.id} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                      {t.groups.length > 1 ? g.name : tl('tour.standings')}
                    </Typography>
                    <TournamentTable standings={g.standings} advance={t.ko && t.ko.enabled ? t.ko.advance : 0} />

                    {pending.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>{tl('tour.nextMatches')}</Typography>
                        {pending.map((m) => (
                          <MatchItem key={m.id} m={m} onOpen={openGame} onStart={startMatch} onBulloff={() => {}} />
                        ))}
                      </>
                    )}
                    {done.length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>{tl('tour.results')}</Typography>
                        {done.map((m) => (
                          <MatchItem key={m.id} m={m} onOpen={openGame} onStart={startMatch} onBulloff={() => {}} />
                        ))}
                      </>
                    )}
                  </Paper>
                );
              })}
            </Box>

            {t.ko && t.ko.enabled && (
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Button
                  variant="contained"
                  size="large"
                  disabled={!t.koReady}
                  startIcon={<EmojiEventsIcon />}
                  onClick={startKo}
                >
                  {tl('tour.startKo')}
                </Button>
                {!t.koReady && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {t.pendingBullOffs && t.pendingBullOffs.length
                      ? tl('tour.clearBulloffs')
                      : tl('tour.finishGroups')}
                  </Typography>
                )}
              </Box>
            )}
          </>
        )}

        {/* KO-PHASE: klassischer Turnierbaum */}
        {isKo && t.bracket && (
          <>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ mb: 1, gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{tl('tour.koPhase')}</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" startIcon={<ImageIcon />} onClick={doExportPng}>
                  PNG
                </Button>
                <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={doExportPdf}>
                  PDF
                </Button>
              </Stack>
            </Stack>
            <Box sx={{ overflowX: 'auto', pb: 1 }}>
              <Box sx={{ display: 'flex', gap: `${KO_GAP}px`, alignItems: 'stretch', minWidth: 'min-content', width: 'fit-content' }}>
                {t.bracket.map((round, ri) => {
                  const firstRound = ri === 0;
                  const lastRound = ri === t.bracket.length - 1;
                  return (
                    <Box
                      key={round.round}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        py: 1,
                        px: `${KO_PAD}px`,
                        flex: '0 0 auto',
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 800, mb: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}
                      >
                        {roundLabel(round)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        {round.matches.map((m, mi) => (
                          <Box
                            key={m.id}
                            sx={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              position: 'relative',
                              minHeight: KO_SLOT_MIN,
                              ...koConnectors(mi, firstRound, lastRound),
                            }}
                          >
                            <KoMatchCard
                              m={m}
                              onOpen={openGame}
                              onStart={startMatch}
                              onBulloff={(mm) => setBullOff({ kind: 'match', m: mm })}
                            />
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Spiel um Platz 3 – eigener Block unter dem Baum */}
            {t.thirdPlaceMatch && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  {tl('tour.thirdPlaceShort')}
                </Typography>
                <KoMatchCard
                  m={t.thirdPlaceMatch}
                  onOpen={openGame}
                  onStart={startMatch}
                  onBulloff={(mm) => setBullOff({ kind: 'match', m: mm })}
                />
              </Box>
            )}
          </>
        )}
      </Container>

      {/* Bull-off-Dialog für ein KO-/Platz-3-Match */}
      <Dialog open={Boolean(bullOff)} onClose={() => setBullOff(null)}>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>
          <AdjustIcon sx={{ color: ACCENT.undo, verticalAlign: 'middle', mr: 1 }} />
          Bull-off
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <DialogContentText sx={{ mb: 2 }}>{tl('tour.bulloffQ')}</DialogContentText>
          {bullOff && bullOff.m && (
            <Stack spacing={1}>
              <Button variant="contained" size="large" onClick={() => resolveBullOff({ matchId: bullOff.m.id, winnerId: bullOff.m.p1 })}>
                {bullOff.m.p1Name}
              </Button>
              <Button variant="contained" size="large" onClick={() => resolveBullOff({ matchId: bullOff.m.id, winnerId: bullOff.m.p2 })}>
                {bullOff.m.p2Name}
              </Button>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
