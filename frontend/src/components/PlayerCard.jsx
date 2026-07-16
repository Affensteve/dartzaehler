import { memo } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import Avatar from './Avatar';
import { ACCENT, MONO, DISPLAY, CARD_CUT } from '../theme';
import { useT } from '../i18n';

function DartBoxes({ darts, large = false }) {
  const boxes = [0, 1, 2].map((i) => darts[i]);
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: large ? 1 : 0.5 }}>
      {boxes.map((d, i) => (
        <Box
          key={i}
          sx={{
            width: large ? 56 : 44,
            height: large ? 44 : 34,
            borderRadius: 1,
            bgcolor: (t) => (t.palette.mode === 'dark' ? '#2b3140' : '#e2e6ec'),
            color: 'text.primary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: large ? 16 : 13,
          }}
        >
          {d ? d.label : ''}
        </Box>
      ))}
    </Box>
  );
}

// Leg-/Satz-Punkte als Kreise (●/○). Ohne bekanntes Ziel bzw. bei vielen wird die Zahl gezeigt.
function Pips({ won, target, color, size = 11 }) {
  if (!target || target > 9) return <b>{won}</b>;
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: 0.5, verticalAlign: 'middle' }}>
      {Array.from({ length: target }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: i < won ? color : 'transparent',
            border: i < won ? 'none' : '1.5px solid',
            borderColor: 'divider',
          }}
        />
      ))}
    </Box>
  );
}

/**
 * Spieler-Karte. Standard (Mobile): kompakte Zeile mit Leg-/Satz-Pips.
 * scoreboard=true (Desktop): Anzeigetafel – großer Restscore zentriert, aktiver
 * Spieler umrahmt, Leg-/Satz-Pips. Im Summen-Modus (sumMode) entfallen Einzelwürfe
 * und die Pfeilzahl; der Ø bleibt. `format` liefert die Ziele für die Pips.
 */
