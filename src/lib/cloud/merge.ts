import type { ProgressMap, ProfileStats } from '../../types/progress';
import type { VocabProgressMap } from '../../types/vocab';
import type { ActiveTest, CompletedTest } from '../../types/practiceTest';
import type { LocalProfile } from '../../types/settings';

/** Everything saved to a person's account. */
export interface AccountData {
  /** Kept with the data so it can be matched to the same Google account if it ever moves to
   *  another database, where the Firebase user id would mean nothing. */
  email: string | null;
  progress: ProgressMap;
  stats: ProfileStats;
  vocabProgress: VocabProgressMap;
  profile: LocalProfile | null;
  activeTest: ActiveTest | null;
  history: CompletedTest[];
}

/**
 * Combines this browser's copy with the account's. Used when someone signs in with progress
 * already in the browser, and on every visit after, so two devices converge on the same data.
 */
export function mergeAccountData(local: AccountData, cloud: AccountData): AccountData {
  const history = mergeHistory(local.history, cloud.history);
  const newest = newerOf(local.activeTest, cloud.activeTest, (t) => t.createdAt);
  // Finished on another device while this one still had it open.
  const activeTest = newest && history.some((t) => t.createdAt === newest.createdAt) ? null : newest;
  return {
    email: local.email ?? cloud.email,
    progress: mergeByLatest(local.progress, cloud.progress, (s) => s.lastAttemptedAt, (s) => s.attempts),
    // Totals can't be told apart once added up, so each keeps the higher of the two. Summing
    // would count the same answers twice every time a device syncs.
    stats: {
      points: Math.max(local.stats.points, cloud.stats.points),
      questionsAttempted: Math.max(local.stats.questionsAttempted, cloud.stats.questionsAttempted),
      correctCount: Math.max(local.stats.correctCount, cloud.stats.correctCount),
      currentStreak: Math.max(local.stats.currentStreak, cloud.stats.currentStreak),
      bestStreak: Math.max(local.stats.bestStreak, cloud.stats.bestStreak),
    },
    vocabProgress: mergeByLatest(local.vocabProgress, cloud.vocabProgress, (s) => s.lastReviewedAt, (s) => s.reviews),
    profile: local.profile ?? cloud.profile,
    // A test in progress takes the number after the finished ones, which may have grown.
    activeTest: activeTest && { ...activeTest, number: history.length + 1 },
    history,
  };
}

/** Per key, the entry answered most recently; the one answered more often on a tie. */
function mergeByLatest<T>(
  a: Record<string, T>,
  b: Record<string, T>,
  when: (entry: T) => string | undefined,
  count: (entry: T) => number,
): Record<string, T> {
  const out = { ...a };
  for (const [key, entry] of Object.entries(b)) {
    const mine = out[key];
    if (!mine) {
      out[key] = entry;
      continue;
    }
    const [x, y] = [when(mine) ?? '', when(entry) ?? ''];
    if (y > x || (y === x && count(entry) > count(mine))) out[key] = entry;
  }
  return out;
}

/** Every finished test from both, once each, numbered again in the order they were taken. */
function mergeHistory(a: CompletedTest[], b: CompletedTest[]): CompletedTest[] {
  const byTime = new Map<string, CompletedTest>();
  for (const test of [...a, ...b]) byTime.set(test.completedAt, test);
  return [...byTime.values()]
    .sort((x, y) => x.completedAt.localeCompare(y.completedAt))
    .map((test, index) => ({ ...test, number: index + 1 }));
}

function newerOf<T>(a: T | null, b: T | null, when: (value: T) => string): T | null {
  if (!a || !b) return a ?? b;
  return when(b) > when(a) ? b : a;
}
