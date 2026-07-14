import { useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  Button,
  IconButton,
  TextField,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAddOutlined';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import { ACCENT } from '../theme';
import { useT } from '../i18n';

const COLORS = ['#006EC7', '#00A3A3', '#2E7D32', '#C62828', '#F9A825', '#6A1B9A', '#EC407A', '#455A64'];

let keyCounter = 0;
const nextKey = () => `tk${Date.now()}_${keyCounter++}`;

export function makeMember(name = '') {
  return { key: nextKey(), id: undefined, name, dartId: null, checkoutMode: 'double' };
}
export function makeTeam() {
  return { key: nextKey(), name: '', color: '', checkoutMode: 'double', members: [makeMember(''), makeMember('')] };
}

// Baut aus einem gespeicherten Team eine Setup-Team-Struktur (löst Pfeil/Checkout aus gespeicherten Spielern auf).
function teamFromSaved(st, savedPlayers) {
  const members = (st.members || []).map((sm) => {
    const sp = savedPlayers.find((p) => p.id === sm.id);
    return { key: nextKey(), id: sm.id ?? undefined, name: sm.name, dartId: sp ? sp.dartId ?? null : null, checkoutMode: (sp && sp.checkoutMode) || 'double' };
  });
  if (!members.length) members.push(makeMember(''));
  return { key: nextKey(), name: st.name || '', color: st.color || '', checkoutMode: 'double', members };
}

/**
 * Verwaltet die Teams im Doppel-Setup: „+Team", Team-Kacheln mit Rahmen,
 * standardmäßig zwei Spieler-Slots je Team und „+Spieler" für weitere Mitglieder.
 * Zusätzlich: Team-Farbe, gespeicherte feste Doppel laden/speichern.
 */
export default function TeamSetupList({ teams, setTeams, savedPlayers = [], savedTeams = [], onSaveTeam }) {
  const t = useT();
  const [loadAnchor, setLoadAnchor] = useState(null);

  const updTeam = (tk, patch) => setTeams((l) => l.map((tm) => (tm.key === tk ? { ...tm, ...patch } : tm)));
  const updMember = (tk, mk, patch) =>
    setTeams((l) =>
      l.map((tm) => (tm.key === tk ? { ...tm, members: tm.members.map((m) => (m.key === mk ? { ...m, ...patch } : m)) } : tm))
    );
  const addTeam = () => setTeams((l) => [...l, { ...makeTeam(), color: COLORS[l.length % COLORS.length] }]);
  const removeTeam = (tk) => setTeams((l) => l.filter((tm) => tm.key !== tk));
  const addMember = (tk) => setTeams((l) => l.map((tm) => (tm.key === tk ? { ...tm, members: [...tm.members, makeMember('')] } : tm)));
  const removeMember = (tk, mk) =>
    setTeams((l) => l.map((tm) => (tm.key === tk ? { ...tm, members: tm.members.filter((m) => m.key !== mk) } : tm)));
  const loadSaved = (st) => {
    setTeams((l) => [...l, teamFromSaved(st, savedPlayers)]);
    setLoadAnchor(null);
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={addTeam} fullWidth>
          {t('ts.addTeam')}
        </Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={(e) => setLoadAnchor(e.currentTarget)} fullWidth>
          {t('ts.loadTeam')}
        </Button>
        <Menu anchorEl={loadAnchor} open={Boolean(loadAnchor)} onClose={() => setLoadAnchor(null)}>
          {savedTeams.length === 0 && <MenuItem disabled>{t('ts.noSaved')}</MenuItem>}
          {savedTeams.map((st) => (
            <MenuItem key={st.id} onClick={() => loadSaved(st)}>
              <Box component="span" sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: st.color || '#607D8B', mr: 1, display: 'inline-block' }} />
              {st.name || st.members.map((m) => m.name).join(' & ')}
            </MenuItem>
          ))}
        </Menu>
      </Stack>

      <Stack spacing={2}>
        {teams.map((tm, ti) => (
          <Paper key={tm.key} variant="outlined" sx={{ p: 1.5, borderWidth: 2, borderColor: tm.color || ((th) => th.custom?.rule || 'divider') }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <GroupsIcon sx={{ color: tm.color || ACCENT.green }} />
              <Typography sx={{ fontWeight: 800 }}>{t('ts.team', { n: ti + 1 })}</Typography>
              <Box sx={{ flex: 1 }} />
              {onSaveTeam && (
                <Tooltip title={t('ts.saveTeam')}>
                  <span>
                    <IconButton size="small" onClick={() => onSaveTeam(tm)} disabled={!tm.members.some((m) => m.name.trim())} aria-label={t('ts.saveTeam')}>
                      <BookmarkAddIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              <IconButton size="small" onClick={() => removeTeam(tm.key)} aria-label={t('ts.removeTeam')} disabled={teams.length <= 2}>
                <DeleteIcon />
              </IconButton>
            </Stack>

            <TextField
              size="small"
              fullWidth
              placeholder={t('ts.teamName')}
              value={tm.name}
              onChange={(e) => updTeam(tm.key, { name: e.target.value })}
              sx={{ mb: 1 }}
            />

            {/* Team-Farbe */}
            <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>{t('ts.color')}</Typography>
              {COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => updTeam(tm.key, { color: tm.color === c ? '' : c })}
                  sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: '3px solid', borderColor: tm.color === c ? 'text.primary' : 'transparent' }}
                />
              ))}
            </Stack>

            <ToggleButtonGroup
              exclusive
              size="small"
              value={tm.checkoutMode}
              onChange={(e, v) => v && updTeam(tm.key, { checkoutMode: v })}
              sx={{ mb: 1, flexWrap: 'wrap' }}
            >
              <ToggleButton value="double">Double</ToggleButton>
              <ToggleButton value="single">Single</ToggleButton>
              <ToggleButton value="master">Master</ToggleButton>
              <ToggleButton value="individual">{t('ts.individual')}</ToggleButton>
            </ToggleButtonGroup>

            <Stack spacing={1}>
              {tm.members.map((m) => (
                <Stack key={m.key} direction="row" spacing={1} alignItems="center">
                  <PersonAddIcon sx={{ color: ACCENT.green }} fontSize="small" />
                  <Autocomplete
                    freeSolo
                    fullWidth
                    options={savedPlayers}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                    value={m.name}
                    onChange={(e, val) => {
                      if (val && typeof val === 'object') updMember(tm.key, m.key, { name: val.name, id: val.id, dartId: val.dartId ?? null, checkoutMode: val.checkoutMode || 'double' });
                      else updMember(tm.key, m.key, { name: val || '', id: undefined });
                    }}
                    onInputChange={(e, val, reason) => {
                      if (reason !== 'input') return;
                      const match = savedPlayers.find((sp) => sp.name.toLowerCase() === val.trim().toLowerCase());
                      if (match) updMember(tm.key, m.key, { name: match.name, id: match.id, dartId: match.dartId ?? null, checkoutMode: match.checkoutMode || 'double' });
                      else updMember(tm.key, m.key, { name: val, id: undefined });
                    }}
                    renderInput={(params) => <TextField {...params} variant="standard" placeholder={t('psl.player')} />}
                  />
                  <IconButton size="small" onClick={() => removeMember(tm.key, m.key)} disabled={tm.members.length <= 1} aria-label={t('psl.remove')}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                  {tm.checkoutMode === 'individual' && (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={m.checkoutMode}
                      onChange={(e, v) => v && updMember(tm.key, m.key, { checkoutMode: v })}
                    >
                      <ToggleButton value="double">D</ToggleButton>
                      <ToggleButton value="single">S</ToggleButton>
                      <ToggleButton value="master">M</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                </Stack>
              ))}
            </Stack>

            <Button size="small" startIcon={<PersonAddIcon />} onClick={() => addMember(tm.key)} sx={{ mt: 1 }}>
              {t('ts.addPlayer')}
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
