import { create } from 'zustand';
import type { Question } from '../types/question';
import type { AttemptOutcome, ProgressMap, ProfileStats, SessionResult } from '../types/progress';
import {
  DEFAULT_STATS,
  getBankRevision,
  getProgress,
  getStats,
  setBankRevision,
  setProgress,
  setStats,
} from '../lib/storage/localStorage';
import { deleteQuestions, ensureBundledSeeded, getAllQuestions, mergeQuestions, putQuestions } from '../lib/storage/db';
import { isWeakFingerprint, questionFingerprint } from '../lib/storage/dedupe';
import { fetchQuestionFile, fetchShippedBank } from '../lib/storage/seedBank';

interface ProgressStore {
  questions: Question[];
  progress: ProgressMap;
  stats: ProfileStats;
  isLoaded: boolean;
  bundledCount: number;
  importedCount: number;

  /** Seeds the bundled demo set (first run only) and loads everything from storage. */
  loadAll: (bundled: Question[]) => Promise<void>;
  /** Merges the bank shipped at public/question-bank.json into whatever is already stored.
   *  Runs on startup so the app never needs a manual import. Additive: it never removes a
   *  question someone imported themselves, and never re-adds one already present, so answered
   *  questions can't reappear in the unattempted pool. */
  loadShippedBank: () => Promise<void>;
  /** Stores a named test's questions from its own file, so the test can start. */
  loadTestQuestions: (file: string) => Promise<void>;
  applySessionResult: (result: SessionResult) => void;
  /** Corrects an answer already recorded in this session, when it's changed before the set
   *  ends: the question's status and the points move, but it isn't counted as a new attempt. */
  amendAnswer: (questionId: string, outcome: AttemptOutcome, pointsDelta: number) => void;
  /** Pass 'all' or a list of question ids to return to the unattempted main pool. */
  resetProgress: (questionIds: string[] | 'all') => void;
  importQuestions: (qs: Question[], onProgress?: (written: number, total: number) => void) => Promise<void>;
}

/** How many practice questions there are of each kind. A named test's questions aren't part of
 *  the bank, so they aren't counted. */
function bankCounts(questions: Question[]): { bundledCount: number; importedCount: number } {
  let bundledCount = 0;
  let importedCount = 0;
  for (const q of questions) {
    if (q.testOnly) continue;
    if (q.source === 'bundled') bundledCount += 1;
    else importedCount += 1;
  }
  return { bundledCount, importedCount };
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  questions: [],
  progress: {},
  stats: DEFAULT_STATS,
  isLoaded: false,
  bundledCount: 0,
  importedCount: 0,

  loadAll: async (bundled) => {
    await ensureBundledSeeded(bundled);
    const questions = await getAllQuestions();
    set({ questions, progress: getProgress(), stats: getStats(), isLoaded: true, ...bankCounts(questions) });
  },

  loadShippedBank: async () => {
    const result = await fetchShippedBank();
    if (result.status !== 'loaded') {
      if (result.status === 'invalid') {
        console.error('question-bank.json failed validation:', result.issues);
      }
      return;
    }

    // The shipped bank is the whole bank: a question someone imported by hand that it doesn't
    // have is removed, so an older copy can't sit beside the shipped one as a duplicate. Progress
    // on a removed copy moves to the shipped question it matches, so no answer is lost. A named
    // test's questions aren't in the bank and stay.
    const shippedIds = new Set(result.questions.map((q) => q.id));
    const extras = get().questions.filter((q) => q.source === 'imported' && !q.testOnly && !shippedIds.has(q.id));
    if (extras.length > 0) {
      const byFingerprint = new Map(result.questions.map((q) => [questionFingerprint(q), q.id]));
      const progress = { ...get().progress };
      for (const q of extras) {
        const fingerprint = questionFingerprint(q);
        const target = isWeakFingerprint(fingerprint) ? undefined : byFingerprint.get(fingerprint);
        if (target && progress[q.id]) {
          progress[target] ??= progress[q.id];
          delete progress[q.id];
        }
      }
      setProgress(progress);
      set({ progress });
      await deleteQuestions(extras.map((q) => q.id));
    }

    // Questions already stored are left alone, except once after the bank's revision goes up:
    // then they're rewritten, so a corrected explanation reaches people who already have the
    // question. Progress is keyed by id, which a correction never changes, so it's untouched.
    const corrected = result.revision > getBankRevision();
    const { added, updated } = await mergeQuestions(result.questions, undefined, { updateExisting: corrected });
    if (corrected) setBankRevision(result.revision);
    if (added === 0 && updated === 0 && extras.length === 0) return;

    const questions = await getAllQuestions();
    set({ questions, ...bankCounts(questions) });
  },

  loadTestQuestions: async (file) => {
    const result = await fetchQuestionFile(file);
    if (result.status !== 'loaded') {
      if (result.status === 'invalid') console.error(`${file} failed validation:`, result.issues);
      return;
    }
    // Written only when something differs from what's stored, which after the first visit is
    // only when the file has been corrected. Kept out of practice whatever the file says.
    const incoming = result.questions.map((q) => ({ ...q, testOnly: true }));
    const stored = new Map(get().questions.map((q) => [q.id, q]));
    const changed = incoming.filter((q) => JSON.stringify(q) !== JSON.stringify(stored.get(q.id)));
    if (changed.length === 0) return;
    await putQuestions(changed);
    const ids = new Set(changed.map((q) => q.id));
    set({ questions: [...get().questions.filter((q) => !ids.has(q.id)), ...changed] });
  },

  applySessionResult: (result) => {
    const progress = { ...get().progress };
    for (const answer of result.answers) {
      const prev = progress[answer.questionId];
      progress[answer.questionId] = {
        status: answer.outcome,
        attempts: (prev?.attempts ?? 0) + 1,
        lastAttemptedAt: result.completedAt,
        lastOutcome: answer.outcome,
      };
    }
    setProgress(progress);

    const stats = { ...get().stats };
    stats.points += result.totalPoints;
    stats.questionsAttempted += result.answers.length;
    stats.correctCount += result.correctCount;
    for (const answer of result.answers) {
      if (answer.outcome === 'correct') {
        stats.currentStreak += 1;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      } else {
        stats.currentStreak = 0;
      }
    }
    setStats(stats);

    set({ progress, stats });
  },

  amendAnswer: (questionId, outcome, pointsDelta) => {
    const prev = get().progress[questionId];
    if (!prev || prev.status === outcome) return;
    const progress = { ...get().progress, [questionId]: { ...prev, status: outcome, lastOutcome: outcome } };
    setProgress(progress);
    const stats = { ...get().stats };
    stats.correctCount += outcome === 'correct' ? 1 : -1;
    stats.points = Math.max(0, stats.points + pointsDelta);
    setStats(stats);
    set({ progress, stats });
  },

  resetProgress: (questionIds) => {
    const progress = { ...get().progress };
    if (questionIds === 'all') {
      for (const key of Object.keys(progress)) delete progress[key];
    } else {
      for (const id of questionIds) delete progress[id];
    }
    setProgress(progress);
    set({ progress });
  },

  importQuestions: async (qs, onProgress) => {
    // Merged, never replaced. The shipped bank is stored as imported too, so replacing the
    // imported set on each import deleted it -- anyone importing the maths bank lost every
    // English question until the next reload put them back.
    await mergeQuestions(qs, onProgress, { updateExisting: true });
    const questions = await getAllQuestions();
    set({ questions, ...bankCounts(questions) });
  },
}));
