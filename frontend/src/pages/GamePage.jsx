import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Stack,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  Fade,
  Chip,
  LinearProgress,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AdjustIcon from '@mui/icons-material/Adjust';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import Header from '../components/Header';
import PlayerCard from '../components/PlayerCard';
import Numpad from '../components/Numpad';
import SumInput from '../components/SumInput';
import BoardInput from '../components/BoardInput';
import useGame from '../hooks/useGame';
import useMatchSound from '../hooks/useMatchSound';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT, useLang, gameLabel } from '../i18n';

export default function GamePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const { game, error, loading, throwDart, throwMisses, submitVisit, undo, bullOff, finishGame } = useGame(id);
  useMatchSound(game);
  const [askAbort, setAskAbort] = useState(false);
  const [askFinish, setAskFinish] = useState(false);
  // Refs der gestapelten Mobil-Karten – zum Einscrollen des aktiven Spielers.
  const cardRefs = useRef({});
  // Avatare (Foto/Farbe) einmalig laden – NICHT im Spielzustand, um SSE/Persistenz schlank zu halten.
  const [avatarMap, setAvatarMap] = useState({});
  useEffect(() => {
    api
      .listPlayers()
      .then((list) => {
        const m = {};
        for (const pl of list)
          if (pl.photo || pl.color || pl.nickname) m[pl.id] = { photo: pl.photo, color: pl.color, nickname: pl.nickname };
        setAvatarMap(m);
      })
      .catch(() => {});
  }, []);
  const avatarFor = (p) =>
    p.isTeam && Array.isArray(p.members)
      ? { avatars: p.members.map((m) => ({ ...(avatarMap[m.dbId] || {}), name: m.name })) }
      : p.dbId != null
      ? avatarMap[p.dbId]
      : null;

  const activeIdx = game && game.status === 'playing' ? game.currentPlayerIndex : -1;
  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    const active = game.players[game.currentPlayerIndex];
    const el = active && cardRefs.current[active.id];
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, game && game.status]);

  const finish = async () => {
    setAskFinish(false);
    await finishGame();
  };

  const abort = async () => {
    setAskAbort(false);
    const tid = game?.tournamentId;
    try {
      if (!tid) await api.deleteGame(id);
    } catch {
      /* egal - wir verlassen die Seite ohnehin */
    }
    navigate(tid ? `/tournament/${tid}` : '/');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !game) {
    return (
      <Box sx={{ p: 3 }}>
        <Header title="Spiel" />
        <Typography color="error" sx={{ mt: 2 }}>
          {error || t('common.notFound')}
        </Typography>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/')}>
          {t('common.toHome')}
        </Button>
      </Box>
    );
  }

  const current = game.players[game.currentPlayerIndex];
  const botTurn =
    current && current.type === 'bot' && game.status === 'playing' && !game.awaitingBullOff;
  const finished = game.status === 'finished';
  const winner = finished ? game.players.find((p) => p.id === game.winnerId) : null;
  const isBestOf = game.format.satzLegMode === 'bestof';
  const isUnlimited = game.format.satzLegMode === 'unlimited';
  const roundNumber = game.roundNumber ?? 1;
  const inputMode = game.inputMode || 'numpad'; // vor Spielbeginn festgelegte Zählvariante

  const who = game.messagePlayer;
  let banner = null;
  if (game.message === 'BUST')
    banner = { text: who ? t('game.bust', { name: who }) : t('game.bustNoName'), bg: ACCENT.undo };
  else if (game.message === 'CHECKOUT')
    banner = { text: who ? t('game.checkout', { name: who }) : t('game.checkoutNoName'), bg: ACCENT.green };
  else if (game.message === 'BULLOFF_WIN')
    banner = {
      text: who ? t('game.bulloffWin', { name: who }) : t('game.bulloffWinNoName'),
      bg: ACCENT.green,
    };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <Header
        title="X01"
        subtitle={gameLabel({ mode: game.mode, format: game.format, checkout: (() => { const set = new Set(game.players.map((p) => p.checkoutMode || 'double')); return set.size > 1 ? 'mixed' : [...set][0]; })() })}
        onBack={() => navigate(game.tournamentId ? `/tournament/${game.tournamentId}` : '/')}
        right={
          !finished && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {isUnlimited && (
                <Tooltip title={t('game.finishTip')}>
                  <IconButton color="inherit" onClick={() => setAskFinish(true)} aria-label={t('game.finishTip')}>
                    <SportsScoreIcon />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t('game.abortTip')}>
                <IconButton color="inherit" onClick={() => setAskAbort(true)} aria-label={t('game.abortTip')}>
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          )
        }
      />

      <Box sx={{ minHeight: 6 }}>{botTurn && <LinearProgress color="warning" />}</Box>

      <Box
        sx={{
          textAlign: 'center',
          py: 0.5,
          fontSize: 15,
          fontWeight: 800,
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {t('game.round')} {roundNumber}
        {game.maxRounds > 0 ? (
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            {' '}/ {game.maxRounds}
          </Box>
        ) : null}
      </Box>

      <Fade in={Boolean(banner)} timeout={200} unmountOnExit>
        <Box sx={{ textAlign: 'center', py: 0.5, fontWeight: 800, color: '#fff', bgcolor: banner?.bg }}>
          {banner?.text}
        </Box>
      </Fade>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {/* Mobile: gestapelt (unverändert) */}
        <Box
          sx={{
            display: { xs: 'grid', md: 'none' },
            maxWidth: 720,
            mx: 'auto',
            gridTemplateColumns: '1fr',
            gap: 1,
          }}
        >
          {game.players.map((p) => (
            <Box
              key={p.id}
              ref={(el) => {
                cardRefs.current[p.id] = el;
              }}
              sx={{ scrollMarginTop: 8, scrollMarginBottom: 8 }}
            >
              <PlayerCard
                player={p}
                checkoutSuggestion={p.isActive ? game.checkoutSuggestion : null}
                isBestOf={isBestOf}
                sumMode={inputMode === 'sum'}
                format={game.format}
              />
            </Box>
          ))}
        </Box>
        {/* Desktop: Anzeigetafel – Spieler nebeneinander */}
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            mx: 'auto',
            maxWidth: 1100,
            gridTemplateColumns: `repeat(${game.players.length}, minmax(0, 1fr))`,
            gap: 2,
          }}
        >
          {game.players.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              checkoutSuggestion={p.isActive ? game.checkoutSuggestion : null}
              isBestOf={isBestOf}
              sumMode={inputMode === 'sum'}
              scoreboard
              format={game.format}
            />
          ))}
        </Box>
        {botTurn && (
          <Typography sx={{ textAlign: 'center', mt: 2, color: ACCENT.bot, fontWeight: 700 }}>
            {t('game.botThrows', { name: current.name })}
          </Typography>
        )}
      </Box>

      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
        {inputMode === 'sum' ? (
          <SumInput
            onSubmit={submitVisit}
            onUndo={undo}
            canUndo={game.canUndo}
            disabled={botTurn || finished || game.awaitingBullOff}
            activeScore={current ? current.score : null}
          />
        ) : inputMode === 'board' ? (
          <BoardInput
            onThrow={throwDart}
            onMisses={throwMisses}
            dartsThisTurn={current && current.currentTurn ? current.currentTurn.length : 0}
            onUndo={undo}
            canUndo={game.canUndo}
            disabled={botTurn || finished || game.awaitingBullOff}
          />
        ) : (
          <Numpad
            onThrow={throwDart}
            onMisses={throwMisses}
            dartsThisTurn={current && current.currentTurn ? current.currentTurn.length : 0}
            onUndo={undo}
            canUndo={game.canUndo}
            disabled={botTurn || finished || game.awaitingBullOff}
          />
        )}
      </Box>

      <Dialog open={askAbort} onClose={() => setAskAbort(false)}>
        <DialogTitle>{t('game.abortQ')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {game.tournamentId ? t('game.abortTournamentText') : t('game.abortText')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAskAbort(false)}>{t('game.continue')}</Button>
          <Button color="error" variant="contained" onClick={abort}>
            {t('game.abort')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={askFinish} onClose={() => setAskFinish(false)}>
        <DialogTitle>{t('game.finishQ')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('game.finishText')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAskFinish(false)}>{t('game.continue')}</Button>
          <Button variant="contained" onClick={finish}>
            {t('game.finishBtn')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(game.awaitingBullOff)} onClose={() => {}}>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <AdjustIcon sx={{ fontSize: 44, color: ACCENT.undo }} />
          <Typography variant="h6" sx={{ fontWeight: 800, mt: 1 }}>
            {t('game.ausbullen')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <DialogContentText sx={{ mb: 2 }}>
            {t('game.ausbullenText', { n: game.maxRounds })}
          </DialogContentText>
          <Stack spacing={1}>
            {game.players.map((p) => (
              <Button key={p.id} variant="outlined" size="large" onClick={() => bullOff(p.id)}>
                {p.name}
              </Button>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={finished} onClose={() => {}}>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: ACCENT.double }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
            {winner ? t('game.wins', { name: winner.name }) : t('game.over')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {winner && (
            <Typography color="text.secondary">
              {isBestOf ? '' : `${winner.setsWon} Sätze · `}Ø {winner.average.toFixed(2)}
            </Typography>
          )}
          {game.achievementsEarned && game.achievementsEarned.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                {t('game.newAchievements')}
              </Typography>
              {game.achievementsEarned.map((e) => (
                <Box key={e.playerId} sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {e.playerName}
                  </Typography>
                  <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {e.items.map((a) => (
                      <Chip key={a.id} size="small" label={`${a.icon} ${lang === 'de' ? a.name : a.nameEn}`} />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          {game.tournamentId ? (
            <Button variant="contained" onClick={() => navigate(`/tournament/${game.tournamentId}`)}>
              {t('game.backToTournament')}
            </Button>
          ) : (
            <>
              <Button onClick={() => navigate('/')}>{t('game.home')}</Button>
              <Button variant="contained" onClick={() => navigate('/setup')}>
                {t('game.newGame')}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
