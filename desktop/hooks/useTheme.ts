/**
 * Theme runtime — dark (default) ↔ light.
 *
 * The actual palettes live in `theme.css` as CSS variables. This hook
 * just toggles the class on <html> and persists the choice to
 * localStorage. The pre-mount bootstrap in `index.tsx` applies the
 * saved class before React hydrates, so this hook only matters for
 * runtime changes (the Settings toggle).
 *
 * Why not Context: the theme value never needs to flow into a
 * dependency array — every component already reads its colors via
 * CSS variables, which the browser re-resolves on class change.
 * useTheme() is essentially just an event emitter for "user clicked
 * the toggle"; subscribers re-render on storage event only because
 * we expose the current value via useState (for the toggle's own
 * visual state).
 */

import { useEffect, useState, useCallback } from 'react';

export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'kaicast.desktop.theme';

function readSaved(): ThemeName {
  if (typeof window === 'undefined') return 'dark';
  try {
    const v = window.localStorage?.getItem(STORAGE_KEY);
    return v === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(name: ThemeName): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.classList.remove('theme-dark', 'theme-light');
  html.classList.add(name === 'light' ? 'theme-light' : 'theme-dark');
}

export function useTheme(): {
  theme: ThemeName;
  setTheme: (next: ThemeName) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<ThemeName>(readSaved);

  // Listen for cross-tab changes so toggling theme in one tab updates
  // every other open tab without a refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next: ThemeName = e.newValue === 'light' ? 'light' : 'dark';
      setThemeState(next);
      applyTheme(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage?.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — accept the loss */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
