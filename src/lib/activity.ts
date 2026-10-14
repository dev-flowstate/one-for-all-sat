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

export function getActivity(): Record<string, DayActivity> {
  return read().days;
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
