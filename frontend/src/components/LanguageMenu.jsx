import { useState } from 'react';
import { IconButton, Menu, MenuItem, Tooltip, ListItemText, ListItemIcon } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import CheckIcon from '@mui/icons-material/Check';
import { useLang, setLang } from '../i18n';

/** Sprach-Umschalter (Deutsch/English), pro Gerät gespeichert. */
export default function LanguageMenu() {
  const lang = useLang();
  const [anchor, setAnchor] = useState(null);
  const pick = (l) => {
    setLang(l);
    setAnchor(null);
  };
  const OPTIONS = [
    { key: 'de', label: 'Deutsch' },
    { key: 'en', label: 'English' },
  ];
  return (
    <>
      <Tooltip title="Sprache / Language">
        <IconButton color="inherit" onClick={(e) => setAnchor(e.currentTarget)} aria-label="Sprache">
          <TranslateIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {OPTIONS.map((o) => (
          <MenuItem key={o.key} selected={lang === o.key} onClick={() => pick(o.key)}>
            <ListItemIcon>{lang === o.key ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            <ListItemText>{o.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
