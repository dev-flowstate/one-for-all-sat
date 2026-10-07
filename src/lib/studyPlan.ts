/**
 * The personal study plan: what to do each day until the SAT, for the topics the student picked.
 *
 * Built on what research on studying finds works best (Dunlosky et al., 2013, "Improving
 * Students' Learning With Effective Learning Techniques"), and College Board's own advice:
 *  - Spaced practice: each topic comes back every few days instead of being crammed, and the
 *    weakest come back twice as often.
 *  - Interleaving: two different topics a day, a Reading and Writing one with a Math one where
 *    both are in the plan.
 *  - Practice testing: a short mixed quiz each Wednesday on the topics practised so far, and
 *    full practice tests, spaced two weeks apart until the last three weeks, then weekly.
 *  - Reviewing mistakes: the day after a full test goes over what it got wrong.
 *  - Rising difficulty: a topic starts at the level its accuracy suggests and steps up every
 *    second time it comes round.
 *  - A light last day: the day before the SAT is a short review, not new work.
 */
import type { Difficulty, QuestionMeta } from '../types/question';
import type { ProgressMap } from '../types/progress';
import { statusOf } from './pools';
import { DOMAINS } from '../data/taxonomy';
import { sameSkill, type SkillStat } from './topicStats';

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

function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

/** Whether an ISO timestamp falls on the given local date. */
export function isOn(timestamp: string | undefined, date: string): boolean {
  return timestamp !== undefined && localDate(new Date(timestamp)) === date;
}

const SATURDAY = 6;
const SUNDAY = 0;
const WEDNESDAY = 3;
const LEVELS: Difficulty[] = ['Easy', 'Medium', 'Hard'];
const QUIZ_SIZE = 15;
const QUIZ_MINUTES = 20;
const BOOK_CHAPTERS = 61;

export type PlanTask =
  | { kind: 'practice'; skill: string; subject: 'math' | 'reading-writing'; difficulty: Difficulty; count: number }
  | { kind: 'quiz'; skills: string[]; count: number; minutes: number }
  | { kind: 'review'; label: string; count: number }
  | { kind: 'test' }
  | { kind: 'words'; count: number }
  | { kind: 'reading'; from: number; to: number }
  | { kind: 'rest'; label: string };

export type PlanDayKind = 'study' | 'quiz' | 'review' | 'test' | 'light' | 'sat';

export interface PlanDay {
  date: string;
  kind: PlanDayKind;
  past: boolean;
  tasks: PlanTask[];
}

export interface PlanInputs {
  start: string;
  today: string;
  satDate: string;
  /** The topics to work on, most in need first. */
  skills: string[];
  questions: QuestionMeta[];
  progress: ProgressMap;
  stats: SkillStat[];
  /** Words not yet learned, as of this morning. */
  wordsLeft: number;
  /** The book chapter being read now (0-based), or 0 before starting. */
  readingChapter: number;
}

export function subjectOf(skill: string): 'math' | 'reading-writing' {
  return DOMAINS.find((d) => d.skills.some((s) => sameSkill(s, skill)))?.subject ?? 'math';
}

/** Where a topic starts, from how it's gone so far: Easy below 50%, Medium below 80%, else Hard.
 *  A topic not yet tried starts Easy. */
function startingLevel(stat: SkillStat | undefined): number {
  if (!stat || stat.accuracy === null || stat.answered < 5) return 0;
  return stat.accuracy < 50 ? 0 : stat.accuracy < 80 ? 1 : 2;
}

/** Whether a Saturday has a full practice test: every week in the last three, else every other. */
function isTestSaturday(date: string, satDate: string): boolean {
  const weeksOut = Math.ceil(daysBetween(date, satDate) / 7);
  return weeksOut <= 3 || weeksOut % 2 === 1;
}

/** Topics in the order they come round: the plan's order, with weak ones in it twice, spread out. */
function rotation(skills: string[], stats: SkillStat[]): string[] {
  const weak = skills.filter((s) => {
    const stat = stats.find((t) => sameSkill(t.skill, s));
    return stat?.accuracy !== null && stat?.accuracy !== undefined && stat.answered >= 5 && stat.accuracy < 60;
  });
  return [...skills, ...weak];
}

