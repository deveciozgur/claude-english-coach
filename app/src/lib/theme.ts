// Dark/light theme: the choice is stored in localStorage ('lumos.theme'); without one, the page
// follows the system setting (and keeps following it live). layout.tsx applies it before paint.
'use client';

import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'lumos.theme';
const systemTheme = (): Theme => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

function stored(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) || stored() || systemTheme());
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onSystem = () => {
      if (stored()) return; // an explicit choice wins over the system
      const t = systemTheme();
      apply(t);
      setTheme(t);
    };
    mq.addEventListener('change', onSystem);
    return () => mq.removeEventListener('change', onSystem);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    apply(next);
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
  }

  return { theme, toggle };
}
