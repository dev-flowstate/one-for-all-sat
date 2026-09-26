import { create } from 'zustand';
import type { Question } from '../types/question';
import type { ActiveTest, CompletedTest, TestModule, TestResponse, TestRouting } from '../types/practiceTest';
import {
  getActiveTest,
  getPausedTests,
  getTestHistory,
  setActiveTest,
  setPausedTests,
  setTestHistory,
} from '../lib/storage/localStorage';
import { BREAK_MINUTES } from '../lib/practiceTest/buildTest';
import { gradeTest, isCorrect } from '../lib/practiceTest/score';
import { useProgressStore } from './useProgressStore';

interface PracticeTestState {
  /** The test that's open: the one the runner shows. */
  active: ActiveTest | null;
  /** Every other test in progress, saved to come back to. Each is known by when it began. */
  paused: ActiveTest[];
  history: CompletedTest[];
  /** The number of the test that just ended, so the runner knows whose results to open. */
  justFinished: number | null;
  /** Set when a module's clock ran out and submitted it, so the runner can say why it moved on. */
  timedOut: boolean;

  /** Starts a test: a generated one, or a named test's fixed modules when `preset` is given.
   *  A test already open is kept, with the saved ones. */
  begin: (
    modules: TestModule[],
    timed: boolean,
    preset?: { id: string; name: string; routing?: TestRouting[] },
  ) => void;
  respond: (questionId: string, response: TestResponse | null) => void;
  toggleMarked: (questionId: string) => void;
  goTo: (index: number) => void;
  showReview: () => void;
  /** Runs the clock down. A module whose time runs out is submitted as it stands. */
  tick: (seconds: number) => void;
  /** Ends the current module and moves on: to module 2, the break, Math, or the results. */
  submitModule: () => void;
  endBreak: () => void;
  /** Opens a saved test, keeping whichever was open with the saved ones. */
  resume: (createdAt: string) => void;
  /** Deletes a test in progress, open or saved. */
  discard: (createdAt: string) => void;
  dismissTimedOut: () => void;
}

/**
 * Brings a saved test up to date, whether it was saved in this browser or comes back from the
 * cloud. Tests saved before the untimed option existed were all timed, and ones saved before a
 * test could route twice hold their one routing on its own rather than in a list.
 */
export function upgradeSavedTest(test: ActiveTest | null): ActiveTest | null {
  if (!test) return null;
  const routing = test.routing as TestRouting | TestRouting[] | undefined;
  return {
    ...test,
    timed: test.timed ?? true,
    routing: routing && (Array.isArray(routing) ? routing : [routing]),
  };
}

export function upgradeSavedHistory(history: CompletedTest[]): CompletedTest[] {
  return history.map((t) => ({ ...t, timed: t.timed ?? true }));
}

const savedTest = upgradeSavedTest(getActiveTest());
const savedPaused = getPausedTests().map((t) => upgradeSavedTest(t) as ActiveTest);
const savedHistory = upgradeSavedHistory(getTestHistory());

/** The section break sits between the last Reading and Writing module and the first Math one. */
const MODULE_BEFORE_BREAK = 1;

