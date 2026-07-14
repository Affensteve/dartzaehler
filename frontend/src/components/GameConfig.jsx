import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DialpadIcon from '@mui/icons-material/Dialpad';
import KeyboardIcon from '@mui/icons-material/KeyboardOutlined';
import AdjustIcon from '@mui/icons-material/Adjust';
import { MONO, CARD_CUT } from '../theme';
import { useT, t as tr } from '../i18n';

// Reserviert 2 Zeilen für das Label (unten ausgerichtet), damit die Steuerungen
// zweier nebeneinander liegender Kacheln auch bei zweizeiligem Label auf gleicher
// Höhe stehen (z. B. iPhone 13 Pro, schmaler Screen).
function Tile({ label, info, children }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ minHeight: '2.4em', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', mb: 0.5 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {label}
          {info && (
            <Tooltip title={info} enterTouchDelay={0} leaveTouchDelay={6000} arrow>
              <InfoOutlinedIcon sx={{ fontSize: 15, cursor: 'help' }} />
            </Tooltip>
          )}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

function Stepper({ value, onChange, min = 1, max = 15 }) {
  return (
    <Paper
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}
    >
      <IconButton size="small" onClick={() => onChange(Math.max(min, value - 1))}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 20 }}>
        {value === 0 ? tr('cfg.off') : value}
      </Typography>
      <IconButton size="small" onClick={() => onChange(Math.min(max, value + 1))}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

/**
 * Konfigurations-Kacheln für ein X01-Match: Punkte, Check-In, Satz/Leg-Modus,
 * Ziel-Anzahl (Sätze/Legs bzw. nur Legs bei Best of), Rundenlimit fürs Ausbullen
 * und die Zählvariante (Numpad ↔ Freitext-Summe).
 */
// Sinnvolles Ausbullen-Rundenlimit je Spielmodus.
const ROUND_DEFAULTS = { 501: 20, 301: 15, 101: 10 };

export default function GameConfig({ config, setConfig, allowUnlimited = true }) {
  const t = useT();
  const set = (patch) => setConfig((c) => ({ ...c, ...patch }));
  const isBestOf = config.satzLegMode === 'bestof';
  const isUnlimited = config.satzLegMode === 'unlimited';

  return (
    <Paper variant="outlined" sx={{ p: 2, clipPath: CARD_CUT }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Tile label={t('cfg.points')}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={config.mode}
              onChange={(e, v) => v && set({ mode: v, maxRounds: ROUND_DEFAULTS[v] ?? config.maxRounds })}
            >
              <ToggleButton value={501}>501</ToggleButton>
              <ToggleButton value={301}>301</ToggleButton>
              <ToggleButton value={101}>101</ToggleButton>
            </ToggleButtonGroup>
          </Tile>

          <Tile label={t('cfg.checkin')}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={config.checkIn}
              onChange={(e, v) => v && set({ checkIn: v })}
            >
              <ToggleButton value="straight">{t('cfg.straightIn')}</ToggleButton>
              <ToggleButton value="double">{t('cfg.doubleIn')}</ToggleButton>
            </ToggleButtonGroup>
          </Tile>

          <Tile label={t('cfg.satzleg')} info={t('cfg.formatInfo')}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={config.satzLegMode}
              onChange={(e, v) => v && set({ satzLegMode: v })}
            >
              <ToggleButton value="firstto">{t('cfg.firstto')}</ToggleButton>
              <ToggleButton value="bestof">{t('cfg.bestof')}</ToggleButton>
              {allowUnlimited && <ToggleButton value="unlimited">{t('cfg.unlimited')}</ToggleButton>}
            </ToggleButtonGroup>
          </Tile>

          {isUnlimited ? (
            <Tile label={t('cfg.limit')} info={t('cfg.unlimitedInfo')}>
              <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 22, py: 0.75 }}>∞</Typography>
            </Tile>
          ) : isBestOf ? (
            <Tile label={t('cfg.legsBestOf')} info={t('cfg.bestofInfo')}>
              <Stepper value={config.legs} onChange={(v) => set({ legs: v })} />
            </Tile>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Tile label={t('cfg.sets')}>
                <Stepper value={config.sets} onChange={(v) => set({ sets: v })} />
              </Tile>
              <Tile label={t('cfg.legsPerSet')}>
                <Stepper value={config.legs} onChange={(v) => set({ legs: v })} />
              </Tile>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Tile label={t('cfg.ausbullen')} info={t('cfg.roundsInfo')}>
            <Stepper value={config.maxRounds} onChange={(v) => set({ maxRounds: v })} min={0} max={60} />
          </Tile>
          <Tile label={t('cfg.inputVariant')} info={t('cfg.inputInfo')}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={config.inputMode || 'numpad'}
              onChange={(e, v) => v && set({ inputMode: v })}
              sx={{ flexDirection: { xs: 'column', sm: 'row' }, '& .MuiToggleButtonGroup-grouped': { flex: 1 } }}
            >
              <ToggleButton value="numpad">
                <DialpadIcon fontSize="small" sx={{ mr: 0.5 }} />
                {t('cfg.numpad')}
              </ToggleButton>
              <ToggleButton value="sum">
                <KeyboardIcon fontSize="small" sx={{ mr: 0.5 }} />
                {t('cfg.freetext')}
              </ToggleButton>
              <ToggleButton value="board">
                <AdjustIcon fontSize="small" sx={{ mr: 0.5 }} />
                {t('cfg.board')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Tile>
        </Box>
      </Stack>
    </Paper>
  );
}
