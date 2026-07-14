import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Stack,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import { ACCENT, MONO } from '../theme';
import { useT, t as tr } from '../i18n';

// Mit drei Darts nicht erreichbare Aufnahme-Summen (Client-Vorprüfung, spiegelt Backend).
const IMPOSSIBLE = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);

function validate(str) {
  const s = str.trim();
  if (s === '') return tr('sum.empty');
  if (!/^\d{1,3}$/.test(s)) return tr('sum.onlyInt');
  const n = Number(s);
  if (n > 180) return tr('sum.max180');
  if (IMPOSSIBLE.has(n)) return tr('sum.impossible', { n });
  return null;
}

/**
 * Freitext-Eingabe der Aufnahme-Summe (Alternative zum Numpad).
 * Das Feld bekommt automatisch Fokus und behält ihn nach jeder Eingabe, sodass
 * im reinen Tastatur-Modus fortlaufend „Zahl + Enter" getippt werden kann.
 * Beendet die Summe das Leg (sum === activeScore), wird vor dem Absenden die
 * Pfeilzahl (1–3) abgefragt – nur diese fließt in den Ø ein.
 * onSubmit(sum, checkoutDarts?) -> Promise<{ok, error}>; ein Bust ist KEIN Fehler.
 */
export default function SumInput({ onSubmit, onUndo, disabled = false, canUndo = true, activeScore }) {
  const t = useT();
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingSum, setPendingSum] = useState(null);
  const inputRef = useRef(null);

  const focusInput = () => {
    if (!disabled) requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
  };

  // Fokus zurückholen, sobald die Eingabe (wieder) aktiv und kein Dialog offen ist –
  // z. B. wenn nach einem Bot-/Gegnerzug wieder eingegeben werden kann.
  useEffect(() => {
    if (!disabled && !checkoutOpen) focusInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, checkoutOpen]);

  const finalize = async (sum, darts) => {
    const res = await onSubmit(sum, darts);
    if (res && res.ok) {
      setValue('');
      setError(null);
    } else {
      setError((res && res.error) || t('sum.rejected'));
    }
    focusInput();
  };

  const submit = async () => {
    if (disabled) return;
    const localError = validate(value);
    if (localError) {
      setError(localError);
      return;
    }
    const n = Number(value);
    // Checkout? -> Pfeilzahl abfragen (nur wenn die Summe das Leg exakt beendet).
    if (n > 0 && n === activeScore) {
      setPendingSum(n);
      setCheckoutOpen(true);
      return;
    }
    finalize(n);
  };

  const pickDarts = (d) => {
    setCheckoutOpen(false);
    const sum = pendingSum;
    setPendingSum(null);
    finalize(sum, d);
  };

  return (
    <Box sx={{ p: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))', userSelect: 'none' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {t('sum.hint')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          inputRef={inputRef}
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 3));
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={disabled}
          error={Boolean(error)}
          helperText={error || ' '}
          placeholder={t('sum.placeholder')}
          autoComplete="off"
          inputProps={{
            inputMode: 'numeric',
            pattern: '[0-9]*',
            style: { fontFamily: MONO, fontSize: 28, fontWeight: 700, textAlign: 'center' },
          }}
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          onClick={submit}
          disabled={disabled}
          sx={{ minHeight: 56, px: 3, bgcolor: ACCENT.green, '&:hover': { bgcolor: ACCENT.green, filter: 'brightness(1.05)' } }}
        >
          {t('sum.submit')}
        </Button>
        <Button
          onClick={onUndo}
          disabled={disabled || !canUndo}
          sx={{ minHeight: 56, minWidth: 56, color: '#fff', bgcolor: ACCENT.undo, '&:hover': { bgcolor: ACCENT.undo, filter: 'brightness(1.05)' } }}
        >
          <UndoIcon />
        </Button>
      </Box>

      <Dialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onKeyDown={(e) => {
          if (['1', '2', '3'].includes(e.key)) pickDarts(Number(e.key));
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>{t('sum.checkoutTitle')}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <DialogContentText sx={{ mb: 2 }}>
            {t('sum.checkoutQ', { n: pendingSum })}
          </DialogContentText>
          <Stack direction="row" spacing={1} justifyContent="center">
            {[1, 2, 3].map((d) => (
              <Button
                key={d}
                autoFocus={d === 3}
                variant="contained"
                size="large"
                onClick={() => pickDarts(d)}
                sx={{ minWidth: 64, fontSize: 22, fontWeight: 800 }}
              >
                {d}
              </Button>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