export const usePracticeTestStore = create<PracticeTestState>((set, get) => {
  function update(change: Partial<ActiveTest>) {
    const { active } = get();
    if (active) set({ active: { ...active, ...change } });
  }

  function startModule(index: number) {
    const { active } = get();
    if (!active) return;
    update({
      stage: { kind: 'module', module: index, view: 'question' },
      currentIndex: 0,
      secondsLeft: active.modules[index].minutes * 60,
    });
  }

  function finish() {
    const { active, history } = get();
    if (!active) return;
    const progress = useProgressStore.getState();
    // Grading needs the bank. The runner holds the clock until it's loaded, so this is only a
    // backstop against grading every question as missing.
    if (!progress.isLoaded) return;
    const byId = new Map<string, Question>(progress.questions.map((q) => [q.id, q]));
    // Numbered when it's finished, since several can be in progress at once.
    const result = gradeTest({ ...active, number: history.length + 1 }, byId, progress.stats.currentStreak);
    // The same bookkeeping a drill does: wrong answers move to the Wrong tab, right ones to Right.
    progress.applySessionResult({
      completedAt: result.completedAt,
      answers: result.answers,
      totalPoints: result.answers.reduce((sum, a) => sum + a.pointsEarned, 0),
      correctCount: result.answers.filter((a) => a.outcome === 'correct').length,
      incorrectCount: result.answers.filter((a) => a.outcome === 'incorrect').length,
    });
    set({ active: null, history: [...history, result], justFinished: result.number });
  }

  return {
    // Read straight away rather than from an effect: a reload lands on the runner, and for its
    // first render to find the test, the test has to be there before anything renders.
    active: savedTest,
    paused: savedPaused,
    history: savedHistory,
    justFinished: null,
    timedOut: false,

    begin: (modules, timed, preset) => {
      const { history, active, paused } = get();
      const inProgress = active ? [active, ...paused] : paused;
      // Named tests don't take a place in the "Practice Test N" sequence; ones still in progress do.
      const generated = [...history, ...inProgress].filter((t) => !t.presetId).length;
      set({
        justFinished: null,
        timedOut: false,
        paused: inProgress,
        active: {
          number: history.length + 1,
          name: preset?.name ?? `Practice Test ${generated + 1}`,
          presetId: preset?.id,
          routing: preset?.routing,
          createdAt: new Date().toISOString(),
          timed,
          modules,
          stage: { kind: 'module', module: 0, view: 'question' },
          currentIndex: 0,
          responses: {},
          marked: [],
          secondsLeft: modules[0].minutes * 60,
        },
      });
    },

    respond: (questionId, response) => {
      const { active } = get();
      if (!active) return;
      const responses = { ...active.responses };
      if (response) responses[questionId] = response;
      else delete responses[questionId];
      update({ responses });
    },

    toggleMarked: (questionId) => {
      const { active } = get();
      if (!active) return;
      const marked = active.marked.includes(questionId)
        ? active.marked.filter((id) => id !== questionId)
        : [...active.marked, questionId];
      update({ marked });
    },

    goTo: (index) => {
      const { active } = get();
      if (!active || active.stage.kind !== 'module') return;
      update({ currentIndex: index, stage: { ...active.stage, view: 'question' } });
    },

    showReview: () => {
      const { active } = get();
      if (!active || active.stage.kind !== 'module') return;
      update({ stage: { ...active.stage, view: 'review' } });
    },

    tick: (seconds) => {
      const { active } = get();
      if (!active || !active.timed || active.secondsLeft === 0) return;
      const secondsLeft = Math.max(0, active.secondsLeft - seconds);
      update({ secondsLeft });
      if (secondsLeft === 0 && active.stage.kind === 'module') {
        set({ timedOut: true });
        get().submitModule();
      }
    },

    submitModule: () => {
      const { active } = get();
      if (!active || active.stage.kind !== 'module') return;
      const current = active.stage.module;
      const next = current + 1;
      const routing = active.routing?.find((r) => r.afterModule === current);
      if (routing && next < active.modules.length) {
        const byId = new Map(useProgressStore.getState().questions.map((q) => [q.id, q]));
        const right = active.modules[active.stage.module].questionIds.filter((id) => {
          const question = byId.get(id);
          return question !== undefined && isCorrect(question, active.responses[id]);
        }).length;
        const routedEasier = right < routing.minCorrect;
        update({
          routing: active.routing?.map((r) => (r === routing ? { ...r, routedEasier } : r)),
          modules: routedEasier
            ? active.modules.map((m, i) => (i === next ? { ...m, questionIds: routing.easierIds } : m))
            : active.modules,
        });
      }
      if (next >= active.modules.length) finish();
      else if (active.stage.module === MODULE_BEFORE_BREAK) {
        update({ stage: { kind: 'break' }, secondsLeft: BREAK_MINUTES * 60 });
      } else startModule(next);
    },

    endBreak: () => startModule(MODULE_BEFORE_BREAK + 1),

    resume: (createdAt) => {
      const { active, paused } = get();
      if (active?.createdAt === createdAt) return;
      const chosen = paused.find((t) => t.createdAt === createdAt);
      if (!chosen) return;
      const rest = paused.filter((t) => t !== chosen);
      set({ active: chosen, paused: active ? [active, ...rest] : rest, timedOut: false });
    },

    discard: (createdAt) => {
      const { active, paused } = get();
      set({
        active: active?.createdAt === createdAt ? null : active,
        paused: paused.filter((t) => t.createdAt !== createdAt),
      });
    },

    dismissTimedOut: () => set({ timedOut: false }),
  };
});

// Saved on every change rather than at checkpoints, so a closed tab or a reload resumes on
// the same question with the same answers and time left.
usePracticeTestStore.subscribe((state, previous) => {
  if (state.active !== previous.active) setActiveTest(state.active);
  if (state.paused !== previous.paused) setPausedTests(state.paused);
  if (state.history !== previous.history) setTestHistory(state.history);
});
