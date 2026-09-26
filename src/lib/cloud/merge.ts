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
  /** Tests in progress besides the open one. Missing from accounts saved before there could
   *  be more than one. */
  pausedTests?: ActiveTest[];
  history: CompletedTest[];
}

/**
 * Combines this browser's copy with the account's. Used when someone signs in with progress
 * already in the browser, and on every visit after, so two devices converge on the same data.
 */
export function mergeAccountData(local: AccountData, cloud: AccountData): AccountData {
  const history = mergeHistory(local.history, cloud.history);
  // Every test in progress on either side is kept. The same test on both is known by when it
  // began, and the copy further along wins. One finished on another device is dropped.
  const byStart = new Map<string, ActiveTest>();
  const all = [local.activeTest, ...(local.pausedTests ?? []), cloud.activeTest, ...(cloud.pausedTests ?? [])];
  for (const test of all) {
    if (!test || history.some((t) => t.createdAt === test.createdAt)) continue;
    byStart.set(test.createdAt, furtherAlong(byStart.get(test.createdAt) ?? null, test) as ActiveTest);
  }
  // The test open in this browser stays open; everything else is listed to go back to.
  const openHere = local.activeTest?.createdAt;
  const activeTest = (openHere && byStart.get(openHere)) || null;
  const pausedTests = [...byStart.values()]
    .filter((t) => t !== activeTest)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    activeTest,
    pausedTests,
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

/** Of two copies of a test in progress, the one further along: the later module, then more
 *  answers, then the one saved from the test started more recently. */
function furtherAlong(a: ActiveTest | null, b: ActiveTest | null): ActiveTest | null {
  if (!a || !b) return a ?? b;
  const progress = (t: ActiveTest) => [
    // The break sits after module 2 (index 1), before Math.
    t.stage.kind === 'break' ? 1.5 : t.stage.module,
    Object.keys(t.responses).length,
  ];
  const [x, y] = [progress(a), progress(b)];
  if (x[0] !== y[0]) return y[0] > x[0] ? b : a;
  if (x[1] !== y[1]) return y[1] > x[1] ? b : a;
  return b.createdAt > a.createdAt ? b : a;
}
