import type { Difficulty, QuestionMeta, Subject } from '../types/question';
import type { RevealMode, SessionConfig, TimerMode } from '../types/settings';
import { useProgressStore } from '../store/useProgressStore';
import { useSessionStore } from '../store/useSessionStore';
import { statusOf } from './pools';
import { sameSkill } from './topicStats';
import { DOMAINS } from '../data/taxonomy';
import { shuffle } from './vocab/pools';

export interface PracticeRequest {
  skills: string[];
  /** The level wanted; none means any. */
  difficulty?: Difficulty;
  /** Only questions whose latest answer was wrong: for redoing mistakes. */
  onlyWrong?: boolean;
  count: number;
  revealMode: RevealMode;
  timerMode: TimerMode;
  countdownMinutes?: number;
}

/**
 * Starts a practice session straight away with questions picked for a plan's task, so a task
 * like "10 Boundaries questions, Medium" opens on those questions instead of on the setup page.
 *
 * Unattempted questions at the level asked come first; if there aren't enough, the topic's
 * other levels, then questions already answered (wrong ones before right ones) fill the rest.
 * Resolves false when the topics have no questions at all.
 */
export async function startPractice(request: PracticeRequest): Promise<boolean> {
  const store = useProgressStore.getState();
  // A named test's questions are kept out of practice, except to redo the ones it caught.
  const inTopics = store.questions.filter(
    (q) => (request.onlyWrong || !q.testOnly) && request.skills.some((s) => sameSkill(s, q.skill)),
  );
  const tiers: ((q: QuestionMeta) => boolean)[] = request.onlyWrong
    ? [(q) => statusOf(store.progress, q.id) === 'incorrect']
    : [
        (q) => statusOf(store.progress, q.id) === 'unattempted' && (!request.difficulty || q.difficulty === request.difficulty),
        (q) => statusOf(store.progress, q.id) === 'unattempted',
        (q) => statusOf(store.progress, q.id) === 'incorrect',
        () => true,
      ];
  const picked: QuestionMeta[] = [];
  for (const tier of tiers) {
    for (const q of shuffle(inTopics.filter(tier))) {
      if (picked.length === request.count) break;
      if (!picked.includes(q)) picked.push(q);
    }
  }
  if (picked.length === 0) return false;

  await store.loadQuestions(picked.map((q) => q.id));
  const loaded = useProgressStore.getState().loaded;
  const queue = picked.flatMap((q) => loaded[q.id] ?? []);
  if (queue.length === 0) return false;

  const domains = DOMAINS.filter((d) => d.skills.some((s) => request.skills.some((r) => sameSkill(r, s))));
  const config: SessionConfig = {
    subjects: [...new Set(domains.map((d) => d.subject))] as Subject[],
    domains: domains.map((d) => d.name),
    skills: request.skills,
    difficulties: request.difficulty ? [request.difficulty] : [],
    questionCount: queue.length,
    revealMode: request.revealMode,
    timerMode: request.timerMode,
    countdownMinutes: request.timerMode === 'countdown' ? request.countdownMinutes : undefined,
  };
  useSessionStore.getState().startSession(config, queue, store.stats.currentStreak);
  return true;
}
