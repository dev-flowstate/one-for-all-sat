/** Saved pen and highlighter drawings over questions and book chapters. */
import { logDoodle } from './activity';

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
  const times = readTimes();
  if (strokes.length === 0) {
    delete all[id];
    delete times[id];
  } else {
    all[id] = strokes;
    times[id] = new Date().toISOString();
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  try {
    localStorage.setItem(TIMES_KEY, JSON.stringify(times));
  } catch {
    // Only the sort order of the Saved doodles page depends on it.
  }
  if (strokes.length > 0) logDoodle();
  return true;
}

/** When each doodle was last saved; doodles saved before this was kept have none. */
const TIMES_KEY = 'ofa-sat:doodle-times';

function readTimes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TIMES_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export interface SavedDoodle {
  /** q:<question id>, vocab:<word id> or book:<book>:<chapter>. */
  id: string;
  strokes: number;
  savedAt?: string;
}

/** Every saved doodle, newest first; ones from before save times were kept come last. */
export function listDoodles(): SavedDoodle[] {
  const times = readTimes();
  return Object.entries(readAll())
    .filter(([, strokes]) => strokes.length > 0)
    .map(([id, strokes]) => ({ id, strokes: strokes.length, savedAt: times[id] }))
    .sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
}

/** A highlighted stretch of a book paragraph, by character offsets in its text. */
export interface TextHighlight {
  /** The paragraph's index in its chapter. */
  p: number;
  s: number;
  e: number;
}

const HIGHLIGHTS_KEY = 'ofa-sat:highlights';

function readHighlights(): Record<string, TextHighlight[]> {
  try {
    return JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY) ?? '{}') as Record<string, TextHighlight[]>;
  } catch {
    return {};
  }
}

export function getHighlights(id: string): TextHighlight[] {
  return readHighlights()[id] ?? [];
}

/** Highlights save as they're made, like ink from a real highlighter. */
export function saveHighlights(id: string, highlights: TextHighlight[]): void {
  const all = readHighlights();
  if (highlights.length === 0) delete all[id];
  else all[id] = highlights;
  try {
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
  } catch {
    // Storage full: the highlight stays until the page is left.
  }
}
