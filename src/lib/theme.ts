import { useState } from 'react';

export type Theme = 'light' | 'dark';

/** Light unless dark has been picked; the choice is remembered on this device. */
const THEME_KEY = 'ofa-sat:theme';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The theme in use, and a switch between light and dark. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Without storage the choice lasts until the page is left.
    }
  };

  return [theme, toggle];
}
