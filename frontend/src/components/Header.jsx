import { AppBar, Toolbar, IconButton, Typography, Box } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import SoundMenu from './SoundMenu';
import LanguageMenu from './LanguageMenu';
import { MONO } from '../theme';

/**
 * Minimalistischer Header (MUI AppBar) – grün, mit Zurück-Button, Titel,
 * Ton- und Theme-Umschalter. Optionaler Untertitel für die Spiel-Info.
 */
export default function Header({ title, subtitle, onBack, back = true, right = null }) {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ gap: 1 }}>
        {back && (
          <IconButton edge="start" color="inherit" onClick={handleBack} aria-label="Zurück">
            <ArrowBackIcon />
          </IconButton>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="caption"
              sx={{ opacity: 0.9, fontFamily: MONO, letterSpacing: '0.03em', textTransform: 'uppercase' }}
              noWrap
              component="div"
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {right}
        <LanguageMenu />
        <SoundMenu />
        <ThemeToggle />
      </Toolbar>
    </AppBar>
  );
}
