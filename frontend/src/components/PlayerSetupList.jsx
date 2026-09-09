import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Stack,
  Menu,
  MenuItem,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useState } from 'react';
import { ACCENT } from '../theme';
import { useT } from '../i18n';

let keyCounter = 0;
const nextKey = () => `p${Date.now()}_${keyCounter++}`;

export function makeHuman(name = '') {
  return { key: nextKey(), id: undefined, name, type: 'human', botLevel: null, checkoutMode: 'double', dartId: null };
}
export function makeBot(level = 'medium', push = false) {
  const labels = { easy: 'Easy Bot', easyplus: 'Anfänger+ Bot', medium: 'Medium Bot', hard: 'Hard Bot', adaptive: 'Adaptiv Bot' };
  return {
    key: nextKey(),
    id: undefined,
    name: labels[level] || 'Bot',
    type: 'bot',
    botLevel: level,
    adaptivePush: level === 'adaptive' ? push : false,
    checkoutMode: 'double',
    dartId: null,
  };
}

/**
 * Verwaltet die Spielerliste im Setup: Menschen (Auswahl gespeicherter Namen,
 * inkl. Bearbeiten per Stift mit Persistierung), Bots, Checkout-Modus, Entfernen.
 * @param {Function} onRename async (id, name) => void – benennt einen gespeicherten Spieler um
 */
export default function PlayerSetupList({ players, setPlayers, savedPlayers = [], darts = [], onRename, allowBots = true }) {
  const t = useT();
  const [botAnchor, setBotAnchor] = useState(null);
  const [editKey, setEditKey] = useState(null);
  const [draft, setDraft] = useState('');

  const update = (key, patch) =>
    setPlayers((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const remove = (key) => setPlayers((list) => list.filter((p) => p.key !== key));

  const addBot = (level, push = false) => {
    setPlayers((list) => [...list, makeBot(level, push)]);
    setBotAnchor(null);
  };

  const startEdit = (p) => {
    setDraft(p.name);
    setEditKey(p.key);
  };

  const saveEdit = async (p) => {
    const name = draft.trim();
    if (!name) return;
    update(p.key, { name });
    setEditKey(null);
    if (p.id && onRename) {
      try {
        await onRename(p.id, name);
      } catch (e) {
        /* ignore – lokaler Name bleibt gesetzt */
      }
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setPlayers((l) => [...l, makeHuman('')])}
          fullWidth
        >
          {t('psl.player')}
        </Button>
        {allowBots && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<SmartToyIcon />}
            onClick={(e) => setBotAnchor(e.currentTarget)}
            fullWidth
          >
            {t('psl.bot')}
          </Button>
        )}
        <Menu anchorEl={botAnchor} open={Boolean(botAnchor)} onClose={() => setBotAnchor(null)}>
          <MenuItem onClick={() => addBot('easy')}>{t('psl.easyBot')}</MenuItem>
          <MenuItem onClick={() => addBot('easyplus')}>{t('psl.easyplusBot')}</MenuItem>
          <MenuItem onClick={() => addBot('medium')}>{t('psl.mediumBot')}</MenuItem>
          <MenuItem onClick={() => addBot('hard')}>{t('psl.hardBot')}</MenuItem>
          <MenuItem onClick={() => addBot('adaptive', false)}>{t('psl.adaptiveFair')}</MenuItem>
          <MenuItem onClick={() => addBot('adaptive', true)}>{t('psl.adaptivePush')}</MenuItem>
        </Menu>
      </Stack>

      <Stack spacing={1}>
        {players.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            {t('psl.none')}
          </Typography>
        )}
        {players.map((p, idx) => {
          const editing = editKey === p.key;
          return (
            <Paper key={p.key} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                {p.type === 'bot' ? (
                  <SmartToyIcon sx={{ color: ACCENT.bot }} />
                ) : (
                  <PersonAddIcon sx={{ color: ACCENT.green }} />
                )}

                {editing ? (
                  <TextField
                    variant="standard"
                    fullWidth
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(p);
                      if (e.key === 'Escape') setEditKey(null);
                    }}
                    InputProps={{ style: { fontWeight: 700 } }}
                  />
                ) : p.type === 'bot' ? (
                  <TextField
                    variant="standard"
                    fullWidth
                    value={p.name}
                    onChange={(e) => update(p.key, { name: e.target.value })}
                    InputProps={{ style: { fontWeight: 700 } }}
                  />
                ) : (
                  <Autocomplete
                    freeSolo
                    fullWidth
                    options={savedPlayers}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                    value={p.name}
                    onChange={(e, val) => {
                      if (val && typeof val === 'object')
                        update(p.key, {
                          name: val.name,
                          id: val.id,
                          checkoutMode: val.checkoutMode || 'double',
                          dartId: val.dartId ?? null,
                        });
                      else update(p.key, { name: val || '', id: undefined });
                    }}
                    onInputChange={(e, val, reason) => {
                      if (reason !== 'input') return;
                      const match = savedPlayers.find(
                        (sp) => sp.name.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (match)
                        update(p.key, {
                          name: match.name,
                          id: match.id,
                          checkoutMode: match.checkoutMode || 'double',
                          dartId: match.dartId ?? null,
                        });
                      else update(p.key, { name: val, id: undefined });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="standard"
                        placeholder={t('psl.placeholder', { n: idx + 1 })}
                        InputProps={{ ...params.InputProps, style: { fontWeight: 700 } }}
                      />
                    )}
                  />
                )}

                {editing ? (
                  <>
                    <IconButton color="success" aria-label={t('psl.saveName')} onClick={() => saveEdit(p)}>
                      <CheckIcon />
                    </IconButton>
                    <IconButton aria-label={t('common.cancel')} onClick={() => setEditKey(null)}>
                      <CloseIcon />
                    </IconButton>
                  </>
                ) : (
                  <>
                    {p.type === 'human' && p.name.trim() !== '' && (
                      <IconButton aria-label={t('psl.editName')} onClick={() => startEdit(p)}>
                        <EditIcon />
                      </IconButton>
                    )}
                    <IconButton onClick={() => remove(p.key)} aria-label={t('psl.remove')}>
                      <DeleteIcon />
                    </IconButton>
                  </>
                )}
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                    {t('psl.checkoutMode')}
                    <Tooltip title={t('psl.checkoutInfo')} enterTouchDelay={0} leaveTouchDelay={8000} arrow>
                      <InfoOutlinedIcon sx={{ fontSize: 14, cursor: 'help' }} />
                    </Tooltip>
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={p.checkoutMode}
                    onChange={(e, v) => v && update(p.key, { checkoutMode: v })}
                    sx={{ ml: 1 }}
                  >
                    <ToggleButton value="double">Double</ToggleButton>
                    <ToggleButton value="single">Single</ToggleButton>
                    <ToggleButton value="master">Master</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                {p.type === 'human' && darts.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('common.dart')}
                    </Typography>
                    <TextField
                      select
                      size="small"
                      value={darts.some((d) => d.id === p.dartId) ? p.dartId : (darts[0] ? darts[0].id : '')}
                      onChange={(e) => update(p.key, { dartId: Number(e.target.value) })}
                      sx={{ ml: 1, minWidth: 150 }}
                    >
                      {darts.map((d) => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name} · {d.weightGrams} g
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
