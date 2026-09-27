import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/** Only set once someone picks a theme; until then the site follows the device. */
const THEME_KEY = 'ofa-sat:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** The theme in use, and a switch between light and dark that's remembered on this device. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // Until a choice is made, follow the device when its setting changes.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const follow = (event: MediaQueryListEvent) => {
      if (savedTheme()) return;
      const next = event.matches ? 'dark' : 'light';
      apply(next);
      setTheme(next);
    };
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    apply(next);
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Without storage the choice lasts until the page is left.
    }
  };

  return [theme, toggle];
}
