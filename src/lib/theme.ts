import { useState } from 'react';

export type Theme = 'light' | 'dark' | 'bluebook' | 'minecraft';

export const THEMES: { id: Theme; label: string; description: string }[] = [
  { id: 'light', label: 'Light', description: 'Cream paper and ink, the site’s own look.' },
  { id: 'dark', label: 'Dark', description: 'The same look, dark, for night studying.' },
  { id: 'bluebook', label: 'Bluebook', description: 'Blue and white, like the real test app.' },
  { id: 'minecraft', label: 'Minecraft-style', description: 'Sky, grass and dirt, in blocky pixels.' },
];

/** Light unless another has been picked; the choice is remembered on this device. Kept in step
 *  with the script in index.html, which applies it before the first paint. */
const THEME_KEY = 'ofa-sat:theme';
/** The theme the dark-mode button returns to, so leaving dark mode goes back to the theme that
 *  was in use rather than always to light. */
const DAY_THEME_KEY = 'ofa-sat:day-theme';

function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === 'dark' || value === 'bluebook' || value === 'minecraft' ? value : 'light';
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the choice lasts until the page is left.
  }
}

function dayTheme(): Theme {
  try {
    const value = localStorage.getItem(DAY_THEME_KEY);
    return value === 'bluebook' || value === 'minecraft' ? value : 'light';
  } catch {
    return 'light';
  }
}

/** The theme in use, a way to pick one, and the home screen's dark-mode switch. */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggleDark: () => void } {
  const [theme, setState] = useState<Theme>(currentTheme);

  const setTheme = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    setState(next);
    remember(THEME_KEY, next);
    if (next !== 'dark') remember(DAY_THEME_KEY, next);
  };

  return { theme, setTheme, toggleDark: () => setTheme(theme === 'dark' ? dayTheme() : 'dark') };
}
