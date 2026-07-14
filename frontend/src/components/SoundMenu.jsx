import { useEffect, useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  Switch,
  Slider,
  Box,
  Typography,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Tooltip,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import {
  getSoundSettings,
  setSoundSettings,
  subscribeSound,
  playEffect,
  callCue,
  listVoices,
  subscribeVoices,
} from '../sound';

/** Ton-Einstellungen (pro Gerät): An/Aus, Voice-Caller + Sprache, konkrete Stimme, Modus, Lautstärke, Test. */
export default function SoundMenu() {
  const [anchor, setAnchor] = useState(null);
  const [s, setS] = useState(getSoundSettings());
  const [voiceList, setVoiceList] = useState([]);

  useEffect(() => subscribeSound(setS), []);

  // Verfügbare Stimmen für die aktuelle Sprache (laden asynchron nach).
  useEffect(() => {
    const refresh = () => setVoiceList(listVoices(s.lang));
    refresh();
    return subscribeVoices(refresh);
  }, [s.lang]);

  const test = () => {
    playEffect('leg');
    callCue('game-shot');
  };

  const chosenVoice = (s.voiceByLang && s.voiceByLang[s.lang]) || '';
  const setVoice = (uri) => {
    const map = { ...(s.voiceByLang || {}) };
    if (uri) map[s.lang] = uri;
    else delete map[s.lang];
    setSoundSettings({ voiceByLang: map });
  };

  return (
    <>
      <Tooltip title="Ton-Einstellungen">
        <IconButton
          color="inherit"
          onClick={(e) => {
            setVoiceList(listVoices(s.lang));
            setAnchor(e.currentTarget);
          }}
          aria-label="Ton-Einstellungen"
        >
          {s.enabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1, width: 280 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 700 }}>Ton</Typography>
            <Switch checked={s.enabled} onChange={(e) => setSoundSettings({ enabled: e.target.checked })} />
          </Box>
          <Typography variant="caption" color="text.secondary">
            Gilt nur für dieses Gerät.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2">Voice-Caller</Typography>
            <Switch
              size="small"
              checked={s.voice}
              disabled={!s.enabled}
              onChange={(e) => setSoundSettings({ voice: e.target.checked })}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2">Live-Kommentar</Typography>
            <Switch
              size="small"
              checked={s.commentary}
              disabled={!s.enabled || !s.voice}
              onChange={(e) => setSoundSettings({ commentary: e.target.checked })}
            />
          </Box>

          <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
            Sprache
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={s.lang}
            disabled={!s.enabled || !s.voice}
            onChange={(e, v) => v && setSoundSettings({ lang: v })}
          >
            <ToggleButton value="de">Deutsch</ToggleButton>
            <ToggleButton value="en">English</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
            Stimme (Gerät)
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            SelectProps={{ native: true }}
            value={chosenVoice}
            disabled={!s.enabled || !s.voice}
            onChange={(e) => setVoice(e.target.value)}
          >
            <option value="">
              {`Automatisch (${s.gender === 'male' ? 'männlich' : 'weiblich'})`}
            </option>
            {voiceList.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </TextField>
          {voiceList.length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Keine System-Stimmen für diese Sprache gefunden.
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              „Automatisch" wählt nach Geschlecht. Eine konkrete Stimme hier überschreibt das.
            </Typography>
          )}

          <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
            Stimme (automatisch)
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={s.gender}
            disabled={!s.enabled || !s.voice || Boolean(chosenVoice)}
            onChange={(e, v) => v && setSoundSettings({ gender: v })}
          >
            <ToggleButton value="female">Weiblich</ToggleButton>
            <ToggleButton value="male">Männlich</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Je Spieler in der Spielerverwaltung überschreibbar. Verfügbarkeit hängt von den installierten System-Stimmen ab.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
            <VolumeUpIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              disabled={!s.enabled}
              onChange={(e, v) => setSoundSettings({ volume: v })}
              aria-label="Lautstärke"
            />
          </Box>

          <Typography variant="body2" sx={{ mt: 1, mb: 0.5 }}>
            Tonquelle
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={s.mode}
            disabled={!s.enabled}
            onChange={(e, v) => v && setSoundSettings({ mode: v })}
          >
            <ToggleButton value="generated">Erzeugt</ToggleButton>
            <ToggleButton value="clips">Audio-Clips</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            „Erzeugt": im Browser synthetisiert (offline). „Audio-Clips": Dateien aus
            <code> /sounds/…</code>, sonst automatisch „Erzeugt".
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={test} disabled={!s.enabled}>
          Ton testen
        </MenuItem>
      </Menu>
    </>
  );
}
