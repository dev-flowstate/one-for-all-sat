import type { QuestionMeta } from '../../types/question';
import type { ProgressMap, ProfileStats } from '../../types/progress';
import type { LocalProfile } from '../../types/settings';
import type { VocabProgressMap } from '../../types/vocab';
import type { ActiveTest, CompletedTest } from '../../types/practiceTest';
import type { AccountUser } from '../cloud/cloudClient';

const KEYS = {
  profile: 'ofa-sat:profile',
  progress: 'ofa-sat:progress',
  stats: 'ofa-sat:stats',
  // Its own key: vocabulary is a separate section, and mixing the two maps would make
  // "reset my wrong questions" quietly wipe flashcard progress too.
  vocabProgress: 'ofa-sat:vocab-progress',
  activeTest: 'ofa-sat:active-test',
  pausedTests: 'ofa-sat:paused-tests',
  testHistory: 'ofa-sat:test-history',
  // The account this browser's data belongs to. Set while signed in, and kept if the session
  // runs out, so signing in as the same person again merges the two instead of leaving this out.
  accountOwner: 'ofa-sat:account-owner',
  // The signed-in session: who it is, and the token the Worker gave them.
  session: 'ofa-sat:session',
  // The shipped bank's revision this browser last stored. Per device, like the bank itself.
  bankRevision: 'ofa-sat:bank-revision',
  questionMeta: 'ofa-sat:question-meta',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — fail silently, app still works in-memory
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // see write()
  }
}

export const DEFAULT_STATS: ProfileStats = {
  points: 0,
  questionsAttempted: 0,
  correctCount: 0,
  currentStreak: 0,
  bestStreak: 0,
};

export function getProfile(): LocalProfile | null {
  return read<LocalProfile | null>(KEYS.profile, null);
}

export function setProfile(profile: LocalProfile | null): void {
  if (profile) write(KEYS.profile, profile);
  else remove(KEYS.profile);
}

export function getProgress(): ProgressMap {
  return read<ProgressMap>(KEYS.progress, {});
}

export function setProgress(progress: ProgressMap): void {
  write(KEYS.progress, progress);
}

export function getStats(): ProfileStats {
  return read<ProfileStats>(KEYS.stats, DEFAULT_STATS);
}

export function setStats(stats: ProfileStats): void {
  write(KEYS.stats, stats);
}

export function getVocabProgress(): VocabProgressMap {
  return read<VocabProgressMap>(KEYS.vocabProgress, {});
}

export function setVocabProgress(progress: VocabProgressMap): void {
  write(KEYS.vocabProgress, progress);
}

export function getActiveTest(): ActiveTest | null {
  return read<ActiveTest | null>(KEYS.activeTest, null);
}

export function setActiveTest(test: ActiveTest | null): void {
  if (test) write(KEYS.activeTest, test);
  else remove(KEYS.activeTest);
}

export function getPausedTests(): ActiveTest[] {
  return read<ActiveTest[]>(KEYS.pausedTests, []);
}

export function setPausedTests(tests: ActiveTest[]): void {
  if (tests.length > 0) write(KEYS.pausedTests, tests);
  else remove(KEYS.pausedTests);
}

export function getTestHistory(): CompletedTest[] {
  return read<CompletedTest[]>(KEYS.testHistory, []);
}

export function setTestHistory(history: CompletedTest[]): void {
  write(KEYS.testHistory, history);
}

export function getAccountOwner(): string | null {
  return read<string | null>(KEYS.accountOwner, null);
}

export function setAccountOwner(uid: string | null): void {
  if (uid) write(KEYS.accountOwner, uid);
  else remove(KEYS.accountOwner);
}

export interface StoredSession {
  token: string;
  user: AccountUser;
}

export function getSession(): StoredSession | null {
  return read<StoredSession | null>(KEYS.session, null);
}

export function setSession(session: StoredSession | null): void {
  if (session) write(KEYS.session, session);
  else remove(KEYS.session);
}

export function getBankRevision(): number {
  return read<number>(KEYS.bankRevision, 0);
}

export function setBankRevision(revision: number): void {
  write(KEYS.bankRevision, revision);
}

/** The stored questions' details, without their text and images, so counts and pools are there
 *  on the first paint instead of after every question is read from IndexedDB. */
export function getQuestionMeta(): QuestionMeta[] | null {
  return read<QuestionMeta[] | null>(KEYS.questionMeta, null);
}

export function setQuestionMeta(meta: QuestionMeta[]): void {
  write(KEYS.questionMeta, meta);
}
