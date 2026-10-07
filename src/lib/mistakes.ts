/**
 * What a student's answers say about their mistakes, topic by topic: how the latest answers
 * went, at which level the mistakes happen, and which questions are still wrong or keep going
 * wrong. Answers from drills, mini tests and full practice tests all count.
 */
import type { Difficulty, QuestionMeta } from '../types/question';
import type { ProgressMap } from '../types/progress';
import { DOMAINS } from '../data/taxonomy';

/** How many of a topic's latest answers judge how it's going now. */
const RECENT = 10;
const LEVELS: Difficulty[] = ['Easy', 'Medium', 'Hard'];

export type Trend = 'new' | 'struggling' | 'mixed' | 'solid' | 'mastered';

export interface TopicInsight {
  skill: string;
  subject: 'math' | 'reading-writing';
  /** The latest answers on this topic, newest first, up to ten. */
  recent: { answered: number; wrong: number };
  /** Every answer on the topic, by level. */
  byLevel: Record<Difficulty, { answered: number; wrong: number }>;
  /** Questions whose latest answer is wrong. */
  wrongIds: string[];
  /** Questions answered wrong more than once and still wrong. */
  repeated: number;
  trend: Trend;
  /** The level to practise at now, 0 Easy to 2 Hard. */
  level: number;
  /** Where the level came from, when it isn't simply the topic's recent accuracy. */
  levelReason: 'held' | 'raised' | null;
}

function trendOf(answered: number, wrong: number): Trend {
  if (answered < 4) return 'new';
  const right = (answered - wrong) / answered;
  if (right < 0.5) return 'struggling';
  if (right >= 0.85 && answered >= 8) return 'mastered';
  if (right >= 0.7) return 'solid';
  return 'mixed';
}

export function analyzeMistakes(questions: QuestionMeta[], progress: ProgressMap): TopicInsight[] {
  const out: TopicInsight[] = [];
  for (const domain of DOMAINS) {
    for (const skill of domain.skills) {
      const key = skill.toLowerCase();
      const answered = questions
        .filter((q) => q.skill.toLowerCase() === key && progress[q.id] && progress[q.id].status !== 'unattempted')
        .map((q) => ({ q, s: progress[q.id] }))
        .sort((a, b) => (b.s.lastAttemptedAt ?? '').localeCompare(a.s.lastAttemptedAt ?? ''));
      const recent = answered.slice(0, RECENT);
      const recentWrong = recent.filter((a) => a.s.status === 'incorrect').length;
      const byLevel = Object.fromEntries(
        LEVELS.map((level) => {
          const at = answered.filter((a) => a.q.difficulty === level);
          return [level, { answered: at.length, wrong: at.filter((a) => a.s.status === 'incorrect').length }];
        }),
      ) as TopicInsight['byLevel'];
      const trend = trendOf(recent.length, recentWrong);

      // The level follows recent accuracy, then one step for how that level itself is going:
      // down when most of its questions are wrong, up when nearly all are right.
      const rightShare = recent.length ? (recent.length - recentWrong) / recent.length : 0;
      let level = trend === 'new' || rightShare < 0.5 ? 0 : rightShare < 0.8 ? 1 : 2;
      let levelReason: TopicInsight['levelReason'] = null;
      const atLevel = byLevel[LEVELS[level]];
      if (level > 0 && atLevel.answered >= 4 && atLevel.wrong / atLevel.answered > 0.5) {
        level -= 1;
        levelReason = 'held';
      } else if (level < 2 && atLevel.answered >= 5 && atLevel.wrong / atLevel.answered <= 0.2) {
        level += 1;
        levelReason = 'raised';
      }

      const wrong = answered.filter((a) => a.s.status === 'incorrect');
      out.push({
        skill,
        subject: domain.subject,
        recent: { answered: recent.length, wrong: recentWrong },
        byLevel,
        wrongIds: wrong.map((a) => a.q.id),
        repeated: wrong.filter((a) => a.s.attempts >= 2).length,
        trend,
        level,
        levelReason,
      });
    }
  }
  return out;
}

const LEVEL_NAMES = ['Easy', 'Medium', 'Hard'];

/** What the analysis found about a topic and what the plan does about it, in a sentence. */
export function describeInsight(t: TopicInsight, inPlan: boolean): string {
  const right = t.recent.answered - t.recent.wrong;
  const level = LEVEL_NAMES[t.level];
  const parts: string[] = [];
  switch (t.trend) {
    case 'new':
      parts.push(`Not enough answers yet to judge, so it starts at ${level}.`);
      break;
    case 'struggling':
      parts.push(`${t.recent.wrong} of your last ${t.recent.answered} wrong. It comes up twice as often, at ${level}.`);
      break;
    case 'mixed':
      parts.push(`${t.recent.wrong} of your last ${t.recent.answered} wrong. Practised at ${level}.`);
      break;
    case 'solid':
      parts.push(`Mostly right lately (${right} of ${t.recent.answered}). Practised at ${level}.`);
      break;
    case 'mastered':
      parts.push(`${right} of your last ${t.recent.answered} right. It comes up half as often now.`);
      break;
  }
  if (t.levelReason === 'held') {
    const above = LEVEL_NAMES[t.level + 1];
    const at = t.byLevel[above as Difficulty];
    parts.push(`Most of your ${above} ones go wrong (${at.wrong} of ${at.answered}), so it stays at ${level} for now.`);
  }
  if (t.levelReason === 'raised') {
    const below = LEVEL_NAMES[t.level - 1];
    const at = t.byLevel[below as Difficulty];
    parts.push(`You get the ${below} ones right (${at.answered - at.wrong} of ${at.answered}), so it moves up to ${level}.`);
  }
  if (t.wrongIds.length > 0) {
    parts.push(
      `${t.wrongIds.length} still wrong${t.repeated > 0 ? `, ${t.repeated} missed more than once` : ''}: they're set to redo.`,
    );
  }
  if (!inPlan) parts.unshift('Not one of your picks, but you keep missing it, so it’s been added.');
  return parts.join(' ');
}
