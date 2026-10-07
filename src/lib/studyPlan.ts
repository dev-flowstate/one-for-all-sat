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
 *  - Following the mistakes: each topic's latest answers set how often it comes round and at
 *    what level (see mistakes.ts), wrong answers come back to be redone, and a topic missed
 *    again and again in tests joins the plan even if it wasn't picked.
 *  - A light last day: the day before the SAT is a short review, not new work.
 */
import type { Difficulty, QuestionMeta } from '../types/question';
import type { ProgressMap } from '../types/progress';
import { statusOf } from './pools';
import { DOMAINS } from '../data/taxonomy';
import { sameSkill } from './topicStats';
import type { TopicInsight } from './mistakes';

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
  | { kind: 'practice'; skill: string; subject: 'math' | 'reading-writing'; difficulty: Difficulty; count: number; note?: string }
  | { kind: 'redo'; skill: string; count: number }
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
  /** The topics picked, or none for all of them. */
  skills: string[];
  questions: QuestionMeta[];
  /** Answers as of this morning, so the day's tasks hold while they're being done. */
  progress: ProgressMap;
  /** What the answers say about each topic. */
  insights: TopicInsight[];
  /** Words not yet learned, as of this morning. */
  wordsLeft: number;
  /** The book chapter being read now (0-based), or 0 before starting. */
  readingChapter: number;
}

export function subjectOf(skill: string): 'math' | 'reading-writing' {
  return DOMAINS.find((d) => d.skills.some((s) => sameSkill(s, skill)))?.subject ?? 'math';
}

/** Whether a Saturday has a full practice test: every week in the last three, else every other. */
function isTestSaturday(date: string, satDate: string): boolean {
  const weeksOut = Math.ceil(daysBetween(date, satDate) / 7);
  return weeksOut <= 3 || weeksOut % 2 === 1;
}

/** Most added to a plan for being missed again and again, so a bad test doesn't swamp it. */
const MAX_ADDED = 3;

export interface PlanTopic {
  insight: TopicInsight;
  /** Picked by the student, rather than added for being missed. */
  picked: boolean;
}

type Subject = 'math' | 'reading-writing';

/**
 * Each subject's topics in the order they come round, most in need first: struggling ones twice
 * per round, mastered ones every other round. A null is a turn the subject sits out, which
 * happens when all it has left is mastered topics; the other subject takes the turn.
 */
function rotation(topics: PlanTopic[]): Record<Subject, (string | null)[]> {
  const need = (t: PlanTopic) => {
    const { answered, wrong } = t.insight.recent;
    return answered ? (answered - wrong) / answered : 0.5;
  };
  const ordered = [...topics].sort((a, b) => need(a) - need(b)).map((t) => t.insight);
  const cycleFor = (subject: Subject): (string | null)[] => {
    const mine = ordered.filter((t) => t.subject === subject);
    const round = (withMastered: boolean) => [
      ...mine.filter((t) => t.trend !== 'mastered' || withMastered).map((t) => t.skill),
      ...mine.filter((t) => t.trend === 'struggling').map((t) => t.skill),
    ];
    const second = round(false);
    return mine.length === 0 ? [] : [...round(true), ...(second.length > 0 ? second : [null])];
  };
  return { 'reading-writing': cycleFor('reading-writing'), math: cycleFor('math') };
}

