import { create } from 'zustand';
import { toMeta, type Question, type QuestionMeta } from '../types/question';
import type { AttemptOutcome, ProgressMap, ProfileStats, SessionResult } from '../types/progress';
import {
  DEFAULT_STATS,
  getBankRevision,
  getProgress,
  getQuestionMeta,
  getStats,
  setBankRevision,
  setProgress,
  setQuestionMeta,
  setStats,
} from '../lib/storage/localStorage';
import {
  deleteQuestions,
  ensureBundledSeeded,
  getAllQuestionIds,
  getAllQuestions,
  getQuestionsById,
  mergeQuestions,
  putQuestions,
} from '../lib/storage/db';
import { isWeakFingerprint, questionFingerprint } from '../lib/storage/dedupe';
import { fetchBankIndex, fetchQuestionFile, fetchShippedBank } from '../lib/storage/seedBank';

interface ProgressStore {
  /** Every stored question's details, without its text and images: enough for counts, pools
   *  and topics, and there from the first paint. */
  questions: QuestionMeta[];
  /** Full questions loaded so far, by id. Filled by `loadQuestions` for whatever is about to be
   *  shown, so the whole bank (tens of MB of images) is never read just to open the site. */
  loaded: Record<string, Question>;
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
  /** Loads the full questions with these ids, if they aren't loaded already. */
  loadQuestions: (ids: string[]) => Promise<void>;
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
function bankCounts(questions: QuestionMeta[]): { bundledCount: number; importedCount: number } {
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
  loaded: {},
  progress: {},
  stats: DEFAULT_STATS,
  isLoaded: false,
  bundledCount: 0,
  importedCount: 0,

  loadAll: async (bundled) => {
    await ensureBundledSeeded(bundled);
    // The details saved last time, unless the stored questions have changed since, which the
    // stored ids catch (another tab importing a bank, say). Without them, every question is
    // read once to make them.
    const ids = await getAllQuestionIds();
    let meta = getQuestionMeta();
    const metaIds = new Set(meta?.map((q) => q.id));
    if (!meta || meta.length !== ids.length || ids.some((id) => !metaIds.has(id))) {
      meta = (await getAllQuestions()).map(toMeta);
      setQuestionMeta(meta);
    }
    set({ questions: meta, progress: getProgress(), stats: getStats(), isLoaded: true, ...bankCounts(meta) });
  },

  loadShippedBank: async () => {
    // The full bank is only downloaded when the stored copy is out of date: a newer revision,
    // a question missing, or a hand-imported question the bank doesn't have (which the full
    // run removes). Otherwise the small index is all that's fetched.
    const index = await fetchBankIndex();
    if (index) {
      const stored = new Set(get().questions.map((q) => q.id));
      const shipped = new Set(index.ids);
      const current =
        index.revision <= getBankRevision() &&
        index.ids.every((id) => stored.has(id)) &&
        get().questions.every((q) => q.source !== 'imported' || q.testOnly || shipped.has(q.id));
      if (current) return;
    }

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
      for (const q of await getQuestionsById(extras.map((e) => e.id))) {
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

    // The details of what's stored now, from the bank and what was known before, without
    // reading any question back. Loaded questions the bank corrected are dropped, to reload.
    const known = new Map(get().questions.map((q) => [q.id, q]));
    for (const q of result.questions) known.set(q.id, toMeta(q));
    const questions = (await getAllQuestionIds()).flatMap((id) => known.get(id) ?? []);
    setQuestionMeta(questions);
    const loaded = { ...get().loaded };
    for (const q of result.questions) delete loaded[q.id];
    set({ questions, loaded, ...bankCounts(questions) });
  },

  loadQuestions: async (ids) => {
    const missing = ids.filter((id) => !get().loaded[id]);
    if (missing.length === 0) return;
    const found = await getQuestionsById(missing);
    set({ loaded: { ...get().loaded, ...Object.fromEntries(found.map((q) => [q.id, q])) } });
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
    const stored = new Map((await getQuestionsById(incoming.map((q) => q.id))).map((q) => [q.id, q]));
    const changed = incoming.filter((q) => JSON.stringify(q) !== JSON.stringify(stored.get(q.id)));
    if (changed.length === 0) return;
    await putQuestions(changed);
    const ids = new Set(changed.map((q) => q.id));
    const questions = [...get().questions.filter((q) => !ids.has(q.id)), ...changed.map(toMeta)];
    setQuestionMeta(questions);
    const loaded = { ...get().loaded };
    for (const q of changed) loaded[q.id] = q;
    set({ questions, loaded });
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
    const questions = (await getAllQuestions()).map(toMeta);
    setQuestionMeta(questions);
    set({ questions, loaded: {}, ...bankCounts(questions) });
  },
}));
