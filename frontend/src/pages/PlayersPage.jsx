import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  List,
  ListItem,
  IconButton,
  TextField,
  MenuItem,
  Typography,
  Stack,
  Alert,
  Button,
  Link,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel,
  Collapse,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BadgeIcon from '@mui/icons-material/Badge';
import Avatar from '../components/Avatar';
import Header from '../components/Header';
import { api } from '../api/client';
import { ACCENT } from '../theme';
import { useT } from '../i18n';

const VOICE_OPTIONS = [
  { value: '', key: 'pl.voiceDefault' },
  { value: 'de-female', key: 'pl.voiceDeF' },
  { value: 'de-male', key: 'pl.voiceDeM' },
  { value: 'en-female', key: 'pl.voiceEnF' },
  { value: 'en-male', key: 'pl.voiceEnM' },
];

// Zeile mit Label links + Steuerelement (einheitlich in Anlegen & Bearbeiten).
// Label „Checkout-Modus" mit erklärendem Info-Tooltip (Double/Single/Master Out).
function checkoutModeLabel(t) {
  return (
    <>
      {t('pl.checkoutMode')}{' '}
      <Tooltip title={t('psl.checkoutInfo')} enterTouchDelay={0} leaveTouchDelay={8000} arrow>
        <InfoOutlinedIcon sx={{ fontSize: 14, verticalAlign: 'middle', cursor: 'help' }} />
      </Tooltip>
    </>
  );
}

function FieldRow({ label, children }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, flex: '0 0 auto' }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function CheckoutToggle({ value, onChange }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={value} onChange={(e, v) => v && onChange(v)}>
      <ToggleButton value="double">Double</ToggleButton>
      <ToggleButton value="single">Single</ToggleButton>
      <ToggleButton value="master">Master</ToggleButton>
    </ToggleButtonGroup>
  );
}

// Select ohne schwebendes Label (Label steht per FieldRow links daneben).
function DartSelect({ darts, value, onChange }) {
  return (
    <TextField
      select
      size="small"
      value={darts.some((d) => d.id === value) ? value : darts[0] ? darts[0].id : ''}
      onChange={(e) => onChange(Number(e.target.value))}
      sx={{ minWidth: 180 }}
    >
      {darts.map((d) => (
        <MenuItem key={d.id} value={d.id}>
          {d.name} · {d.weightGrams} g
        </MenuItem>
      ))}
    </TextField>
  );
}

function VoiceSelect({ value, onChange }) {
  const t = useT();
  return (
    <TextField
      select
      size="small"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 190 }}
    >
      {VOICE_OPTIONS.map((o) => (
        <MenuItem key={o.value || 'default'} value={o.value}>
          {t(o.key)}
        </MenuItem>
      ))}
    </TextField>
  );
}

