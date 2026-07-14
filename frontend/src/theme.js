import { createTheme } from '@mui/material/styles';

// Live-Akzentobjekt: wird von getTheme() je nach aktivem Theme aktualisiert.
export const ACCENT = {
  green: '#2E9E4F',
  greenDark: '#1F7D3C',
  double: '#F4A62A',
  triple: '#EF6C33',
  undo: '#E4032B',
  bot: '#E8873A',
  cream: '#EFE3C3',
};

// Farbwelten (Kategorien) und Varianten für den zweistufigen Switcher.
export const THEME_CATEGORIES = [
  { id: 'standard', label: 'Standard', swatch: '#1E8A46' },
  { id: 'girlie', label: 'Girlie', swatch: '#E0356F' },
];
export const THEME_VARIANTS = [
  { id: 'light', label: 'Hell' },
  { id: 'dark', label: 'Dunkel' },
];

// Space Grotesk für Titel/Scores (Flugbahn-Konzept), Archivo für Fließtext/UI.
export const DISPLAY = '"Space Grotesk", "Archivo", sans-serif';
export const BODY_FONT = '"Archivo", "Segoe UI", system-ui, -apple-system, sans-serif';
export const MONO = '"JetBrains Mono", "Roboto Mono", ui-monospace, monospace';

// Diagonale Eck-Schnitte – das wiederkehrende Signatur-Element des "Flugbahn"-Designs.
// Karten/Dialoge/AppBar schneiden unten rechts, Buttons unten links.
export const CARD_CUT = 'polygon(0 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%)';
export const BTN_CUT = 'polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px))';

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Theme-Definitionen, Schlüssel = "<kategorie>-<variante>".
// `panel` = leicht abgesetzte Fläche für Graphic-Bars/Kartenköpfe, `rule` = kräftigere Trennlinie.
const THEME_DEFS = {
  'standard-light': {
    mode: 'light',
    accent: { green: '#1E8A46', greenDark: '#146332', double: '#F2A400', triple: '#E8551C', undo: '#D8002E', bot: '#DB7A1E', cream: '#EFE3C3' },
    bg: '#F1F0E9', paper: '#FFFFFF', panel: '#E8E5D9', header: '#1E8A46',
    text: '#14181C', textSecondary: '#5B6472', divider: 'rgba(20,24,28,0.13)', rule: 'rgba(20,24,28,0.34)', headerBorder: 'none',
  },
  'standard-dark': {
    mode: 'dark',
    accent: { green: '#34B76B', greenDark: '#1F7D3C', double: '#F4A62A', triple: '#EF6C33', undo: '#FF3B4E', bot: '#E8873A', cream: '#EFE3C3' },
    bg: '#0A0B0C', paper: '#151619', panel: '#1D1F22', header: '#0E0F11',
    text: '#F3EEDF', textSecondary: '#A39D92', divider: 'rgba(243,238,223,0.13)', rule: 'rgba(243,238,223,0.28)', headerBorder: '#34B76B',
  },
  'girlie-light': {
    mode: 'light',
    accent: { green: '#E0356F', greenDark: '#B5265A', double: '#A768D6', triple: '#EF7BAA', undo: '#D81B5E', bot: '#A768D6', cream: '#FCE4EC' },
    bg: '#FCEEF4', paper: '#FFFFFF', panel: '#F6DCE7', header: '#E0356F',
    text: '#3D2430', textSecondary: '#84616F', divider: 'rgba(61,36,48,0.14)', rule: 'rgba(61,36,48,0.32)', headerBorder: 'none',
  },
  'girlie-dark': {
    mode: 'dark',
    accent: { green: '#FF6FA5', greenDark: '#E0356F', double: '#CE93D8', triple: '#F48FB1', undo: '#FF4D8D', bot: '#CE93D8', cream: '#F7E1EC' },
    bg: '#180E17', paper: '#231320', panel: '#2C1828', header: '#1C0F1B',
    text: '#F7E9F0', textSecondary: '#C6A6B7', divider: 'rgba(247,233,240,0.14)', rule: 'rgba(247,233,240,0.3)', headerBorder: '#CE93D8',
  },
};

