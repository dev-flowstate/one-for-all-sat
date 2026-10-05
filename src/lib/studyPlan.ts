/**
 * The study calendar: the questions and words still to do, spread evenly over the days left
 * before the SAT, with a full practice test every Saturday instead.
 *
 * Nothing is fixed in advance. Each day's targets come from what's left at the start of that
 * day, so a day missed or a day done twice evens out over the days after it.
 */

export type PlanDayKind = 'study' | 'test' | 'sat';

export interface PlanDay {
  /** YYYY-MM-DD, local. */
  date: string;
  kind: PlanDayKind;
  /** Before today: nothing is planned for it any more. */
  past: boolean;
  questions: number;
  words: number;
}

/** A Date as YYYY-MM-DD in local time. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

const SATURDAY = 6;

/** `total` split over `days` as evenly as whole numbers allow, the larger shares first. */
function spread(total: number, days: number): number[] {
  const base = Math.floor(total / days);
  return Array.from({ length: days }, (_, i) => base + (i < total % days ? 1 : 0));
}

/**
 * Every day from `start` to the SAT. `questionsLeft` and `wordsLeft` are what was left at the
 * start of today, so today's targets don't shrink as the day's work gets done.
 */
export function buildPlan(start: string, today: string, satDate: string, questionsLeft: number, wordsLeft: number): PlanDay[] {
  const days: PlanDay[] = [];
  for (let date = start; date <= satDate; date = addDays(date, 1)) {
    const kind: PlanDayKind = date === satDate ? 'sat' : weekday(date) === SATURDAY ? 'test' : 'study';
    days.push({ date, kind, past: date < today, questions: 0, words: 0 });
  }
  const ahead = days.filter((d) => !d.past && d.kind === 'study');
  if (ahead.length > 0) {
    const questions = spread(questionsLeft, ahead.length);
    const words = spread(wordsLeft, ahead.length);
    ahead.forEach((d, i) => {
      d.questions = questions[i];
      d.words = words[i];
    });
  }
  return days;
}

/** Whether an ISO timestamp falls on the given local date. */
export function isOn(timestamp: string | undefined, date: string): boolean {
  return timestamp !== undefined && localDate(new Date(timestamp)) === date;
}
