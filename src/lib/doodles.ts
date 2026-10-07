/** Saved pen and highlighter drawings over questions and book chapters. */

export type DoodleTool = 'pen' | 'highlighter';
export type DoodleColor = 'ink' | 'red' | 'blue';

export interface Stroke {
  tool: DoodleTool;
  color: DoodleColor;
  /** In drawing units, where the content is 1000 wide, so a drawing scales with the screen. */
  width: number;
  /** x, y, x, y, … in the same units, rounded. */
  points: number[];
}

/** The ink colour follows the theme, so it stays visible on a dark page. */
export const COLORS: Record<DoodleColor, string> = {
  ink: 'var(--color-ink)',
  red: '#d9443a',
  blue: '#2f7de1',
};

export const HIGHLIGHTER = { color: '#ffd400', opacity: 0.4 };

const KEY = 'ofa-sat:doodles';

function readAll(): Record<string, Stroke[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Stroke[]>;
  } catch {
    return {};
  }
}

export function getDoodle(id: string): Stroke[] {
  return readAll()[id] ?? [];
}

/** Saves a drawing; an empty one removes it. False when the browser's storage is full. */
export function saveDoodle(id: string, strokes: Stroke[]): boolean {
  const all = readAll();
  if (strokes.length === 0) delete all[id];
  else all[id] = strokes;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
