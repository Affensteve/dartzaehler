import React, { useMemo, useState, createContext } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme, normalizeThemeId, THEME_CATEGORIES, THEME_VARIANTS } from './theme';
import App from './App';
import './styles/fonts.css';
import './styles/global.css';

export const ThemeContext = createContext({
  themeId: 'standard-dark',
  category: 'standard',
  variant: 'dark',
  categories: THEME_CATEGORIES,
  variants: THEME_VARIANTS,
  setCategory: () => {},
  setVariant: () => {},
});

function Root() {
  const [themeId, setThemeId] = useState(() => normalizeThemeId(localStorage.getItem('dz-theme')));
  const [category, variant] = themeId.split('-');

  const apply = (id) => {
    const next = normalizeThemeId(id);
    localStorage.setItem('dz-theme', next);
    setThemeId(next);
  };

  const ctx = useMemo(
    () => ({
      themeId,
      category,
      variant,
      categories: THEME_CATEGORIES,
      variants: THEME_VARIANTS,
      setCategory: (c) => apply(`${c}-${variant}`),
      setVariant: (v) => apply(`${category}-${v}`),
    }),
    [themeId, category, variant]
  );
  const theme = useMemo(() => getTheme(themeId), [themeId]);

  return (
    <ThemeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