function PlayerCard({ player, checkoutSuggestion, isBestOf, sumMode = false, scoreboard = false, format, avatar = null, avatarSide = 'left' }) {
  const t = useT();
  const active = player.isActive;
  const isBot = player.type === 'bot';
  const accentColor = isBot ? ACCENT.bot : ACCENT.green;
  const legTarget = format && format.legsPerSet > 0 ? format.legsPerSet : 0;
  const setTarget = format && format.setsToWin > 0 ? format.setsToWin : 0;
  const darts = active ? player.currentTurn : player.lastTurnDarts;
  const visitScore = active
    ? player.turnScore
    : darts.length
    ? darts.reduce((sum, d) => sum + d.segment * d.multiplier, 0)
    : player.lastVisitScore || 0;
  const showVisit = active ? player.turnScore > 0 || darts.length > 0 : visitScore > 0;

  if (scoreboard) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          pt: 2.5,
          textAlign: 'center',
          position: 'relative',
          border: '1px solid',
          borderColor: (t) => t.custom.rule,
          borderTop: `4px solid ${active ? accentColor : player.teamColor || 'transparent'}`,
          bgcolor: active ? (t) => t.custom.panel : 'background.paper',
          clipPath: CARD_CUT,
        }}
      >
        {avatar && player.isTeam && Array.isArray(player.members) && player.members.length === 2 && avatar.avatars ? (
          // 2-gegen-2: beide Mitglieder links & rechts vom Score; aktiver Werfer hervorgehoben.
          [0, 1].map((i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: '46%',
                transform: 'translateY(-50%)',
                [i === 0 ? 'left' : 'right']: 12,
                borderRadius: '50%',
                p: '3px',
                border: '3px solid',
                borderColor: player.members[i].active ? ACCENT.green : 'transparent',
                boxShadow: player.members[i].active ? `0 0 0 4px ${ACCENT.green}33` : 'none',
                opacity: player.isActive && !player.members[i].active ? 0.4 : 1,
                transition: 'opacity .2s, border-color .2s',
              }}
            >
              <Avatar photo={avatar.avatars[i].photo} color={avatar.avatars[i].color} name={avatar.avatars[i].name} size={64} />
            </Box>
          ))
        ) : avatar ? (
          // Einzel-Avatar: vertikal mittig, so hoch wie Score + Würfe, zur Boxinnenseite
          // (linker Spieler → rechts, rechter Spieler → links).
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              [avatarSide === 'right' ? 'right' : 'left']: 20,
            }}
          >
            <Avatar photo={avatar.photo} color={avatar.color} name={player.name} size={120} avatars={avatar.avatars || null} />
          </Box>
        ) : null}
        <Typography
          noWrap
          sx={{
            fontFamily: DISPLAY,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontWeight: 700,
            fontSize: 20,
            color: isBot ? ACCENT.bot : 'text.primary',
          }}
        >
          {player.name}
          {avatar && avatar.nickname ? ` (${avatar.nickname})` : ''}
          {isBot && player.botLevel ? ` · ${player.botLevel}` : ''}
        </Typography>
        {player.isTeam && player.members && (
          <Typography variant="body2" sx={{ mb: 0.5 }} noWrap>
            {player.members.map((m, i) => (
              <Box component="span" key={i} sx={{ fontWeight: m.active ? 800 : 400, color: m.active ? ACCENT.green : 'text.secondary' }}>
                {i > 0 ? ' · ' : ''}{m.name}
              </Box>
            ))}
          </Typography>
        )}
        <Typography
          sx={{
            fontFamily: DISPLAY,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
            fontSize: { md: 72, lg: 88 },
            lineHeight: 1.05,
            color: 'text.primary',
          }}
        >
          {player.score}
        </Typography>

        {!sumMode && (
          <Box sx={{ mt: 1, minHeight: 44 }}>
            <DartBoxes darts={darts} large />
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1, color: 'text.secondary' }}>
          {!isBestOf && (
            <Box>
              <Typography variant="caption" sx={{ display: 'block' }}>{t('history.sets')}</Typography>
              <Pips won={player.setsWon} target={setTarget} color={accentColor} />
            </Box>
          )}
          <Box>
            <Typography variant="caption" sx={{ display: 'block' }}>{t('history.legs')}</Typography>
            <Pips won={player.legsWon} target={legTarget} color={accentColor} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5, color: 'text.secondary' }}>
          <Typography variant="body2">Ø {player.average.toFixed(2)}</Typography>
          {!sumMode && (
            <Typography variant="body2">
              <span aria-label={t('pc.dartsAria')} style={{ fontSize: 13 }}>🎯</span> {player.dartsThrown}
            </Typography>
          )}
          <Typography variant="body2">{t('pc.visit')}: {showVisit ? visitScore : '–'}</Typography>
        </Box>

        {active && checkoutSuggestion && (
          <Box sx={{ mt: 1.5 }}>
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={`Checkout: ${checkoutSuggestion.route.join(' → ')}`}
              sx={{ height: 36, borderWidth: 2, '& .MuiChip-label': { fontSize: '1.2rem', px: 1.75, fontWeight: 700 } }}
            />
            {checkoutSuggestion.personalized && (
              <Typography variant="caption" sx={{ display: 'block', color: ACCENT.green, mt: 0.5 }}>
                {t('pc.personalizedHint')}
              </Typography>
            )}
            {checkoutSuggestion.altRoute && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                {t('pc.checkoutAlt')}: {checkoutSuggestion.altRoute.join(' → ')}
              </Typography>
            )}
          </Box>
        )}
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'stretch',
        pl: 1.5,
        border: '1px solid',
        borderColor: (t) => t.custom.rule,
        bgcolor: active ? (t) => t.custom.panel : 'background.paper',
        clipPath: CARD_CUT,
      }}
    >
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, bgcolor: active ? ACCENT.green : 'transparent' }} />

      <Box sx={{ flex: 1, p: 1.5, pl: 1.5, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 96 }}>
            <Typography
              sx={{
                fontFamily: DISPLAY,
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 700,
                fontSize: { xs: 40, sm: 48 },
                lineHeight: 1,
                color: 'text.primary',
              }}
            >
              {player.score}
            </Typography>
            <Typography
              sx={{
                fontFamily: DISPLAY,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                fontWeight: 700,
                color: isBot ? ACCENT.bot : 'text.secondary',
                mt: 0.5,
              }}
              noWrap
            >
              {player.name}
              {isBot && player.botLevel ? ` · ${player.botLevel}` : ''}
            </Typography>
            {player.isTeam && player.members && (
              <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                {player.members.map((m, i) => (
                  <Box component="span" key={i} sx={{ fontWeight: m.active ? 800 : 400, color: m.active ? ACCENT.green : 'text.secondary' }}>
                    {i > 0 ? ' · ' : ''}{m.name}
                  </Box>
                ))}
              </Typography>
            )}
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            {sumMode ? (
              <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 30, minWidth: 70, minHeight: 40, lineHeight: '40px' }}>
                {showVisit ? visitScore : '–'}
              </Typography>
            ) : (
              <>
                <DartBoxes darts={darts} />
                <Typography sx={{ fontFamily: MONO, fontWeight: 700, mt: 0.5, minHeight: 20 }}>
                  {darts.length ? visitScore : ''}
                </Typography>
              </>
            )}
          </Box>

          <Box sx={{ ml: 'auto', textAlign: 'right', color: 'text.secondary' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'flex-end' }}>
              {!isBestOf && (
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                  <Typography variant="caption">{t('history.sets')}</Typography>
                  <Pips won={player.setsWon} target={setTarget} color={accentColor} size={9} />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <Typography variant="caption">{t('history.legs')}</Typography>
                <Pips won={player.legsWon} target={legTarget} color={accentColor} size={9} />
              </Box>
            </Box>
            {!sumMode && (
              <Typography variant="body2" sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center', mt: 0.25 }}>
                <span aria-label={t('pc.dartsThrownAria')} style={{ fontSize: 14 }}>🎯</span> {player.dartsThrown}
              </Typography>
            )}
            <Typography variant="body2">Ø {player.average.toFixed(2)}</Typography>
          </Box>
        </Box>

        {active && checkoutSuggestion && (
          <Box sx={{ mt: 1 }}>
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={`Checkout: ${checkoutSuggestion.route.join(' → ')}`}
              sx={{ height: 36, borderWidth: 2, '& .MuiChip-label': { fontSize: '1.2rem', px: 1.75, fontWeight: 700 } }}
            />
            {checkoutSuggestion.personalized && (
              <Typography variant="caption" sx={{ display: 'block', color: ACCENT.green, mt: 0.5 }}>
                {t('pc.personalizedHint')}
              </Typography>
            )}
            {checkoutSuggestion.altRoute && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                {t('pc.checkoutAlt')}: {checkoutSuggestion.altRoute.join(' → ')}
              </Typography>
            )}
          </Box>
        )}
        <Chip
          size="small"
          label={{ single: 'Single Out', master: 'Master Out', double: 'Double Out' }[player.checkoutMode] || 'Double Out'}
          sx={{ mt: 1, height: 20, fontSize: 11 }}
          variant="outlined"
        />
      </Box>
    </Paper>
  );
}

// Nur neu rendern, wenn sich die für diese Karte relevanten Daten ändern.
// Da der Spielzustand bei jedem SSE-Push frisch aus JSON geparst wird, ist jedes
// player-Objekt eine neue Referenz – deshalb Inhalts- statt Referenzvergleich.
// (Sprachwechsel umgeht memo via useSyncExternalStore in useT.)
function propsEqual(a, b) {
  return (
    a.isBestOf === b.isBestOf &&
    a.sumMode === b.sumMode &&
    a.scoreboard === b.scoreboard &&
    a.avatarSide === b.avatarSide &&
    JSON.stringify(a.player) === JSON.stringify(b.player) &&
    JSON.stringify(a.checkoutSuggestion) === JSON.stringify(b.checkoutSuggestion) &&
    JSON.stringify(a.format) === JSON.stringify(b.format) &&
    JSON.stringify(a.avatar) === JSON.stringify(b.avatar)
  );
}

export default memo(PlayerCard, propsEqual);
