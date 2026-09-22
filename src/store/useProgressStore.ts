import { create } from 'zustand';
import type { Question } from '../types/question';
import type { ProgressMap, ProfileStats, SessionResult } from '../types/progress';
import { DEFAULT_STATS, getProgress, setProgress, getStats, setStats } from '../lib/storage/localStorage';
import { ensureBundledSeeded, getAllQuestions, replaceImportedQuestions, getQuestionCounts } from '../lib/storage/db';
import { fetchShippedBank } from '../lib/storage/seedBank';

interface ProgressStore {
  questions: Question[];
  progress: ProgressMap;
  stats: ProfileStats;
  isLoaded: boolean;
  bundledCount: number;
  importedCount: number;

  /** Seeds the bundled demo set (first run only) and loads everything from storage. */
  loadAll: (bundled: Question[]) => Promise<void>;
  /** Loads the bank shipped at public/question-bank.json, if present and not already in.
   *  Runs on startup so the app never needs a manual import; a no-op when either the file
   *  is absent or a bank has already been stored. */
  loadShippedBank: () => Promise<void>;
  applySessionResult: (result: SessionResult) => void;
  /** Pass 'all' or a list of question ids to return to the unattempted main pool. */
  resetProgress: (questionIds: string[] | 'all') => void;
  importQuestions: (qs: Question[], onProgress?: (written: number, total: number) => void) => Promise<void>;
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
    const [questions, counts] = await Promise.all([getAllQuestions(), getQuestionCounts()]);
    set({
      questions,
      progress: getProgress(),
      stats: getStats(),
      isLoaded: true,
      bundledCount: counts.bundled,
      importedCount: counts.imported,
    });
  },

  loadShippedBank: async () => {
    // Already holding an imported bank (shipped or hand-imported) — leave it alone, so this
    // never clobbers a bank the user imported themselves.
    if (get().importedCount > 0) return;

    const result = await fetchShippedBank();
    if (result.status !== 'loaded') {
      if (result.status === 'invalid') {
        console.error('question-bank.json failed validation:', result.issues);
      }
      return;
    }
    await get().importQuestions(result.questions);
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
    await replaceImportedQuestions(qs, onProgress);
    const [questions, counts] = await Promise.all([getAllQuestions(), getQuestionCounts()]);
    set({ questions, bundledCount: counts.bundled, importedCount: counts.imported });
  },
}));
