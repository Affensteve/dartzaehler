import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Alert,
  Stack,
  Button,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Paper,
  CircularProgress,
  Snackbar,
  Tooltip,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import Header from '../components/Header';
import { api } from '../api/client';
import Avatar from '../components/Avatar';
import { ACCENT } from '../theme';
import { useT } from '../i18n';

// Auswählbare Profilfarben.
const COLORS = ['#006EC7', '#00A3A3', '#2E7D32', '#C62828', '#F9A825', '#6A1B9A', '#EC407A', '#455A64'];
// Lieblingsdoppel-Optionen (müssen zu dartRules.DOUBLE_FINISHERS passen).
const DOUBLES = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'Bull'];

// Verkleinert ein hochgeladenes Bild auf max. 320 px und liefert eine JPEG-Data-URI.
function fileToDataUrl(file, maxSize = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const RANGES = ['today', '7d', '30d', 'all'];

export default function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const fileRef = useRef(null);

  const [player, setPlayer] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  const [range, setRange] = useState('all');
  const [stats, setStats] = useState(null);
  const [doubles, setDoubles] = useState(null);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    api
      .getPlayer(id)
      .then((p) => {
        setPlayer(p);
        setForm({
          photo: p.photo || null,
          color: p.color || '',
          nickname: p.nickname || '',
          handedness: p.handedness || null,
          favoriteDouble: p.favoriteDouble || '',
          birthday: p.birthday || '',
          club: p.club || '',
          notes: p.notes || '',
        });
      })
      .catch((e) => setError(e.message));
    api.getPlayerDoubles(id).then(setDoubles).catch(() => setDoubles(null));
  }, [id]);

  useEffect(() => {
    api.getPlayerStats(id, range).then(setStats).catch(() => setStats(null));
    api
      .playerTimeline(id, range)
      .then((tl) => {
        if (Array.isArray(tl) && tl.length >= 2) setTrend(tl[tl.length - 1].average - tl[0].average);
        else setTrend(null);
      })
      .catch(() => setTrend(null));
  }, [id, range]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      set({ photo: await fileToDataUrl(file) });
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    try {
      const updated = await api.updatePlayerProfile(id, {
        photo: form.photo,
        color: form.color || null,
        nickname: form.nickname || null,
        handedness: form.handedness || null,
        favoriteDouble: form.favoriteDouble || null,
        birthday: form.birthday || null,
        club: form.club || null,
        notes: form.notes || null,
      });
      setPlayer(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) {
    return (
      <Box>
        <Header title={t('prof.title')} onBack={() => navigate('/verwaltung')} />
        <Container sx={{ py: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </Box>
    );
  }
  if (!player || !form) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const winPct = stats && stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  const trendStr = trend == null ? '–' : `${trend >= 0 ? '+' : ''}${trend.toFixed(2)}`;
  const rangeLabel = { today: t('common.today'), '7d': t('common.7d'), '30d': t('common.30d'), all: t('common.allTime') };

  const HL = ({ label, value, sub, color }) => (
    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', minWidth: 120, flex: '1 1 120px' }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 24, lineHeight: 1.15, color: color || 'text.primary' }}>{value}</Typography>
      {sub ? <Typography variant="caption" color="text.secondary">{sub}</Typography> : null}
    </Paper>
  );

  return (
    <Box>
      <Header title={player.nickname || player.name} onBack={() => navigate('/verwaltung')} />
      <Container maxWidth="sm" sx={{ py: 2 }}>
        {/* Kopf: Avatar + Name */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Avatar photo={form.photo} color={form.color} name={player.name} size={72} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>{player.name}</Typography>
            {form.nickname ? <Typography color="text.secondary" noWrap>„{form.nickname}"</Typography> : null}
          </Box>
        </Stack>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button size="small" variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => fileRef.current && fileRef.current.click()}>
            {t('prof.choosePhoto')}
          </Button>
          {form.photo && (
            <Button size="small" color="inherit" startIcon={<DeleteIcon />} onClick={() => set({ photo: null })}>
              {t('prof.removePhoto')}
            </Button>
          )}
        </Stack>

        {/* Profilfarbe */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>{t('prof.color')}</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {COLORS.map((c) => (
            <Box
              key={c}
              onClick={() => set({ color: c })}
              sx={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                bgcolor: c,
                cursor: 'pointer',
                border: '3px solid',
                borderColor: form.color === c ? 'text.primary' : 'transparent',
              }}
            />
          ))}
          <Box
            onClick={() => set({ color: '' })}
            sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px solid', borderColor: 'divider', fontSize: 12 }}
          >
            ✕
          </Box>
        </Stack>

        {/* Stammdaten */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{t('prof.details')}</Typography>
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField label={t('prof.nickname')} value={form.nickname} onChange={(e) => set({ nickname: e.target.value })} size="small" fullWidth />

          <Box>
            <Typography variant="caption" color="text.secondary">{t('prof.handedness')}</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              fullWidth
              value={form.handedness}
              onChange={(e, v) => set({ handedness: v })}
              sx={{ mt: 0.5 }}
            >
              <ToggleButton value="left">{t('prof.hLeft')}</ToggleButton>
              <ToggleButton value="right">{t('prof.hRight')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <TextField
            select
            label={t('prof.favoriteDouble')}
            value={form.favoriteDouble}
            onChange={(e) => set({ favoriteDouble: e.target.value })}
            size="small"
            fullWidth
            helperText={t('prof.favoriteDoubleHint')}
          >
            <MenuItem value="">{t('prof.none')}</MenuItem>
            {DOUBLES.map((d) => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </TextField>

          <TextField
            label={t('prof.birthday')}
            type="date"
            value={form.birthday}
            onChange={(e) => set({ birthday: e.target.value })}
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField label={t('prof.club')} value={form.club} onChange={(e) => set({ club: e.target.value })} size="small" fullWidth />
          <TextField label={t('prof.notes')} value={form.notes} onChange={(e) => set({ notes: e.target.value })} size="small" fullWidth multiline minRows={2} />

          <Button variant="contained" onClick={save}>{t('common.save')}</Button>
        </Stack>

        {/* Highlights */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('prof.highlights')}</Typography>
          <ToggleButtonGroup exclusive size="small" value={range} onChange={(e, v) => v && setRange(v)}>
            {RANGES.map((r) => (
              <ToggleButton key={r} value={r} sx={{ px: 1 }}>{rangeLabel[r]}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <HL label={t('prof.games')} value={stats ? stats.games : '–'} />
          <HL label={t('prof.wins')} value={stats ? stats.wins : '–'} sub={stats && stats.games ? `${winPct}%` : ''} />
          <HL label={t('prof.avg')} value={stats ? stats.average.toFixed(2) : '–'} />
          <HL label={t('prof.avgTrend')} value={trendStr} color={trend == null ? undefined : trend >= 0 ? ACCENT.green : ACCENT.undo} />
          <HL label={t('prof.bestLeg')} value={stats && stats.minDarts ? stats.minDarts : '–'} />
          <HL label={t('prof.highCheckout')} value={stats && stats.maxCheckout ? stats.maxCheckout : '–'} />
          <HL label={t('prof.count180')} value={stats ? stats.s180 : '–'} />
          <HL
            label={t('prof.favDoubleMeasured')}
            value={doubles && doubles.best ? doubles.best.label : '–'}
            sub={doubles && doubles.best ? `${Math.round(doubles.best.rate * 100)}%` : t('prof.noDoubleData')}
            color={ACCENT.green}
          />
          <HL
            label={t('prof.bogeyDouble')}
            value={doubles && doubles.worst ? doubles.worst.label : '–'}
            sub={doubles && doubles.worst ? `${Math.round(doubles.worst.rate * 100)}%` : ''}
            color={ACCENT.undo}
          />
        </Box>

        <Button startIcon={<BarChartIcon />} onClick={() => navigate(`/players/${id}`)} sx={{ mt: 1 }}>
          {t('prof.fullStats')}
        </Button>
      </Container>

      <Snackbar open={saved} autoHideDuration={2500} onClose={() => setSaved(false)} message={t('prof.saved')} />
    </Box>
  );
}