export default function PlayersPage({ embedded = false }) {
  const navigate = useNavigate();
  const t = useT();
  const [players, setPlayers] = useState([]);
  const [darts, setDarts] = useState([]);
  const [error, setError] = useState(null);

  // Anlegen
  const [newName, setNewName] = useState('');
  const [newCheckout, setNewCheckout] = useState('double');
  const [newDartId, setNewDartId] = useState(null);
  const [newVoice, setNewVoice] = useState('');
  const [newPersonalize, setNewPersonalize] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  // Bearbeiten
  const [editId, setEditId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftCheckout, setDraftCheckout] = useState('double');
  const [draftDartId, setDraftDartId] = useState(null);
  const [draftPersonalize, setDraftPersonalize] = useState(false);
  const [draftVoice, setDraftVoice] = useState('');

  const reload = useCallback(() => {
    api.listPlayers().then(setPlayers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    reload();
    api
      .listDarts()
      .then((list) => {
        setDarts(list);
        if (list.length) setNewDartId((cur) => cur ?? list[0].id);
      })
      .catch(() => {});
  }, [reload]);

  const dartLabel = (id) => {
    const d = darts.find((x) => x.id === id) || darts[0];
    return d ? `${d.name} · ${d.weightGrams} g` : '—';
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await api.createPlayer({
        name,
        type: 'human',
        checkoutMode: newCheckout,
        dartId: newDartId || undefined,
        voice: newVoice,
        personalizeCheckout: newPersonalize,
      });
      setNewName('');
      setNewCheckout('double');
      setNewVoice('');
      setNewPersonalize(false);
      setNewOpen(false);
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setDraftName(p.name);
    setDraftCheckout(p.checkoutMode || 'double');
    setDraftDartId(p.dartId || (darts[0] && darts[0].id) || null);
    setDraftPersonalize(!!p.personalizeCheckout);
    setDraftVoice(p.voice || '');
  };

  const save = async (id) => {
    const name = draftName.trim();
    if (!name) return;
    try {
      await api.updatePlayer(id, {
        name,
        checkoutMode: draftCheckout,
        dartId: draftDartId || undefined,
        personalizeCheckout: draftPersonalize,
        voice: draftVoice,
      });
      setEditId(null);
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const inner = (
    <>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Neuen Spieler anlegen */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>{t('pl.new')}</Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <PersonAddIcon sx={{ color: ACCENT.green }} />
            <TextField
              variant="standard"
              fullWidth
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </Stack>

          <FieldRow label={checkoutModeLabel(t)}>
            <CheckoutToggle value={newCheckout} onChange={setNewCheckout} />
          </FieldRow>
          {darts.length > 0 && (
            <FieldRow label={t('common.dart')}>
              <DartSelect darts={darts} value={newDartId} onChange={setNewDartId} />
            </FieldRow>
          )}

          <Button
            size="small"
            onClick={() => setNewOpen((o) => !o)}
            endIcon={<ExpandMoreIcon sx={{ transform: newOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
            sx={{ mt: 1.5, textTransform: 'none' }}
          >
            {t('pl.moreSettings')}
          </Button>
          <Collapse in={newOpen} unmountOnExit>
            <FieldRow label={t('pl.voice')}>
              <VoiceSelect value={newVoice} onChange={setNewVoice} />
            </FieldRow>
            <FormControlLabel
              sx={{ mt: 1, ml: 0 }}
              control={<Switch size="small" checked={newPersonalize} onChange={(e) => setNewPersonalize(e.target.checked)} />}
              label={<Typography variant="body2">{t('pl.personalize')}</Typography>}
            />
          </Collapse>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={add} disabled={!newName.trim()}>
              {t('common.add')}
            </Button>
          </Stack>
        </Paper>

        {/* Spielerliste */}
        <Paper variant="outlined">
          {players.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              {t('pl.none')}
            </Typography>
          ) : (
            <List>
              {players.map((p) => {
                const editing = editId === p.id;
                return (
                  <ListItem
                    key={p.id}
                    alignItems="flex-start"
                    secondaryAction={
                      editing ? (
                        <Stack direction="row">
                          <IconButton color="success" aria-label={t('common.save')} onClick={() => save(p.id)}>
                            <CheckIcon />
                          </IconButton>
                          <IconButton aria-label={t('common.cancel')} onClick={() => setEditId(null)}>
                            <CloseIcon />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Stack direction="row">
                          {p.type !== 'bot' && (
                            <IconButton aria-label={t('pl.profile')} onClick={() => navigate(`/players/${p.id}/profile`)}>
                              <BadgeIcon />
                            </IconButton>
                          )}
                          <IconButton aria-label={t('common.edit')} onClick={() => startEdit(p)}>
                            <EditIcon />
                          </IconButton>
                        </Stack>
                      )
                    }
                  >
                    {p.type === 'bot' ? (
                      <SmartToyIcon sx={{ color: ACCENT.bot, mr: 1.5, mt: 0.5 }} />
                    ) : (
                      <Box sx={{ mr: 1.5, mt: 0.5 }}>
                        <Avatar photo={p.photo} color={p.color} name={p.name} size={40} />
                      </Box>
                    )}
                    <Box sx={{ flex: 1, mr: 6 }}>
                      {editing ? (
                        <>
                          <TextField
                            variant="standard"
                            fullWidth
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') save(p.id);
                              if (e.key === 'Escape') setEditId(null);
                            }}
                          />
                          <FieldRow label={checkoutModeLabel(t)}>
                            <CheckoutToggle value={draftCheckout} onChange={setDraftCheckout} />
                          </FieldRow>
                          {darts.length > 0 && (
                            <FieldRow label={t('common.dart')}>
                              <DartSelect darts={darts} value={draftDartId} onChange={setDraftDartId} />
                            </FieldRow>
                          )}
                          <FieldRow label={t('pl.voice')}>
                            <VoiceSelect value={draftVoice} onChange={setDraftVoice} />
                          </FieldRow>
                          <FormControlLabel
                            sx={{ mt: 1, ml: 0 }}
                            control={<Switch size="small" checked={draftPersonalize} onChange={(e) => setDraftPersonalize(e.target.checked)} />}
                            label={<Typography variant="body2">{t('pl.personalize')}</Typography>}
                          />
                        </>
                      ) : (
                        <>
                          <Link
                            component="button"
                            type="button"
                            underline="hover"
                            onClick={() => navigate(`/players/${p.id}`)}
                            sx={{ fontWeight: 700, fontSize: 18, color: p.type === 'bot' ? ACCENT.bot : 'text.primary' }}
                          >
                            {p.name}
                          </Link>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
                            <Typography variant="body2" color="text.secondary">
                              {p.type === 'bot' ? `${t('pl.bot')} · ${p.botLevel || ''}` : t('pl.playerRole')}
                            </Typography>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={{ single: 'Single Out', master: 'Master Out', double: 'Double Out' }[p.checkoutMode] || 'Double Out'}
                              sx={{ height: 20, fontSize: 11 }}
                            />
                            {darts.length > 0 && (
                              <Chip size="small" variant="outlined" label={dartLabel(p.dartId)} sx={{ height: 20, fontSize: 11 }} />
                            )}
                            {p.voice && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={(() => { const o = VOICE_OPTIONS.find((x) => x.value === p.voice); return o ? t(o.key) : p.voice; })()}
                                sx={{ height: 20, fontSize: 11 }}
                              />
                            )}
                            {p.personalizeCheckout && (
                              <Chip size="small" color="success" variant="outlined" label={t('pl.personalized')} sx={{ height: 20, fontSize: 11 }} />
                            )}
                          </Box>
                        </>
                      )}
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>
    </>
  );
  if (embedded) {
    return (
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          {t('pl.title')}
        </Typography>
        {inner}
      </Box>
    );
  }
  return (
    <Box>
      <Header title={t('pl.title')} onBack={() => navigate('/')} />
      <Container maxWidth="sm" sx={{ py: 3 }}>
        {inner}
      </Container>
    </Box>
  );
}