export function buildPlan(input: PlanInputs): PlanDay[] {
  const { start, today, satDate, questions, progress, stats } = input;
  const skills = input.skills.length > 0 ? input.skills : DOMAINS.flatMap((d) => d.skills);

  // The days and what kind each is.
  const days: PlanDay[] = [];
  for (let date = start; date <= satDate; date = addDays(date, 1)) {
    const dow = weekday(date);
    let kind: PlanDayKind;
    if (date === satDate) kind = 'sat';
    else if (date === addDays(satDate, -1)) kind = 'light';
    else if (dow === SATURDAY && isTestSaturday(date, satDate)) kind = 'test';
    else if (dow === SUNDAY && days.at(-1)?.kind === 'test') kind = 'review';
    else if (dow === WEDNESDAY) kind = 'quiz';
    else kind = 'study';
    days.push({ date, kind, past: date < today, tasks: [] });
  }

  // Topic slots, taken in turn from a Reading and Writing rotation and a Math one.
  const order = rotation(skills, stats);
  const queues = {
    'reading-writing': order.filter((s) => subjectOf(s) === 'reading-writing'),
    math: order.filter((s) => subjectOf(s) === 'math'),
  };
  const turn = { 'reading-writing': 0, math: 0 };
  const seen = new Map<string, number>();
  const slotsFor = (kind: PlanDayKind) => (kind === 'study' ? 2 : kind === 'quiz' || kind === 'review' ? 1 : 0);
  let lastSubject: 'math' | 'reading-writing' = 'math';
  const daySkills = days.map((day) => {
    const picked: string[] = [];
    for (let i = 0; i < slotsFor(day.kind); i++) {
      // Alternate subjects where both are in the plan.
      let subject: 'math' | 'reading-writing' = lastSubject === 'math' ? 'reading-writing' : 'math';
      if (queues[subject].length === 0) subject = subject === 'math' ? 'reading-writing' : 'math';
      const queue = queues[subject];
      if (queue.length === 0) break;
      let skill = queue[turn[subject]++ % queue.length];
      // Not the same topic twice in a day, when there's another to take.
      if (picked.includes(skill) && queue.length > 1) skill = queue[turn[subject]++ % queue.length];
      picked.push(skill);
      lastSubject = subject;
    }
    return picked;
  });

  // How many questions a block gets: what's left in the plan's topics, over the blocks left.
  const inPlan = questions.filter((q) => !q.testOnly && skills.some((s) => sameSkill(s, q.skill)));
  const unattempted = inPlan.filter((q) => statusOf(progress, q.id) === 'unattempted').length;
  const blocksLeft = days.reduce((n, d, i) => n + (d.past ? 0 : daySkills[i].length), 0);
  const blockSize = Math.min(20, Math.max(8, Math.round(unattempted / Math.max(1, blocksLeft))));
  const wrong = questions.filter((q) => statusOf(progress, q.id) === 'incorrect').length;

  // Words and chapters, spread over the days left that aren't test days.
  const busy = (kind: PlanDayKind) => kind === 'test' || kind === 'sat' || kind === 'light';
  const workDays = days.filter((d) => !d.past && !busy(d.kind));
  const wordsPerDay = workDays.length ? Math.ceil(input.wordsLeft / workDays.length) : 0;
  const chaptersLeft = Math.max(0, BOOK_CHAPTERS - input.readingChapter);
  const chaptersPerDay = workDays.length ? Math.ceil(chaptersLeft / workDays.length) : 0;
  let nextChapter = input.readingChapter;

  const covered: string[] = [];
  days.forEach((day, i) => {
    const tasks: PlanTask[] = [];
    if (day.kind === 'sat') tasks.push({ kind: 'rest', label: 'SAT day: good luck!' });
    if (day.kind === 'test') tasks.push({ kind: 'test' });
    if (day.kind === 'light') {
      tasks.push({ kind: 'review', label: 'Light review: redo a few questions you missed', count: Math.min(10, wrong) });
      tasks.push({ kind: 'rest', label: 'Rest and get a good night’s sleep' });
    }
    if (day.kind === 'review') {
      tasks.push({ kind: 'review', label: "Go over yesterday's practice test mistakes", count: Math.min(15, wrong) });
    }
    if (day.kind === 'quiz') {
      tasks.push({
        kind: 'quiz',
        skills: covered.length > 0 ? [...new Set(covered)] : skills,
        count: QUIZ_SIZE,
        minutes: QUIZ_MINUTES,
      });
    }
    for (const skill of daySkills[i]) {
      const k = seen.get(skill) ?? 0;
      seen.set(skill, k + 1);
      const stat = stats.find((s) => sameSkill(s.skill, skill));
      const level = Math.min(2, startingLevel(stat) + Math.floor(k / 2));
      tasks.push({ kind: 'practice', skill, subject: subjectOf(skill), difficulty: LEVELS[level], count: blockSize });
      covered.push(skill);
    }
    if (!day.past && !busy(day.kind)) {
      if (wordsPerDay > 0) tasks.push({ kind: 'words', count: wordsPerDay });
      if (chaptersPerDay > 0 && nextChapter < BOOK_CHAPTERS) {
        const to = Math.min(BOOK_CHAPTERS, nextChapter + chaptersPerDay);
        tasks.push({ kind: 'reading', from: nextChapter + 1, to });
        nextChapter = to;
      }
    }
    day.tasks = tasks;
  });
  return days;
}

/** Short names for topics, for calendar squares. */
const SHORT: Record<string, string> = {
  'Linear equations in one variable': 'Linear eq. (1 var)',
  'Linear equations in two variables': 'Linear eq. (2 var)',
  'Systems of two linear equations in two variables': 'Linear systems',
  'Linear inequalities in one or two variables': 'Inequalities',
  'Nonlinear equations in one variable and systems of equations in two variables': 'Nonlinear equations',
  'Ratios, rates, proportional relationships, and units': 'Ratios & rates',
  'One-variable data: Distributions and measures of center and spread': 'One-variable data',
  'Two-variable data: Models and scatterplots': 'Two-variable data',
  'Probability and conditional probability': 'Probability',
  'Inference from sample statistics and margin of error': 'Sample statistics',
  'Evaluating statistical claims: Observational studies and experiments': 'Statistical claims',
  'Lines, angles, and triangles': 'Lines & angles',
  'Right triangles and trigonometry': 'Right triangles & trig',
  'Central Ideas and Details': 'Central ideas',
  'Command of Evidence': 'Evidence',
  'Text Structure and Purpose': 'Structure & purpose',
  'Cross-Text Connections': 'Cross-text',
  'Form, Structure, and Sense': 'Form & sense',
  'Rhetorical Synthesis': 'Rhetorical synthesis',
};

export function shortSkill(skill: string): string {
  return SHORT[skill] ?? skill;
}
