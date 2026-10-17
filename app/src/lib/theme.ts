// Theme: 'system' (default) follows prefers-color-scheme live; 'dark' or 'light' is a manual choice
// stored in localStorage ('lumos.theme') that overrides the system. layout.tsx applies it before paint.
'use client';

import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
export type ThemeMode = Theme | 'system';
const KEY = 'lumos.theme';
const systemTheme = (): Theme => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

function storedMode(): ThemeMode {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

const resolve = (mode: ThemeMode): Theme => (mode === 'system' ? systemTheme() : mode);

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const m = storedMode();
    setModeState(m);
    setTheme(resolve(m));
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onSystem = () => {
      if (storedMode() !== 'system') return; // a manual choice wins over the system
      const t = systemTheme();
      apply(t);
      setTheme(t);
    };
    // Other tabs (and other theme controls on this page) changing the choice.
    const onSync = () => {
      const next = storedMode();
      setModeState(next);
      setTheme(resolve(next));
    };
    mq.addEventListener('change', onSystem);
    window.addEventListener('storage', onSync);
    window.addEventListener('lumos:theme', onSync);
    return () => {
      mq.removeEventListener('change', onSystem);
      window.removeEventListener('storage', onSync);
      window.removeEventListener('lumos:theme', onSync);
    };
  }, []);

  function setMode(next: ThemeMode) {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    const t = resolve(next);
    apply(t);
    setModeState(next);
    setTheme(t);
    window.dispatchEvent(new Event('lumos:theme'));
  }

  return { mode, theme, setMode };
}
