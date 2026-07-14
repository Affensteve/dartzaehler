import { useContext, useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Divider,
  Box,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckIcon from '@mui/icons-material/Check';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import { ThemeContext } from '../main';

export default function ThemeToggle({ color = 'inherit' }) {
  const { category, variant, categories, variants, setCategory, setVariant } = useContext(ThemeContext);
  const [anchor, setAnchor] = useState(null);

  return (
    <>
      <Tooltip title="Design wählen">
        <IconButton color={color} onClick={(e) => setAnchor(e.currentTarget)} aria-label="Design wählen">
          <PaletteIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'transparent', fontWeight: 800, letterSpacing: '0.06em' }}>
          Farbwelt
        </ListSubheader>
        {categories.map((c) => (
          <MenuItem key={c.id} selected={c.id === category} onClick={() => setCategory(c.id)}>
            <ListItemIcon>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '3px',
                  bgcolor: c.swatch,
                  border: '1.5px solid rgba(128,128,128,0.5)',
                }}
              />
            </ListItemIcon>
            <ListItemText>{c.label}</ListItemText>
            {c.id === category && <CheckIcon fontSize="small" sx={{ ml: 1 }} />}
          </MenuItem>
        ))}

        <Divider />
        <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'transparent', fontWeight: 800, letterSpacing: '0.06em' }}>
          Modus
        </ListSubheader>
        {variants.map((v) => (
          <MenuItem key={v.id} selected={v.id === variant} onClick={() => setVariant(v.id)}>
            <ListItemIcon>{v.id === 'dark' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{v.label}</ListItemText>
            {v.id === variant && <CheckIcon fontSize="small" sx={{ ml: 1 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
