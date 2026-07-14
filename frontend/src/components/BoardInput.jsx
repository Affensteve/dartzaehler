import { Box, Button, Stack } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import { ACCENT, MONO } from '../theme';
import { useT } from '../i18n';

// Standard-Dartboard: Sektor-Reihenfolge im Uhrzeigersinn ab oben (20).
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const C = 150;
const R_DBL_OUT = 145;
const R_DBL_IN = 130;
const R_TRP_OUT = 88;
const R_TRP_IN = 74;
const R_BULL_OUT = 20;
const R_BULL_IN = 9;

const CREAM = '#EFE3C3';
const DARK = '#26251F';

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))];
// Ringsegment (annularer Keil) von r1..r2 zwischen den Winkeln d1..d2 (Grad).
function wedge(r1, r2, d1, d2) {
  const [x1, y1] = pt(r2, d1);
  const [x2, y2] = pt(r2, d2);
  const [x3, y3] = pt(r1, d2);
  const [x4, y4] = pt(r1, d1);
  const f = (n) => n.toFixed(2);
  return `M${f(x1)} ${f(y1)} A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)} Z`;
}

// Board-Geometrie ist rein statisch (nur Konstanten) – einmalig beim Laden berechnen,
// nicht bei jedem Render.
const ZONES = [];
const LABELS = [];
SECTORS.forEach((seg, i) => {
  const c = -90 + 18 * i;
  const d1 = c - 9;
  const d2 = c + 9;
  const single = i % 2 === 0 ? CREAM : DARK;
  const ring = i % 2 === 0 ? ACCENT.undo : ACCENT.green;
  ZONES.push({ key: `si${seg}`, d: wedge(R_BULL_OUT, R_TRP_IN, d1, d2), fill: single, seg, mult: 1 });
  ZONES.push({ key: `so${seg}`, d: wedge(R_TRP_OUT, R_DBL_IN, d1, d2), fill: single, seg, mult: 1 });
  ZONES.push({ key: `t${seg}`, d: wedge(R_TRP_IN, R_TRP_OUT, d1, d2), fill: ring, seg, mult: 3 });
  ZONES.push({ key: `d${seg}`, d: wedge(R_DBL_IN, R_DBL_OUT, d1, d2), fill: ring, seg, mult: 2 });
  const [lx, ly] = pt((R_TRP_OUT + R_DBL_IN) / 2, c);
  LABELS.push({ key: `l${seg}`, x: lx, y: ly, seg, color: i % 2 === 0 ? DARK : CREAM });
});

/**
 * Eingabe per Antippen des Dartboards (Alternative zu Numpad/Freitext).
 * Ring bestimmt Single/Double/Triple – ruft für jeden Dart onThrow({segment,multiplier}).
 * Zusätzlich Fehlwurf (0), 0×2/0×3 (nur bei genug freien Pfeilen) und Undo.
 */
export default function BoardInput({ onThrow, onMisses, onUndo, disabled = false, canUndo = true, dartsThisTurn = 0 }) {
  const t = useT();
  const hit = (segment, multiplier) => {
    if (disabled) return;
    onThrow({ segment, multiplier });
  };


  const remaining = Math.max(0, 3 - (dartsThisTurn || 0));
  const missBtn = (n, label) => {
    const dis = disabled || n > remaining;
    return (
      <Button
        key={label}
        size="small"
        variant="outlined"
        disabled={dis}
        onClick={() => {
          if (dis) return;
          if (n === 1) onThrow({ segment: 0, multiplier: 1 });
          else if (onMisses) onMisses(n);
        }}
        sx={{ fontFamily: MONO, minWidth: 52 }}
      >
        {label}
      </Button>
    );
  };

  return (
    <Box sx={{ p: 1, pb: 'max(8px, env(safe-area-inset-bottom))', userSelect: 'none' }}>
      <Box sx={{ maxWidth: 340, mx: 'auto' }}>
        <svg
          viewBox="0 0 300 300"
          width="100%"
          style={{ display: 'block', touchAction: 'manipulation', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
          role="img"
          aria-label={t('board.aria')}
        >
          <circle cx={C} cy={C} r={149} fill="#111" />
          {ZONES.map((z) => (
            <path
              key={z.key}
              d={z.d}
              fill={z.fill}
              stroke="#111"
              strokeWidth={0.6}
              onClick={() => hit(z.seg, z.mult)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {LABELS.map((l) => (
            <text
              key={l.key}
              x={l.x}
              y={l.y}
              fill={l.color}
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ pointerEvents: 'none', fontFamily: MONO }}
            >
              {l.seg}
            </text>
          ))}
          <circle cx={C} cy={C} r={R_BULL_OUT} fill={ACCENT.green} stroke="#111" strokeWidth={0.6} onClick={() => hit(25, 1)} style={{ cursor: 'pointer' }} />
          <circle cx={C} cy={C} r={R_BULL_IN} fill={ACCENT.undo} stroke="#111" strokeWidth={0.6} onClick={() => hit(25, 2)} style={{ cursor: 'pointer' }} />
        </svg>
      </Box>

      <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ mt: 1 }}>
        {missBtn(1, '0')}
        {missBtn(2, '0×2')}
        {missBtn(3, '0×3')}
        <Button
          variant="contained"
          onClick={onUndo}
          disabled={disabled || !canUndo}
          sx={{ minWidth: 52, color: '#fff', bgcolor: ACCENT.undo, '&:hover': { bgcolor: ACCENT.undo, filter: 'brightness(1.05)' } }}
        >
          <UndoIcon />
        </Button>
      </Stack>
    </Box>
  );
}