const DEFAULT_ID = 'standard-dark';

// Legacy-Werte (früher 'light'/'dark'/'girlie') auf das neue Schema abbilden.
export function normalizeThemeId(id) {
  if (id && THEME_DEFS[id]) return id;
  const legacy = { light: 'standard-light', dark: 'standard-dark', girlie: 'girlie-light' };
  return legacy[id] || DEFAULT_ID;
}

const displayHeading = {
  fontFamily: DISPLAY,
  textTransform: 'none',
  letterSpacing: '-0.01em',
};

export function getTheme(id) {
  const def = THEME_DEFS[normalizeThemeId(id)];
  Object.assign(ACCENT, def.accent); // Live-Akzente aktualisieren

  // Zurückhaltende Textur: nur ein schwacher Glow oben, kein Raster (Flugbahn-Konzept bleibt flach/klar).
  const bgTexture = `radial-gradient(circle at 50% -20%, ${hexToRgba(def.accent.green, def.mode === 'dark' ? 0.16 : 0.1)} 0%, transparent 45%)`;

  // Feine "Riffelung" (wie eine Pfeilspitze) als schmaler Streifen unter der AppBar.
  const grooveTexture = `repeating-linear-gradient(90deg, ${hexToRgba(def.text, def.mode === 'dark' ? 0.14 : 0.09)} 0px 1px, transparent 1px 4px)`;

  return createTheme({
    custom: { panel: def.panel, rule: def.rule },
    palette: {
      mode: def.mode,
      primary: { main: def.accent.green, contrastText: '#ffffff' },
      secondary: { main: def.textSecondary },
      success: { main: def.accent.green },
      warning: { main: def.accent.double },
      error: { main: def.accent.undo },
      background: { default: def.bg, paper: def.paper },
      text: { primary: def.text, secondary: def.textSecondary },
      divider: def.divider,
    },
    typography: {
      fontFamily: BODY_FONT,
      h1: { ...displayHeading, fontWeight: 700 },
      h2: { ...displayHeading, fontWeight: 700 },
      h3: { ...displayHeading, fontWeight: 700 },
      h4: { ...displayHeading, fontWeight: 600 },
      h5: { ...displayHeading, fontWeight: 600 },
      h6: { ...displayHeading, fontWeight: 600 },
      button: { fontFamily: BODY_FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
    },
    shape: { borderRadius: 0 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            '--dz-accent': def.accent.green,
            '--dz-bg-texture': bgTexture,
            backgroundSize: 'auto',
            fontVariantNumeric: 'tabular-nums',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 0 },
          contained: { clipPath: BTN_CUT },
          outlined: {
            borderWidth: 2,
            backgroundColor: def.panel,
            clipPath: BTN_CUT,
            '&:hover': { borderWidth: 2, backgroundColor: def.paper },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: def.header,
            backgroundImage: 'none',
            borderBottom: def.headerBorder === 'none' ? 'none' : `3px solid ${def.headerBorder}`,
            clipPath: CARD_CUT,
            '&::after': {
              content: '""',
              display: 'block',
              height: 5,
              backgroundImage: grooveTexture,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: def.rule },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: def.rule } },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            fontWeight: 700,
            fontFamily: DISPLAY,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            fontWeight: 700,
            textTransform: 'none',
            backgroundColor: def.panel,
            '&:hover': { backgroundColor: def.paper },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { backgroundColor: def.panel, borderRadius: 0 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 0, clipPath: CARD_CUT },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { ...displayHeading, fontWeight: 600 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { fontFamily: MONO },
          head: {
            fontFamily: BODY_FONT,
            fontWeight: 800,
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            letterSpacing: '0.05em',
            borderBottom: `2px solid ${def.rule}`,
          },
        },
      },
    },
  });
}