export function buildPlan(input: PlanInputs): { days: PlanDay[]; topics: PlanTopic[] } {
  const { start, today, satDate, questions, progress, insights } = input;
  const picked = input.skills.length > 0 ? input.skills : DOMAINS.flatMap((d) => d.skills);
  const isPicked = (skill: string) => picked.some((s) => sameSkill(s, skill));
  // The picked topics, and any others that keep going wrong.
  const added = insights
    .filter((t) => !isPicked(t.skill) && t.trend === 'struggling')
    .sort((a, b) => b.recent.wrong - a.recent.wrong)
    .slice(0, MAX_ADDED);
  const topics: PlanTopic[] = [
    ...insights.filter((t) => isPicked(t.skill)).map((insight) => ({ insight, picked: true })),
    ...added.map((insight) => ({ insight, picked: false })),
  ];
  const skills = topics.map((t) => t.insight.skill);
  const insightOf = (skill: string) => insights.find((t) => sameSkill(t.skill, skill))!;

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

  // Topic slots from today on, taken in turn from a Reading and Writing rotation and a Math one.
  const queues = rotation(topics);
  const turn = { 'reading-writing': 0, math: 0 };
  const next = (subject: Subject) => {
    const queue = queues[subject];
    return queue.length ? queue[turn[subject]++ % queue.length] : null;
  };
  const seen = new Map<string, number>();
  const slotsFor = (kind: PlanDayKind) => (kind === 'study' ? 2 : kind === 'quiz' || kind === 'review' ? 1 : 0);
  let lastSubject: Subject = 'math';
  const daySkills = days.map((day) => {
    const picked: string[] = [];
    if (day.past) return picked;
    for (let i = 0; i < slotsFor(day.kind); i++) {
      // Alternate subjects where both are in the plan; a subject sitting this turn out, or with
      // nothing in the plan, hands it to the other.
      const first: Subject = lastSubject === 'math' ? 'reading-writing' : 'math';
      const second: Subject = first === 'math' ? 'reading-writing' : 'math';
      let subject = first;
      let skill = next(first);
      if (skill === null) {
        subject = second;
        skill = next(second);
      }
      // Not the same topic twice in a day, when there's another to take.
      if (skill !== null && picked.includes(skill)) skill = next(subject) ?? null;
      // The turn was the first subject's even when it sat out, so the next one is the other's.
      lastSubject = first;
      if (skill === null || picked.includes(skill)) continue;
      picked.push(skill);
    }
    return picked;
  });

  // How many questions a block gets: what's left in the plan's topics, over the blocks left.
  const inPlan = questions.filter((q) => !q.testOnly && skills.some((s) => sameSkill(s, q.skill)));
  const unattempted = inPlan.filter((q) => statusOf(progress, q.id) === 'unattempted').length;
  const blocksLeft = days.reduce((n, d, i) => n + (d.past ? 0 : daySkills[i].length), 0);
  const blockSize = Math.min(20, Math.max(8, Math.round(unattempted / Math.max(1, blocksLeft))));
  const wrong = questions.filter((q) => statusOf(progress, q.id) === 'incorrect').length;
  const struggling = topics.filter((t) => t.insight.trend === 'struggling').map((t) => t.insight.skill);

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
        // What's been practised, and whatever is going wrong.
        skills: [...new Set([...covered, ...struggling])].length > 0 ? [...new Set([...covered, ...struggling])] : skills,
        count: QUIZ_SIZE,
        minutes: QUIZ_MINUTES,
      });
    }
    for (const skill of daySkills[i]) {
      const insight = insightOf(skill);
      // Today's level comes from the mistakes; later days are expected to step up every third
      // time round, and are worked out again each morning anyway.
      const k = seen.get(skill) ?? 0;
      seen.set(skill, k + 1);
      const level = Math.min(2, insight.level + Math.floor(k / 3));
      const { answered, wrong: missed } = insight.recent;
      const note =
        insight.trend === 'struggling'
          ? `you missed ${missed} of your last ${answered}`
          : insight.trend === 'mastered'
            ? 'mostly right lately'
            : undefined;
      tasks.push({ kind: 'practice', skill, subject: subjectOf(skill), difficulty: LEVELS[level], count: blockSize, note });
      // Wrong answers on the topic come back to be redone, a few at a time.
      if (insight.wrongIds.length > 0) tasks.push({ kind: 'redo', skill, count: Math.min(5, insight.wrongIds.length) });
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
  return { days, topics };
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
