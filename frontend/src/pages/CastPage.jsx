import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CloseIcon from '@mui/icons-material/Close';
import PlayerCard from '../components/PlayerCard';
import SoundMenu from '../components/SoundMenu';
import { api } from '../api/client';
import useGame from '../hooks/useGame';
import useMatchSound from '../hooks/useMatchSound';
import useWakeLock from '../hooks/useWakeLock';
import { ACCENT } from '../theme';
import { useT } from '../i18n';

// Kompakte Kennzahl für die Anzeigetafel-Infobox.
function InfoStat({ label, value, sub }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 120 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 30, lineHeight: 1.1 }}>{value}</Typography>
      {sub ? <Typography variant="body2" color="text.secondary" noWrap>{sub}</Typography> : null}
    </Box>
  );
}

/** Eingabefreie Vollbild-Anzeigetafel eines laufenden Spiels (Live-Sync). */
export default function CastPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { game, error, loading } = useGame(id);
  const [comment, setComment] = useState('');
  useMatchSound(game, { announceOnEnter: true, onComment: setComment });
  // Bildschirm nur wach halten, solange ein Spiel läuft (nicht nach Spielende).
  useWakeLock(Boolean(game && game.status === 'playing'));
  // Avatare einmalig laden (nicht im Spielzustand, damit SSE-Pushes klein bleiben).
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
  const t = useT();
  const [fs, setFs] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onChange = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enterFs = () => {
    const el = rootRef.current || document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else enterFs();
  };
  const leave = () => {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    navigate('/cast');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100dvh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !game) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100dvh', gap: 2, p: 3, textAlign: 'center' }}>
        <Typography color="error">{error || t('cast.notFound')}</Typography>
        <IconButton onClick={() => navigate('/cast')} aria-label="Zurück"><CloseIcon /></IconButton>
      </Box>
    );
  }

  const isBestOf = game.format.satzLegMode === 'bestof';
  const sumMode = (game.inputMode || 'numpad') === 'sum';
  const roundNumber = game.roundNumber ?? 1;
  const finished = game.status === 'finished';
  const winner = finished ? game.players.find((p) => p.id === game.winnerId) : null;

  return (
    <Box ref={rootRef} sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
        <Typography sx={{ flex: 1, fontWeight: 800, fontSize: 22 }}>
          {game.checkoutLabel}
        </Typography>
        <Typography sx={{ mr: 2, fontWeight: 700, color: 'text.secondary' }}>
          {t('cast.round')} {roundNumber}
          {game.maxRounds > 0 ? ` / ${game.maxRounds}` : ''}
        </Typography>
        <SoundMenu />
        <Tooltip title={t('cast.fullscreen')}>
          <IconButton onClick={toggleFs} aria-label={t('cast.fullscreen')}>
            {fs ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title={t('cast.exit')}>
          <IconButton onClick={leave} aria-label={t('cast.exit')}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {comment && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontStyle: 'italic', fontWeight: 600 }} noWrap>
            💬 {comment}
          </Typography>
        </Box>
      )}

      {finished && (
        <Box sx={{ textAlign: 'center', py: 1, fontWeight: 800, fontSize: 24, color: '#fff', bgcolor: ACCENT.green }}>
          {winner ? t('cast.wins', { name: winner.name }) : t('cast.finished')}
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${game.players.length}, minmax(0, 1fr))`,
          gap: 3,
          alignContent: 'center',
          px: 3,
          pb: 3,
        }}
      >
        {game.players.map((p, idx) => (
          <PlayerCard
            key={p.id}
            player={p}
            checkoutSuggestion={p.isActive ? game.checkoutSuggestion : null}
            isBestOf={isBestOf}
            sumMode={sumMode}
            scoreboard
            format={game.format}
            avatar={avatarFor(p)}
            avatarSide={game.players.length === 2 ? (idx === 0 ? 'right' : 'left') : 'left'}
          />
        ))}
      </Box>

      {game.castInfo && game.status === 'playing' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap', px: 3, pb: 3 }}>
          <InfoStat
            label={t('cast.roundTop')}
            value={game.castInfo.roundTop.score > 0 ? game.castInfo.roundTop.score : '–'}
            sub={game.castInfo.roundTop.name || ''}
          />
          <InfoStat
            label={t('cast.gameTop')}
            value={game.castInfo.gameTop.score > 0 ? game.castInfo.gameTop.score : '–'}
            sub={game.castInfo.gameTop.name || ''}
          />
          <InfoStat
            label={t('cast.mostMiss')}
            value={game.castInfo.mostMiss.count > 0 ? game.castInfo.mostMiss.count : '–'}
            sub={game.castInfo.mostMiss.name || ''}
          />
        </Box>
      )}
    </Box>
  );
}
