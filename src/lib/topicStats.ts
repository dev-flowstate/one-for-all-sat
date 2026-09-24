import type { Question, Subject } from '../types/question';
import type { ProgressMap } from '../types/progress';
import { DOMAINS } from '../data/taxonomy';
import { statusOf } from './pools';

export interface SkillStat {
  subject: Subject;
  domain: string;
  skill: string;
  /** Questions on this subtopic in the bank. */
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  /** Share answered right, 0–100, or null before anything is answered. */
  accuracy: number | null;
}

/**
 * Subtopic names compared without regard to case: banks disagree on capitalisation after a
 * colon ("One-variable data: Distributions…" vs "…: distributions…"), and a mismatch would
 * leave the subtopic looking empty and impossible to practise.
 */
export function sameSkill(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Subtopics need this many answers before they're judged weak or ranked: one unlucky miss
 *  would otherwise put a subtopic at the bottom of the list. */
export const MIN_ANSWERED = 5;

/** Below this share right, a judged subtopic is marked "Weak". */
const WEAK_BELOW = 50;

/**
 * How each subtopic is going, in the order the SAT lists them. Based on each question's
 * current status, so a wrong answer later retried correctly counts as right.
 */
export function skillStats(questions: Question[], progress: ProgressMap): SkillStat[] {
  const stats = new Map<string, SkillStat>();
  for (const domain of DOMAINS) {
    for (const skill of domain.skills) {
      stats.set(`${domain.name}|${skill.toLowerCase()}`, {
        subject: domain.subject,
        domain: domain.name,
        skill,
        total: 0,
        answered: 0,
        correct: 0,
        wrong: 0,
        accuracy: null,
      });
    }
  }
  for (const q of questions) {
    const stat = stats.get(`${q.domain}|${q.skill.toLowerCase()}`);
    if (!stat) continue;
    const status = statusOf(progress, q.id);
    // A named test's questions can't be practised on their own, so they only count once
    // they've been answered in the test.
    if (q.testOnly && status === 'unattempted') continue;
    stat.total++;
    if (status === 'correct') stat.correct++;
    if (status === 'incorrect') stat.wrong++;
  }
  for (const stat of stats.values()) {
    stat.answered = stat.correct + stat.wrong;
    stat.accuracy = stat.answered > 0 ? Math.round((stat.correct / stat.answered) * 100) : null;
  }
  return [...stats.values()];
}

export function isWeak(stat: SkillStat): boolean {
  return stat.answered >= MIN_ANSWERED && stat.accuracy !== null && stat.accuracy < WEAK_BELOW;
}

/** Tailwind background for the dot beside an accuracy. */
export function accuracyTone(accuracy: number): string {
  if (accuracy >= 70) return 'bg-success';
  if (accuracy >= WEAK_BELOW) return 'bg-caution';
  return 'bg-danger';
}

/**
 * Judged subtopics from weakest to strongest: the highest share wrong first, and on a tie the
 * one with more wrong answers, since that's more evidence of the same weakness.
 */
export function rankWeakest(stats: SkillStat[]): SkillStat[] {
  return stats
    .filter((s) => s.answered >= MIN_ANSWERED)
    .sort((a, b) => b.wrong / b.answered - a.wrong / a.answered || b.wrong - a.wrong);
}
