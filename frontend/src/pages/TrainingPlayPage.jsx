import { useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Button,
  Paper,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Typography,
} from '@mui/material';
import Header from '../components/Header';
import { MODE_COMPONENTS } from '../components/training/TrainingModes';
import { MODE_BY_ID } from '../components/training/modes';
import { api } from '../api/client';
import { useT, useLang } from '../i18n';
import { localizeMode } from '../components/training/modes';

// Zeigt der Zwischenstand echten Fortschritt (nicht nur den Startzustand)?
function hasProgress(snap) {
  if (!snap) return false;
  return (
    (snap.idx || 0) > 0 ||
    (snap.i || 0) > 0 ||
    (snap.darts || 0) > 0 ||
    (snap.round || 1) > 1 ||
    (snap.total || 0) > 0 ||
    (snap.ok || 0) > 0
  );
}

export default function TrainingPlayPage() {
  const { mode } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLang();
  const [params] = useSearchParams();
  const playerId = Number(params.get('player'));
  const dartId = params.get('dart') ? Number(params.get('dart')) : null;

  const meta = localizeMode(MODE_BY_ID[mode], lang);
  const ModeComp = MODE_COMPONENTS[mode];

  const storageKey = `dz.train.${mode}.${playerId || 'anon'}`;
  const savedSnap = useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const clearSaved = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  // 'ask' (Zwischenstand vorhanden), 'resume' oder 'fresh'
  const [decision, setDecision] = useState(hasProgress(savedSnap) ? 'ask' : 'fresh');
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState(null);
  const finished = useRef(false);

  if (!meta || !ModeComp) {
    return (
      <Box>
        <Header title={t('train.title')} onBack={() => navigate('/training')} />
        <Container sx={{ py: 3 }}>
          <Typography>{t('tp.unknownMode')}</Typography>
        </Container>
      </Box>
    );
  }

  const saveProgress = (snap) => {
    if (finished.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  };

  const handleFinish = async (res) => {
    finished.current = true;
    clearSaved();
    let bests = null;
    try {
      if (playerId) {
        bests = await api.trainingRecord(playerId, mode, res.score, res.detail || null);
        if (res.scoring) await api.trainingScoring({ playerId, dartId, ...res.scoring });
      }
    } catch {
      /* Ergebnis trotzdem anzeigen */
    }
    setResult({ ...res, best: bests ? bests[mode] : null });
  };

  const again = () => {
    clearSaved();
    finished.current = false;
    setResult(null);
    setDecision('fresh');
    setRunKey((k) => k + 1);
  };

  return (
    <Box>
      <Header title={meta.name} subtitle={t('train.title')} onBack={() => navigate('/training')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        {decision === 'ask' ? (
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{t('tp.resumeTitle')}</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t('tp.resumeText')}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="outlined"
                onClick={() => {
                  clearSaved();
                  setDecision('fresh');
                  setRunKey((k) => k + 1);
                }}
              >
                {t('tp.fresh')}
              </Button>
              <Button variant="contained" onClick={() => setDecision('resume')}>
                {t('tp.resume')}
              </Button>
            </Stack>
          </Paper>
        ) : (
          <ModeComp
            key={`${decision}-${runKey}`}
            onFinish={handleFinish}
            onProgress={saveProgress}
            initial={decision === 'resume' ? savedSnap : null}
          />
        )}
      </Container>

      <Dialog open={Boolean(result)} onClose={() => {}}>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 800 }}>
          {result?.detail?.shanghai ? t('tp.shanghai') : result?.detail?.busted ? t('tp.bust') : t('tp.done')}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <DialogContentText>
            {t('tp.result')}: <b>{result?.score} {meta.unit}</b>
            {result?.detail?.avg != null ? ` · Ø ${result.detail.avg}` : ''}
            {result?.detail?.of != null ? ` ${t('tp.of')} ${result.detail.of}` : ''}
          </DialogContentText>
          {result?.best != null && (
            <DialogContentText sx={{ mt: 1 }}>
              {t('tp.best')}: <b>{result.best} {meta.unit}</b>
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button onClick={() => navigate('/training')}>{t('tp.toOverview')}</Button>
          <Button variant="contained" onClick={again}>{t('tp.again')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
