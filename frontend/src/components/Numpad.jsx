import { useState } from 'react';
import { Box, Button, ButtonBase } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import { ACCENT, MONO } from '../theme';

const NUMBERS = [
  1, 2, 3, 4, 5, 6, 7,
  8, 9, 10, 11, 12, 13, 14,
  15, 16, 17, 18, 19, 20, 25,
];

/**
 * Dart-Numpad mit dynamischem Multiplikator (Single/Double/Triple).
 * - DOUBLE/TRIPLE schalten den Multiplikator für den nächsten Dart um.
 * - Nach jeder Zahl-Eingabe fällt der Multiplikator auf Single zurück.
 * - 0 mit DOUBLE/TRIPLE = 2 bzw. 3 Fehlwürfe am Stück (nur wenn genug Pfeile im
 *   Zug übrig sind – sonst deaktiviert). 25 bei Triple deaktiviert.
 */
export default function Numpad({ onThrow, onMisses, onUndo, disabled = false, canUndo = true, dartsThisTurn = 0 }) {
  const [mult, setMult] = useState(1);

  const send = (segment) => {
    if (disabled) return;
    onThrow({ segment, multiplier: mult });
    setMult(1); // pro Dart nur ein Multiplikator
  };

  const toggle = (m) => setMult((cur) => (cur === m ? 1 : m));

  // 0 mit Multiplikator = mehrere Fehlwürfe (Double 0 = 2, Triple 0 = 3).
  // Nur zulässig, wenn im aktuellen Zug noch genug Pfeile frei sind.
  const remainingDarts = Math.max(0, 3 - (dartsThisTurn || 0));
  const missCount = mult; // 1 | 2 | 3
  const missDisabled = disabled || missCount > remainingDarts;
  const missLabel = missCount === 3 ? '0×3' : missCount === 2 ? '0×2' : '0';
  const sendMiss = () => {
    if (missDisabled) return;
    if (missCount === 1) onThrow({ segment: 0, multiplier: 1 });
    else if (onMisses) onMisses(missCount);
    setMult(1);
  };

  const prefix = mult === 3 ? 'T' : mult === 2 ? 'D' : '';
  const label = (n) => {
    if (n === 25 && mult === 2) return 'Bull';
    return `${prefix}${n}`;
  };
  const numDisabled = (n) => disabled || (n === 25 && mult === 3);

  const numColor =
    mult === 3 ? ACCENT.triple : mult === 2 ? ACCENT.double : undefined;

  return (
    <Box sx={{ p: 1, pb: 'max(8px, env(safe-area-inset-bottom))', userSelect: 'none' }}>
      {/* Zahlen 1–20 + 25 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0.75,
        }}
      >
        {NUMBERS.map((n) => (
          <ButtonBase
            key={n}
            disabled={numDisabled(n)}
            onClick={() => send(n)}
            sx={{
              minHeight: 56,
              borderRadius: 0,
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: { xs: 16, sm: 18 },
              bgcolor: numColor || 'background.paper',
              color: numColor ? '#fff' : 'text.primary',
              border: '1.5px solid',
              borderColor: (t) => (numColor ? numColor : t.custom.rule),
              boxShadow: 'none',
              transition: 'transform .05s, background-color .1s',
              opacity: numDisabled(n) ? 0.35 : 1,
              '&:active': { transform: 'scale(0.94)' },
            }}
          >
            {label(n)}
          </ButtonBase>
        ))}
      </Box>

      {/* Aktionsreihe: 0 | DOUBLE | TRIPLE | UNDO */}
      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
        <Button
          variant="contained"
          disabled={missDisabled}
          onClick={sendMiss}
          sx={{
            flex: '0 0 18%',
            minHeight: 56,
            fontFamily: MONO,
            fontSize: 18,
            bgcolor: 'background.paper',
            color: numColor || 'text.primary',
            border: '1.5px solid',
            borderColor: (t) => (missCount > 1 ? numColor : t.custom.rule),
            opacity: missDisabled ? 0.35 : 1,
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          {missLabel}
        </Button>
        <Button
          onClick={() => toggle(2)}
          disabled={disabled}
          sx={{
            flex: 1,
            minHeight: 56,
            color: '#fff',
            fontWeight: 800,
            letterSpacing: '0.05em',
            bgcolor: ACCENT.double,
            outline: mult === 2 ? '3px solid #fff' : 'none',
            outlineOffset: '-3px',
            '&:hover': { bgcolor: ACCENT.double, filter: 'brightness(1.05)' },
          }}
        >
          DOUBLE
        </Button>
        <Button
          onClick={() => toggle(3)}
          disabled={disabled}
          sx={{
            flex: 1,
            minHeight: 56,
            color: '#fff',
            fontWeight: 800,
            letterSpacing: '0.05em',
            bgcolor: ACCENT.triple,
            outline: mult === 3 ? '3px solid #fff' : 'none',
            outlineOffset: '-3px',
            '&:hover': { bgcolor: ACCENT.triple, filter: 'brightness(1.05)' },
          }}
        >
          TRIPLE
        </Button>
        <Button
          onClick={onUndo}
          disabled={disabled || !canUndo}
          sx={{
            flex: '0 0 18%',
            minHeight: 56,
            color: '#fff',
            bgcolor: ACCENT.undo,
            '&:hover': { bgcolor: ACCENT.undo, filter: 'brightness(1.05)' },
          }}
        >
          <UndoIcon />
        </Button>
      </Box>
    </Box>
  );
}
