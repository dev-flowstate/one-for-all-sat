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
  if (strokes.length === 0) delete all[id];
  else all[id] = strokes;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return false;
  }
  // A deletion keeps its time too, so it can reach the account and the person's other devices.
  const times = readTimes();
  times[id] = new Date().toISOString();
  writeJson(TIMES_KEY, times);
  markPending(id);
  if (strokes.length > 0) logDoodle();
  return true;
}

/** When each doodle was last saved or deleted; doodles saved before this was kept have none. */
const TIMES_KEY = 'ofa-sat:doodle-times';
/** Doodles saved or deleted here and not yet sent to the account. */
const PENDING_KEY = 'ofa-sat:doodle-pending';

function readTimes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TIMES_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full: the drawings themselves were saved above, and they matter more.
  }
}

// ---- Account sync -------------------------------------------------------------------------
// Each doodle travels on its own, with the time it was saved or deleted; the newer copy wins.

/** A doodle as the account keeps it: null strokes for one that was deleted. */
export interface DoodleRecord {
  id: string;
  strokes: Stroke[] | null;
  savedAt: string;
}

/** Doodles from before save times were kept count as this old, so any dated copy beats them. */
const UNDATED = '2000-01-01T00:00:00.000Z';

const listeners = new Set<() => void>();

/** Told whenever a doodle is saved or deleted here, so the account can be sent the change. */
export function onDoodleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function markPending(id: string) {
  const pending = new Set(readPending());
  pending.add(id);
  writeJson(PENDING_KEY, [...pending]);
  listeners.forEach((l) => l());
}

function readPending(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Every doodle here, saved or deleted, as the account keeps them. */
export function localDoodleRecords(): DoodleRecord[] {
  const all = readAll();
  const times = readTimes();
  const ids = new Set([...Object.keys(all), ...Object.keys(times)]);
  return [...ids].map((id) => ({ id, strokes: all[id]?.length ? all[id] : null, savedAt: times[id] ?? UNDATED }));
}

/** The changes not yet sent to the account. */
export function pendingDoodleRecords(): DoodleRecord[] {
  const wanted = new Set(readPending());
  return localDoodleRecords().filter((r) => wanted.has(r.id));
}

/** Sent: those ids are no longer waiting, unless they changed again meanwhile. */
export function markDoodlesSent(sent: DoodleRecord[]) {
  const times = readTimes();
  const done = new Set(sent.filter((r) => (times[r.id] ?? UNDATED) === r.savedAt).map((r) => r.id));
  writeJson(
    PENDING_KEY,
    readPending().filter((id) => !done.has(id)),
  );
}

/**
 * Takes in the account's doodles: each one newer than the copy here replaces it. Returns the
 * local ones the account should be sent, those newer than its copy or missing from it.
 */
export function mergeDoodles(remote: DoodleRecord[]): DoodleRecord[] {
  const all = readAll();
  const times = readTimes();
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  for (const r of remote) {
    if ((times[r.id] ?? '') >= r.savedAt) continue;
    if (r.strokes?.length) all[r.id] = r.strokes;
    else delete all[r.id];
    times[r.id] = r.savedAt;
  }
  writeJson(KEY, all);
  writeJson(TIMES_KEY, times);
  return localDoodleRecords().filter((r) => {
    const theirs = remoteById.get(r.id);
    return !theirs || r.savedAt > theirs.savedAt;
  });
}

/** Signing out, or another person's account on this browser: their doodles leave with them. */
export function clearDoodles() {
  for (const key of [KEY, TIMES_KEY, PENDING_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
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
