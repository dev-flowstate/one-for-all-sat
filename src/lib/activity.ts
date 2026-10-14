/**
 * What was done each day: questions answered and how they went, by topic; flashcards; practice
 * tests finished; doodles saved. Counted as it happens and kept in this browser.
 *
 * The rest of the app keeps only the latest attempt at each question, so the days before this
 * log began are rebuilt from those once (see rebuildEarlierDays) and marked as rebuilt.
 */

export interface DayActivity {
  answered: number;
  correct: number;
  /** skill -> [answered, correct] */
  topics: Record<string, [number, number]>;
  words: number;
  wordsRight: number;
  tests: number;
  doodles: number;
  /** Rebuilt from latest attempts rather than counted live, so repeats are missing. */
  rebuilt?: boolean;
}

interface ActivityFile {
  /** The first day counted live. Days before it may be rebuilt, never days on or after it. */
  since: string;
  rebuiltDone?: boolean;
  days: Record<string, DayActivity>;
}

const KEY = 'ofa-sat:activity';

/** A local calendar day, as YYYY-MM-DD. */
export function dayKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyDay(): DayActivity {
  return { answered: 0, correct: 0, topics: {}, words: 0, wordsRight: 0, tests: 0, doodles: 0 };
}

function read(): ActivityFile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ActivityFile;
  } catch {
    // Unreadable: start again rather than break the page.
  }
  return { since: dayKey(), days: {} };
}

function write(file: ActivityFile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(file));
  } catch {
    // Storage full: the log is a nicety, so losing an entry mustn't stop anything else.
  }
}

function update(day: string, change: (d: DayActivity) => void) {
  const file = read();
  const entry = file.days[day] ?? emptyDay();
  change(entry);
  file.days[day] = entry;
  write(file);
}

export function logAnswers(answers: { skill: string; correct: boolean }[], when: string = new Date().toISOString()) {
  if (answers.length === 0) return;
  update(dayKey(when), (d) => {
    for (const a of answers) {
      d.answered += 1;
      if (a.correct) d.correct += 1;
      const t = (d.topics[a.skill] ??= [0, 0]);
      t[0] += 1;
      if (a.correct) t[1] += 1;
    }
  });
}

/** An answer changed after it was saved (end-of-set reveal mode): right became wrong or back. */
export function logAmend(skill: string, nowCorrect: boolean) {
  update(dayKey(), (d) => {
    const delta = nowCorrect ? 1 : -1;
    d.correct = Math.max(0, d.correct + delta);
    const t = d.topics[skill];
    if (t) t[1] = Math.max(0, t[1] + delta);
  });
}

export function logWord(right: boolean) {
  update(dayKey(), (d) => {
    d.words += 1;
    if (right) d.wordsRight += 1;
  });
}

export function logTest() {
  update(dayKey(), (d) => {
    d.tests += 1;
  });
}

export function logDoodle() {
  update(dayKey(), (d) => {
    d.doodles += 1;
  });
}

// ---- Several devices --------------------------------------------------------------------------
// Each device counts what's done on it, and the account keeps every device's log apart: adding
// two already-combined logs together on each sync would count the same day again and again.

const DEVICE_KEY = 'ofa-sat:device';
/** The logs of this account's other devices, as the account last had them. */
const OTHERS_KEY = 'ofa-sat:activity-others';

/** This browser's id among the account's devices, made up the first time it's needed. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'this-device';
  }
}

export type DeviceActivity = Record<string, Record<string, DayActivity>>;

function readOthers(): DeviceActivity {
  try {
    return JSON.parse(localStorage.getItem(OTHERS_KEY) ?? '{}') as DeviceActivity;
  } catch {
    return {};
  }
}

/** This device's log, under its id, for the account. */
export function ownActivity(): DeviceActivity {
  return { [deviceId()]: read().days };
}

/** The account's logs: this device's own is replaced by the account's copy only when it has none. */
export function setAccountActivity(all: DeviceActivity) {
  const mine = deviceId();
  const others = { ...all };
  const own = others[mine];
  delete others[mine];
  try {
    localStorage.setItem(OTHERS_KEY, JSON.stringify(others));
  } catch {
    // Storage full: the other devices' days just don't show here.
  }
  const file = read();
  if (own && Object.keys(file.days).length === 0) {
    file.days = own;
    write(file);
  }
}

/** Signing out, or another person's account on this browser. */
export function clearActivity() {
  for (const key of [KEY, OTHERS_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  }
}

function add(into: DayActivity, d: DayActivity) {
  into.answered += d.answered;
  into.correct += d.correct;
  into.words += d.words;
  into.wordsRight += d.wordsRight;
  into.tests += d.tests;
  into.doodles += d.doodles;
  for (const [skill, [n, right]] of Object.entries(d.topics)) {
    const t = (into.topics[skill] ??= [0, 0]);
    t[0] += n;
    t[1] += right;
  }
}

/**
 * Every device's days together. Days counted live are added up; a day only rebuilt from latest
 * attempts (which every device can do from the same synced progress) takes the fullest rebuild,
 * and only when no device counted that day live.
 */
export function getActivity(): Record<string, DayActivity> {
  const logs = [read().days, ...Object.values(readOthers())];
  const out: Record<string, DayActivity> = {};
  const live = new Set<string>();
  for (const days of logs) for (const [day, d] of Object.entries(days)) if (!d.rebuilt) live.add(day);
  for (const days of logs) {
    for (const [day, d] of Object.entries(days)) {
      if (live.has(day)) {
        if (d.rebuilt) continue;
        add((out[day] ??= emptyDay()), d);
      } else if (!out[day] || d.answered > out[day].answered) {
        out[day] = { ...d, topics: { ...d.topics } };
      }
    }
  }
  return out;
}

/**
 * Fills in the days before the log began, once, from what the rest of the app kept: each
 * question's latest attempt, each word's latest review, and the finished practice tests.
 */
export function rebuildEarlierDays(source: {
  attempts: { skill: string; correct: boolean; at: string }[];
  words: { right: boolean; at: string }[];
  tests: { at: string }[];
}) {
  const file = read();
  if (file.rebuiltDone) return;
  const touch = (at: string) => {
    const day = dayKey(at);
    if (day >= file.since) return null;
    const entry = (file.days[day] ??= { ...emptyDay(), rebuilt: true });
    return entry.rebuilt ? entry : null;
  };
  for (const a of source.attempts) {
    const d = touch(a.at);
    if (!d) continue;
    d.answered += 1;
    if (a.correct) d.correct += 1;
    const t = (d.topics[a.skill] ??= [0, 0]);
    t[0] += 1;
    if (a.correct) t[1] += 1;
  }
  for (const w of source.words) {
    const d = touch(w.at);
    if (!d) continue;
    d.words += 1;
    if (w.right) d.wordsRight += 1;
  }
  for (const t of source.tests) {
    const d = touch(t.at);
    if (d) d.tests += 1;
  }
  file.rebuiltDone = true;
  write(file);
}
